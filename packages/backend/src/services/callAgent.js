/**
 * Call Agent - Orchestrates ASR → LLM → TTS for AI receptionist calls
 * 
 * This service connects to LiveKit rooms and handles the full voice AI pipeline:
 * 1. Receives audio from visitor
 * 2. Transcribes via ASR (Deepgram)
 * 3. Generates response via LLM (OpenAI)
 * 4. Synthesizes speech via TTS (ElevenLabs)
 * 5. Sends audio back to visitor
 */

import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { Room, RoomEvent, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioFrame, AudioStream, TrackKind } from '@livekit/rtc-node';
import { createASRAdapter } from './asr.js';
import { createTTSAdapter } from './tts.js';
import { DialogManager } from './dialogManager.js';
import { createGoogleCalendarEvent, getAvailableSlots } from './googleCalendar.js';
import { emitToTenant } from '../websocket/index.js';
import config from '../config/index.js';
import { logger as log } from '../lib/logger.js';
import { getDatabase } from '../db/index.js';
import EventEmitter from 'events';

/**
 * CallAgent handles a single call session with the AI receptionist
 */
export class CallAgent extends EventEmitter {
  constructor(options) {
    super();
    this.callId = options.callId;
    this.tenantId = options.tenantId;
    this.roomName = options.roomName;
    this.tenantConfig = options.tenantConfig;
    
    this.asr = null;
    this.tts = null;
    this.dialogManager = null;
    this.conversationHistory = [];
    this.isProcessing = false;
    this.audioBuffer = [];
    
    // LiveKit room connection
    this.room = null;
    this.audioSource = null;
    this.audioTrack = null;
    
    log.info('CallAgent created', { callId: this.callId, roomName: this.roomName });
  }

  /**
   * Generate agent token for joining room
   */
  generateAgentToken() {
    const token = new AccessToken(
      config.livekit.apiKey,
      config.livekit.apiSecret,
      {
        identity: `agent-${this.callId}`,
        name: this.tenantConfig?.receptionistName || 'AI Receptionist',
      }
    );
    
    token.addGrant({
      roomJoin: true,
      room: this.roomName,
      canPublish: true,
      canSubscribe: true,
    });
    
    return token.toJwt();
  }

  /**
   * Connect to the LiveKit room as an agent
   */
  async connectToRoom() {
    try {
      const token = await this.generateAgentToken();
      const wsUrl = config.livekit.url.replace('http', 'ws');
      
      this.room = new Room();
      
      // Set up room event handlers
      this.room.on(RoomEvent.TrackSubscribed, async (track, publication, participant) => {
        log.info('Track subscribed', { 
          trackKind: track.kind, 
          participant: participant.identity,
          isAgent: participant.identity === `agent-${this.callId}`
        });
        
        if (track.kind === TrackKind.KIND_AUDIO && participant.identity !== `agent-${this.callId}`) {
          log.info('Subscribed to visitor audio - creating AudioStream', { participant: participant.identity });
          
          // Create AudioStream to receive audio frames
          const audioStream = new AudioStream(track, 16000, 1); // 16kHz mono for Deepgram
          
          // Process audio frames asynchronously
          (async () => {
            try {
              for await (const frame of audioStream) {
                if (this.asr) {
                  // Convert Int16Array to Buffer for Deepgram
                  const buffer = Buffer.from(frame.data.buffer);
                  this.asr.sendAudio(buffer);
                }
              }
            } catch (err) {
              log.error('Audio stream error', { error: err.message, callId: this.callId });
            }
          })();
        }
      });
      
      this.room.on(RoomEvent.Disconnected, () => {
        log.info('Room disconnected', { callId: this.callId });
      });
      
      await this.room.connect(wsUrl, token);
      log.info('Agent connected to room', { roomName: this.roomName, callId: this.callId });
      
      // Create and publish audio track
      this.audioSource = new AudioSource(24000, 1); // 24kHz mono
      this.audioTrack = LocalAudioTrack.createAudioTrack('agent-audio', this.audioSource);
      
      const publishOptions = new TrackPublishOptions();
      publishOptions.source = TrackSource.SOURCE_MICROPHONE;
      
      await this.room.localParticipant.publishTrack(this.audioTrack, publishOptions);
      log.info('Audio track published', { callId: this.callId });
      
      return true;
    } catch (error) {
      log.error('Failed to connect to room', { error: error.message, callId: this.callId });
      throw error;
    }
  }

  /**
   * Initialize the AI pipeline services
   */
  async initialize() {
    try {
      // Initialize ASR
      const asrProvider = this.tenantConfig?.asrProvider?.toLowerCase() || 'deepgram';
      log.info('Initializing ASR', { asrProvider, tenantConfig: JSON.stringify(this.tenantConfig) });
      this.asr = createASRAdapter(asrProvider, {
        language: this.tenantConfig?.language || 'en-US',
      });
      
      // Initialize TTS
      const rawTtsProvider = this.tenantConfig?.ttsProvider;
      const ttsProvider = rawTtsProvider?.toLowerCase() || 'elevenlabs';
      log.info('Initializing TTS', { rawTtsProvider, ttsProvider, callId: this.callId });
      this.tts = createTTSAdapter(ttsProvider, {
        voiceId: this.tenantConfig?.voiceId,
      });
      
      // Initialize Dialog Manager (LLM) - force Gemini (free tier available)
      // To use OpenAI, change 'gemini' to 'openai' below
      this.dialogManager = new DialogManager({
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        systemPrompt: this.buildSystemPrompt(),
        tenantId: this.tenantId,
      });

      // Connect ASR for real-time transcription
      await this.asr.connect();
      
      // Set up ASR event handlers
      this.asr.on('transcript', async (transcript) => {
        await this.handleTranscript(transcript);
      });

      this.asr.on('error', (error) => {
        log.error('ASR error in call agent', { error: error.message, callId: this.callId });
      });

      // Connect to LiveKit room
      await this.connectToRoom();

      log.info('CallAgent initialized', { callId: this.callId });
      return true;
    } catch (error) {
      log.error('Failed to initialize CallAgent', { error: error.message, callId: this.callId });
      throw error;
    }
  }

  /**
   * Build the system prompt from tenant configuration
   */
  buildSystemPrompt() {
    const greeting = this.tenantConfig?.greeting || "Hello! Thank you for calling. How can I help you today?";
    const businessName = this.tenantConfig?.businessName || "our business";
    const businessHours = this.tenantConfig?.businessHours || "9 AM to 5 PM, Monday through Friday";
    const customInstructions = this.tenantConfig?.customInstructions || "";

    return `You are an AI receptionist for ${businessName}. Your role is to:
- Greet callers warmly and professionally
- Answer questions about the business
- Schedule appointments when requested
- Take messages for staff members
- Transfer calls to the appropriate department when needed
- Handle common inquiries politely

Business Information:
- Business Hours: ${businessHours}
${customInstructions ? `- Additional Instructions: ${customInstructions}` : ''}

Communication Style:
- Be concise (phone conversations should be brief)
- Be helpful and professional
- Use natural conversational language
- Confirm understanding when taking messages or scheduling
- Ask clarifying questions when needed

Your greeting: "${greeting}"

Remember: This is a voice conversation, so keep responses short and natural.`;
  }

  /**
   * Process incoming audio chunk
   */
  async processAudio(audioData) {
    if (!this.asr) {
      log.warn('ASR not initialized, cannot process audio');
      return;
    }

    try {
      // Send audio to ASR for transcription
      await this.asr.processAudio(audioData);
    } catch (error) {
      log.error('Error processing audio', { error: error.message, callId: this.callId });
    }
  }

  /**
   * Handle transcript from ASR
   */
  async handleTranscript(transcript) {
    if (!transcript.text || transcript.text.trim() === '') {
      return;
    }

    // Only process final transcripts (ignore partials for response generation)
    if (!transcript.isFinal) {
      this.emit('partialTranscript', {
        text: transcript.text,
        speaker: 'user',
      });
      return;
    }

    log.info('Received final transcript', { 
      text: transcript.text, 
      callId: this.callId 
    });

    // Prevent overlapping processing
    if (this.isProcessing) {
      log.debug('Already processing, queueing transcript');
      return;
    }

    this.isProcessing = true;

    try {
      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: transcript.text,
        timestamp: new Date().toISOString(),
      });

      this.emit('transcript', {
        text: transcript.text,
        speaker: 'user',
        isFinal: true,
      });

      // Generate AI response using dialogManager.processMessage
      const response = await this.dialogManager.processMessage(transcript.text);

      // Handle function calls vs regular responses
      let responseText = null;
      if (response.type === 'function_call') {
        log.info('Function call received', { 
          function: response.functionName, 
          args: response.arguments,
          callId: this.callId 
        });
        
        // Execute the function and get result
        const functionResult = await this.executeFunctionCall(
          response.functionName, 
          response.arguments
        );
        
        // Generate follow-up response based on function result
        const followUp = await this.dialogManager.processMessage(
          `Function ${response.functionName} returned: ${JSON.stringify(functionResult)}`
        );
        responseText = followUp.content || response.assistantMessage || "I've done that for you.";
      } else if (response.type === 'response' && response.content) {
        responseText = response.content;
      }

      if (responseText) {
        // Add assistant response to history
        this.conversationHistory.push({
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
        });

        this.emit('transcript', {
          text: responseText,
          speaker: 'assistant',
          isFinal: true,
        });

        // Synthesize and play response
        await this.synthesizeAndPlay(responseText);
      }
    } catch (error) {
      log.error('Error handling transcript', { error: error.message, callId: this.callId });
      
      // Try to say an error message
      try {
        await this.synthesizeAndPlay("I'm sorry, I encountered an issue. Could you please repeat that?");
      } catch (e) {
        log.error('Failed to play error message', { error: e.message });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Synthesize text to speech and send to LiveKit
   */
  async synthesizeAndPlay(text) {
    if (!this.tts) {
      log.warn('TTS not initialized, cannot synthesize');
      return;
    }

    if (!this.audioSource) {
      log.warn('Audio source not initialized, cannot play');
      return;
    }

    try {
      log.info('Synthesizing response', { text: text.substring(0, 100), callId: this.callId });
      
      const audioBuffer = await this.tts.synthesize(text);
      
      // ElevenLabs now returns PCM 24kHz 16-bit signed integer
      // Split into 20ms frames (480 samples per frame at 24kHz)
      const sampleRate = 24000;
      const frameDurationMs = 20;
      const samplesPerFrame = (sampleRate * frameDurationMs) / 1000; // 480 samples
      const bytesPerSample = 2; // 16-bit = 2 bytes
      const bytesPerFrame = samplesPerFrame * bytesPerSample; // 960 bytes per frame
      
      // Emit for any listeners
      this.emit('audio', {
        data: audioBuffer,
        format: 'pcm',
        sampleRate: sampleRate,
      });
      
      // Convert Buffer to Int16Array and send frames
      if (audioBuffer && audioBuffer.length > 0) {
        const totalSamples = Math.floor(audioBuffer.length / bytesPerSample);
        
        // Create a clean copy to avoid Node.js Buffer pooling issues
        const uint8Copy = new Uint8Array(audioBuffer);
        const int16Array = new Int16Array(uint8Copy.buffer);
        
        log.info('Sending audio frames', { 
          totalSamples,
          expectedFrames: Math.floor(totalSamples / samplesPerFrame),
          callId: this.callId 
        });
        
        // Send frames to LiveKit
        let offset = 0;
        while (offset + samplesPerFrame <= totalSamples) {
          const frameData = int16Array.slice(offset, offset + samplesPerFrame);
          
          // Create AudioFrame and capture it
          const audioFrame = new AudioFrame(frameData, sampleRate, 1, samplesPerFrame);
          await this.audioSource.captureFrame(audioFrame);
          
          offset += samplesPerFrame;
          
          // Small delay to match real-time playback (20ms per frame)
          await new Promise(resolve => setTimeout(resolve, frameDurationMs));
        }
        
        log.info('Audio played to room', { 
          totalSamples,
          framesPlayed: Math.floor(offset / samplesPerFrame),
          callId: this.callId 
        });
      }

      log.info('Audio synthesis complete', { 
        textLength: text.length,
        audioSize: audioBuffer?.length,
        callId: this.callId 
      });
    } catch (error) {
      log.error('TTS synthesis error', { error: error.message, callId: this.callId });
      throw error;
    }
  }

  /**
   * Execute LLM function calls and return results
   */
  async executeFunctionCall(functionName, args) {
    log.info('Executing function', { functionName, args, callId: this.callId });
    const db = getDatabase();

    try {
      switch (functionName) {
        case 'create_booking': {
          // Create booking in database
          const booking = await db.booking.create({
            data: {
              tenantId: this.tenantId,
              callId: this.callId,
              title: args.title,
              scheduledAt: this.parseDateTime(args.date, args.time),
              durationMinutes: args.duration || 30,
              contactName: args.contactName,
              contactEmail: args.contactEmail || null,
              contactPhone: args.contactPhone || null,
              status: 'CONFIRMED',
            },
          });

          // Try to create Google Calendar event if configured
          if (this.tenantConfig?.googleCalendarEnabled && this.tenantConfig?.googleRefreshToken) {
            try {
              await createGoogleCalendarEvent(this.tenantConfig, {
                title: args.title,
                startTime: booking.scheduledAt,
                durationMinutes: booking.durationMinutes,
                attendeeName: args.contactName,
                attendeeEmail: args.contactEmail,
                description: `Booked via AI receptionist - Call ID: ${this.callId}`,
              });
              log.info('Google Calendar event created for booking', { bookingId: booking.id });
            } catch (calErr) {
              log.warn('Failed to create Google Calendar event', { error: calErr.message });
            }
          }

          this.emit('action', { type: 'booking_created', data: booking });
          return { success: true, bookingId: booking.id, message: `Booking confirmed for ${args.contactName} on ${args.date} at ${args.time}` };
        }

        case 'cancel_booking': {
          const booking = await db.booking.findFirst({
            where: {
              tenantId: this.tenantId,
              OR: [
                { id: args.bookingReference },
                { contactName: { contains: args.bookingReference, mode: 'insensitive' } },
              ],
            },
          });

          if (!booking) {
            return { success: false, message: 'Booking not found' };
          }

          await db.booking.update({
            where: { id: booking.id },
            data: { status: 'CANCELLED', notes: args.reason },
          });

          this.emit('action', { type: 'booking_cancelled', data: booking });
          return { success: true, message: 'Booking has been cancelled' };
        }

        case 'check_availability': {
          // Check if Google Calendar is configured
          if (this.tenantConfig?.googleCalendarEnabled && this.tenantConfig?.googleRefreshToken) {
            try {
              const slots = await getAvailableSlots(this.tenantConfig, new Date(args.date), 30);
              return { 
                success: true, 
                availableSlots: slots.slice(0, 5).map(s => s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })),
                message: `Available times on ${args.date}: ${slots.slice(0, 5).map(s => s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })).join(', ')}`
              };
            } catch (calErr) {
              log.warn('Failed to check calendar availability', { error: calErr.message });
            }
          }
          // Fallback: return generic availability
          return { 
            success: true, 
            message: 'We have availability throughout the day. What time works best for you?' 
          };
        }

        case 'transfer_to_agent': {
          await this.escalateCall({ reason: args.reason, department: args.department, urgency: args.urgency });
          return { success: true, message: 'Transferring you to a human agent now. Please hold.' };
        }

        case 'get_business_info': {
          const info = {
            hours: this.tenantConfig?.businessHours || 'Monday-Friday 9am-5pm',
            location: this.tenantConfig?.businessAddress || 'Contact us for location details',
            services: this.tenantConfig?.businessDescription || 'We offer a variety of services',
            contact: this.tenantConfig?.businessPhone || 'Please leave a message and we will call you back',
            general: this.tenantConfig?.businessName || 'Thank you for your interest in our business',
          };
          return { success: true, info: info[args.infoType] || info.general };
        }

        case 'leave_message': {
          await this.takeMessage({ 
            message: args.message, 
            callerName: args.callerName, 
            callbackNumber: args.callbackNumber,
            urgency: args.urgency 
          });
          return { success: true, message: 'Your message has been recorded. Someone will get back to you soon.' };
        }

        case 'send_text_message': {
          // Send an SMS during an active call
          try {
            const { sendSMS } = await import('../services/twilio.js');
            
            // Find the tenant's active phone number
            const phoneRecord = await db.phoneNumber.findFirst({
              where: { tenantId: this.tenantId, status: 'ACTIVE', smsEnabled: true },
            });

            if (!phoneRecord) {
              return { success: false, message: 'No SMS-enabled phone number is configured. Unable to send text message.' };
            }

            const message = await sendSMS({
              to: args.phoneNumber,
              body: args.message,
              phoneNumberId: phoneRecord.id,
              tenantId: this.tenantId,
              callId: this.callId,
              metadata: { context: args.context || 'call', sentByAI: true },
            });

            this.emit('action', { type: 'sms_sent', data: { messageId: message.id, to: args.phoneNumber } });
            log.info('SMS sent during call', { callId: this.callId, messageId: message.id, to: args.phoneNumber });
            return { success: true, message: `Text message sent to ${args.phoneNumber} successfully.` };
          } catch (smsErr) {
            log.error('Failed to send SMS during call', { error: smsErr.message, callId: this.callId });
            return { success: false, message: 'Sorry, I was unable to send the text message at this time.' };
          }
        }

        default:
          log.warn('Unknown function call', { functionName });
          return { success: false, message: 'I cannot perform that action' };
      }
    } catch (error) {
      log.error('Function execution error', { functionName, error: error.message, callId: this.callId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse date and time strings into a Date object
   */
  parseDateTime(dateStr, timeStr) {
    // Handle natural language dates
    const today = new Date();
    let targetDate = today;

    if (dateStr.toLowerCase() === 'today') {
      targetDate = today;
    } else if (dateStr.toLowerCase() === 'tomorrow') {
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dateStr.toLowerCase().includes('next')) {
      // Handle "next Monday", "next week", etc.
      const dayMatch = dateStr.toLowerCase().match(/next\s+(\w+)/);
      if (dayMatch) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(dayMatch[1].toLowerCase());
        if (targetDay !== -1) {
          targetDate = new Date(today);
          const daysUntil = (targetDay - today.getDay() + 7) % 7 || 7;
          targetDate.setDate(targetDate.getDate() + daysUntil);
        }
      }
    } else {
      // Try to parse as a date string
      targetDate = new Date(dateStr);
    }

    // Parse time
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2] || '0', 10);
      const period = timeMatch[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      targetDate.setHours(hours, minutes, 0, 0);
    }

    return targetDate;
  }

  /**
   * Handle special actions from the LLM (scheduling, escalation, etc.)
   */
  async handleActions(actions) {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'schedule_appointment':
            await this.scheduleAppointment(action.data);
            break;
          case 'take_message':
            await this.takeMessage(action.data);
            break;
          case 'escalate':
            await this.escalateCall(action.data);
            break;
          case 'end_call':
            await this.endCall(action.data);
            break;
          default:
            log.warn('Unknown action type', { type: action.type });
        }
      } catch (error) {
        log.error('Error handling action', { action: action.type, error: error.message });
      }
    }
  }

  /**
   * Schedule an appointment (integration with calendar)
   */
  async scheduleAppointment(data) {
    log.info('Scheduling appointment', { data, callId: this.callId });
    // TODO: Integrate with Google Calendar service
    this.emit('action', { type: 'schedule_appointment', data });
  }

  /**
   * Take a message for staff
   */
  async takeMessage(data) {
    log.info('Taking message', { data, callId: this.callId });
    
    const db = getDatabase();
    await db.call.update({
      where: { id: this.callId },
      data: {
        notes: data.message,
        outcome: 'MESSAGE_TAKEN',
      },
    });

    this.emit('action', { type: 'take_message', data });
  }

  /**
   * Escalate call to human
   */
  async escalateCall(data) {
    log.info('Escalating call', { data, callId: this.callId });
    
    const db = getDatabase();
    
    // Get the call details
    const call = await db.call.findUnique({
      where: { id: this.callId },
    });

    // Update call status to ESCALATED
    await db.call.update({
      where: { id: this.callId },
      data: {
        status: 'ESCALATED',
        notes: data.reason || 'Customer requested to speak with a human',
        escalatedAt: new Date(),
      },
    });

    // Notify all agents in the tenant via WebSocket
    emitToTenant(this.tenantId, 'call:escalated', {
      callId: this.callId,
      roomName: this.roomName,
      callerName: call?.callerName || 'Unknown',
      reason: data.reason || 'Customer requested to speak with a human',
      department: data.department || 'general',
      urgency: data.urgency || 'normal',
      timestamp: new Date().toISOString(),
    });

    // Send email notifications to agents (async, don't block)
    this.sendEscalationEmails(call, data).catch(err => {
      log.error('Failed to send escalation emails', { error: err.message });
    });

    this.emit('action', { type: 'escalate', data });
  }

  /**
   * Send email notifications to agents for escalation
   */
  async sendEscalationEmails(call, escalationData) {
    try {
      const { sendEscalationNotification } = await import('./email.js');
      const db = getDatabase();
      
      // Get all agents/admins for this tenant
      const agents = await db.user.findMany({
        where: {
          tenantId: this.tenantId,
          role: { in: ['TENANT_ADMIN', 'AGENT'] },
        },
        select: { id: true, email: true, displayName: true },
      });

      if (agents.length > 0) {
        await sendEscalationNotification(agents, {
          callerName: call?.callerName,
          callerPhone: call?.callerPhone,
          reason: escalationData.reason,
        }, this.tenantConfig);
      }
    } catch (error) {
      log.error('Error sending escalation emails', { error: error.message });
    }
  }

  /**
   * End the call
   */
  async endCall(data) {
    log.info('Ending call', { reason: data?.reason, callId: this.callId });
    this.emit('action', { type: 'end_call', data });
    await this.cleanup();
  }

  /**
   * Say the initial greeting
   */
  async sayGreeting() {
    const greeting = this.tenantConfig?.greeting || 
      "Hello! Thank you for calling. How can I help you today?";
    
    this.conversationHistory.push({
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    });

    this.emit('transcript', {
      text: greeting,
      speaker: 'assistant',
      isFinal: true,
    });

    await this.synthesizeAndPlay(greeting);
  }

  /**
   * Generate a post-call summary using LLM
   */
  async generatePostCallSummary() {
    if (!this.conversationHistory.length) {
      log.info('No conversation history, skipping post-call summary', { callId: this.callId });
      return null;
    }

    try {
      const transcript = this.conversationHistory
        .map(msg => `${msg.role === 'assistant' ? 'Receptionist' : 'Caller'}: ${msg.content}`)
        .join('\n');

      const prompt = `Analyze this phone call transcript and provide a JSON response with the following fields:
- summary: A concise 2-3 sentence summary of the call
- disposition: One of [ANSWERED, VOICEMAIL, MISSED, ABANDONED, TRANSFERRED, ESCALATED, BOOKED, MESSAGE_TAKEN, INFO_PROVIDED, SPAM, FOLLOW_UP_NEEDED]
- sentiment: One of [positive, neutral, negative]
- primaryIntent: The main reason the caller called (e.g., "schedule appointment", "billing inquiry", "general info")
- intents: Array of all detected intents
- actionItems: Array of follow-up actions needed
- keyEntities: Object with extracted entities like name, phone, email, dates mentioned

Transcript:
${transcript}

Respond ONLY with valid JSON, no markdown.`;

      let summaryData;

      // Use the same LLM provider configured for the dialog
      const llmProvider = this.tenantConfig?.llmProvider || 'OPENAI';
      
      if (llmProvider === 'OPENAI') {
        const apiKey = process.env.OPENAI_API_KEY || this.tenantConfig?.llmApiKeyEncrypted;
        if (!apiKey) throw new Error('No OpenAI API key');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
        const result = await response.json();
        summaryData = JSON.parse(result.choices[0].message.content);
      } else {
        // Gemini
        const apiKey = process.env.GEMINI_API_KEY || this.tenantConfig?.llmApiKeyEncrypted;
        if (!apiKey) throw new Error('No Gemini API key');

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
            }),
          }
        );

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        summaryData = JSON.parse(text);
      }

      // Update the call record with summary data
      const db = getDatabase();
      await db.call.update({
        where: { id: this.callId },
        data: {
          summary: summaryData.summary || null,
          disposition: summaryData.disposition || 'ANSWERED',
          sentiment: summaryData.sentiment || 'neutral',
          primaryIntent: summaryData.primaryIntent || null,
          intents: summaryData.intents || [],
          notes: summaryData.actionItems?.length
            ? `Action items: ${summaryData.actionItems.join('; ')}`
            : undefined,
          metadata: {
            transcript: this.conversationHistory,
            postCallAnalysis: summaryData,
          },
        },
      });

      log.info('Post-call summary generated', {
        callId: this.callId,
        disposition: summaryData.disposition,
        sentiment: summaryData.sentiment,
      });

      return summaryData;
    } catch (error) {
      log.error('Failed to generate post-call summary', { error: error.message, callId: this.callId });
      return null;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    log.info('Cleaning up CallAgent', { callId: this.callId });

    try {
      if (this.asr) {
        await this.asr.disconnect();
      }
    } catch (error) {
      log.error('Error disconnecting ASR', { error: error.message });
    }

    // Disconnect from LiveKit room
    try {
      if (this.room) {
        await this.room.disconnect();
        this.room = null;
        this.audioSource = null;
        this.audioTrack = null;
      }
    } catch (error) {
      log.error('Error disconnecting from room', { error: error.message });
    }

    // Save conversation transcript to call record
    try {
      // Generate post-call summary (non-blocking, but we await here for data)
      const summaryData = await this.generatePostCallSummary().catch(err => {
        log.error('Post-call summary generation failed during cleanup', { error: err.message });
        return null;
      });

      const db = getDatabase();
      await db.call.update({
        where: { id: this.callId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          durationSeconds: Math.floor(
            (Date.now() - new Date(this.conversationHistory[0]?.timestamp || Date.now()).getTime()) / 1000
          ),
          // Only override metadata if summary didn't already set it
          ...(!summaryData && {
            metadata: {
              transcript: this.conversationHistory,
            },
          }),
        },
      });
    } catch (error) {
      log.error('Error saving call transcript', { error: error.message, callId: this.callId });
    }

    this.removeAllListeners();
  }
}

/**
 * CallAgentManager - Manages all active call agents
 */
export class CallAgentManager {
  constructor() {
    this.agents = new Map();
    this.roomService = null;
  }

  initialize() {
    // Initialize LiveKit Room Service client
    this.roomService = new RoomServiceClient(
      config.livekit.url,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );
    
    log.info('CallAgentManager initialized');
  }

  /**
   * Start a new call agent for a call
   */
  async startAgent(callId, roomName, tenantId) {
    if (this.agents.has(callId)) {
      log.warn('Agent already exists for call', { callId });
      return this.agents.get(callId);
    }

    try {
      // Get tenant configuration
      const db = getDatabase();
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        include: { config: true },
      });

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      const agent = new CallAgent({
        callId,
        tenantId,
        roomName,
        tenantConfig: tenant.config,
      });

      // Initialize the AI pipeline
      await agent.initialize();

      // Store agent reference
      this.agents.set(callId, agent);

      // Set up cleanup on agent end
      agent.on('action', async (action) => {
        if (action.type === 'end_call') {
          this.agents.delete(callId);
        }
      });

      // Say initial greeting after short delay
      setTimeout(() => {
        agent.sayGreeting().catch(err => {
          log.error('Error saying greeting', { error: err.message, callId });
        });
      }, 1000);

      log.info('Call agent started', { callId, roomName, tenantId });
      return agent;
    } catch (error) {
      log.error('Failed to start call agent', { 
        error: error.message, 
        callId, 
        roomName 
      });
      throw error;
    }
  }

  /**
   * Get agent for a call
   */
  getAgent(callId) {
    return this.agents.get(callId);
  }

  /**
   * Stop and cleanup an agent
   */
  async stopAgent(callId) {
    const agent = this.agents.get(callId);
    if (agent) {
      await agent.cleanup();
      this.agents.delete(callId);
      log.info('Call agent stopped', { callId });
    }
  }

  /**
   * Stop all agents (for shutdown)
   */
  async stopAll() {
    for (const [callId, agent] of this.agents) {
      await agent.cleanup();
    }
    this.agents.clear();
    log.info('All call agents stopped');
  }
}

// Singleton instance
export const callAgentManager = new CallAgentManager();

export default {
  CallAgent,
  CallAgentManager,
  callAgentManager,
};
