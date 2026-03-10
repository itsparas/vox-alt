/**
 * Twilio Media Stream Handler
 * 
 * Handles the WebSocket connection from Twilio's <Connect><Stream> TwiML.
 * Bridges phone audio to the AI receptionist pipeline:
 *   Twilio (mulaw 8kHz) → decode → ASR (Deepgram, 16kHz PCM) → LLM → TTS (ElevenLabs, 24kHz PCM) → encode → Twilio (mulaw 8kHz)
 */

import { createASRAdapter } from './asr.js';
import { createTTSAdapter } from './tts.js';
import { DialogManager } from './dialogManager.js';
import { emitToTenant, broadcastTranscriptSegment, broadcastCallStatus } from '../websocket/index.js';
import config from '../config/index.js';
import { logger as log } from '../lib/logger.js';
import { getDatabase } from '../db/index.js';
import EventEmitter from 'events';

// ──────────────────────────────────────────────
// Audio conversion helpers
// ──────────────────────────────────────────────

// µ-law decoding table (standard ITU-T G.711)
const MULAW_DECODE_TABLE = new Int16Array(256);
(function buildMulawDecodeTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xFF;
    const sign = mu & 0x80;
    mu &= 0x7F;
    mu = ((mu << 1) | 1) << ((mu >> 4) + 2);
    mu -= 0x21;
    MULAW_DECODE_TABLE[i] = sign ? -mu : mu;
  }
})();

/**
 * Decode µ-law bytes to 16-bit linear PCM samples (8 kHz).
 * @param {Buffer} mulawBuffer
 * @returns {Int16Array} PCM samples at 8 kHz
 */
function decodeMulaw(mulawBuffer) {
  const pcm = new Int16Array(mulawBuffer.length);
  for (let i = 0; i < mulawBuffer.length; i++) {
    pcm[i] = MULAW_DECODE_TABLE[mulawBuffer[i]];
  }
  return pcm;
}

/**
 * Encode 16-bit linear PCM samples to µ-law bytes.
 * @param {Int16Array} pcmSamples
 * @returns {Buffer} µ-law encoded bytes
 */
function encodeMulaw(pcmSamples) {
  const out = Buffer.alloc(pcmSamples.length);
  for (let i = 0; i < pcmSamples.length; i++) {
    out[i] = linearToMulaw(pcmSamples[i]);
  }
  return out;
}

/**
 * Convert a single 16-bit PCM sample to µ-law.
 */
function linearToMulaw(sample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  const sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; exponent--, mask >>= 1);
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const byte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return byte;
}

/**
 * Upsample PCM from srcRate to dstRate using simple linear interpolation.
 * @param {Int16Array} samples
 * @param {number} srcRate
 * @param {number} dstRate
 * @returns {Int16Array}
 */
function resampleLinear(samples, srcRate, dstRate) {
  if (srcRate === dstRate) return samples;
  const ratio = srcRate / dstRate;
  const outLen = Math.round(samples.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, samples.length - 1);
    const frac = srcIdx - lo;
    out[i] = Math.round(samples[lo] * (1 - frac) + samples[hi] * frac);
  }
  return out;
}

/**
 * Downsample PCM from srcRate to dstRate using simple decimation with averaging.
 * @param {Int16Array} samples
 * @param {number} srcRate
 * @param {number} dstRate
 * @returns {Int16Array}
 */
function downsample(samples, srcRate, dstRate) {
  if (srcRate === dstRate) return samples;
  const ratio = srcRate / dstRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.round(i * ratio);
    out[i] = samples[Math.min(srcIdx, samples.length - 1)];
  }
  return out;
}

// ──────────────────────────────────────────────
// TwilioStreamHandler class
// ──────────────────────────────────────────────

/**
 * Handles a single Twilio Media Stream WebSocket connection.
 * Manages the full audio pipeline: receive → ASR → LLM → TTS → respond.
 */
export class TwilioStreamHandler extends EventEmitter {
  /**
   * @param {WebSocket} ws - The raw WebSocket from the HTTP upgrade
   * @param {object} callRecord - Prisma Call record for this call
   * @param {object} tenant - Tenant record with config
   */
  constructor(ws, callRecord, tenant) {
    super();
    this.ws = ws;
    this.callId = callRecord.id;
    this.tenantId = tenant.id;
    this.roomName = callRecord.livekitRoom;
    this.tenantConfig = tenant.config || {};
    this.tenant = tenant;

    // Twilio stream metadata
    this.streamSid = null;
    this.twilioCallSid = callRecord.metadata?.twilioCallSid || null;

    // AI pipeline components
    this.asr = null;
    this.tts = null;
    this.dialogManager = null;

    // State
    this.isProcessing = false;
    this.conversationHistory = [];
    this.isActive = true;
    this.hasGreeted = false;

    log.info('TwilioStreamHandler created', {
      callId: this.callId,
      tenantId: this.tenantId,
      roomName: this.roomName,
    });
  }

  /**
   * Start handling the WebSocket connection
   */
  async start() {
    try {
      // Initialize AI pipeline
      await this.initializePipeline();

      // Set up WebSocket message handler
      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => this.handleClose(code, reason));
      this.ws.on('error', (err) => this.handleError(err));

      log.info('TwilioStreamHandler started', { callId: this.callId });
    } catch (error) {
      log.error('Failed to start TwilioStreamHandler', {
        error: error.message,
        callId: this.callId,
      });
      this.ws.close();
    }
  }

  /**
   * Initialize ASR, TTS, and DialogManager
   */
  async initializePipeline() {
    // ASR — Deepgram streaming
    const asrProvider = this.tenantConfig?.asrProvider?.toLowerCase() || 'deepgram';
    this.asr = createASRAdapter(asrProvider, {
      language: this.tenantConfig?.language || 'en-US',
    });

    // TTS — ElevenLabs (returns PCM 24 kHz)
    const ttsProvider = this.tenantConfig?.ttsProvider?.toLowerCase() || 'elevenlabs';
    this.tts = createTTSAdapter(ttsProvider, {
      voiceId: this.tenantConfig?.voiceId,
    });

    // LLM — Gemini by default
    this.dialogManager = new DialogManager({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      tenantConfig: this.tenantConfig,
      tenantId: this.tenantId,
    });

    // Initialize LLM (loads FAQ context, etc.)
    await this.dialogManager.initialize();

    // Connect ASR
    await this.asr.connect();

    // ASR event: final transcript
    this.asr.on('transcript', async (transcript) => {
      await this.handleTranscript(transcript);
    });

    // ASR event: partial transcript (for live display)
    this.asr.on('partial', (partial) => {
      broadcastTranscriptSegment(this.callId, {
        speaker: 'caller',
        text: partial.text,
        isFinal: false,
        timestamp: new Date().toISOString(),
      });
    });

    this.asr.on('error', (err) => {
      log.error('ASR error in TwilioStreamHandler', {
        error: err.message,
        callId: this.callId,
      });
    });

    // Update call status
    const db = getDatabase();
    await db.call.update({
      where: { id: this.callId },
      data: { status: 'ACTIVE', startedAt: new Date() },
    });

    broadcastCallStatus(this.callId, this.tenantId, 'ACTIVE');

    log.info('AI pipeline initialized for Twilio stream', { callId: this.callId });
  }

  /**
   * Handle incoming WebSocket messages from Twilio
   */
  handleMessage(raw) {
    try {
      const msg = JSON.parse(raw);

      switch (msg.event) {
        case 'connected':
          log.info('Twilio stream connected', { callId: this.callId });
          break;

        case 'start':
          this.handleStreamStart(msg.start);
          break;

        case 'media':
          this.handleMedia(msg.media);
          break;

        case 'mark':
          this.handleMark(msg.mark);
          break;

        case 'stop':
          this.handleStreamStop(msg.stop);
          break;

        default:
          log.debug('Unknown Twilio stream event', { event: msg.event });
      }
    } catch (err) {
      log.error('Failed to parse Twilio stream message', { error: err.message });
    }
  }

  /**
   * Handle 'start' event — Twilio tells us about the stream
   */
  handleStreamStart(start) {
    this.streamSid = start.streamSid;
    this.twilioCallSid = start.callSid;

    log.info('Twilio media stream started', {
      streamSid: this.streamSid,
      callSid: this.twilioCallSid,
      tracks: start.tracks,
      mediaFormat: start.mediaFormat,
      callId: this.callId,
    });

    // Send initial greeting via TTS after a short delay
    if (!this.hasGreeted) {
      this.hasGreeted = true;
      // Small delay to ensure the stream is ready
      setTimeout(() => this.sendGreeting(), 500);
    }
  }

  /**
   * Handle 'media' event — incoming audio from caller
   */
  handleMedia(media) {
    if (!this.asr || !this.isActive) return;

    // media.payload is base64-encoded µ-law audio at 8 kHz
    const mulawBytes = Buffer.from(media.payload, 'base64');

    // Decode µ-law → 16-bit PCM (8 kHz)
    const pcm8k = decodeMulaw(mulawBytes);

    // Upsample 8 kHz → 16 kHz for Deepgram
    const pcm16k = resampleLinear(pcm8k, 8000, 16000);

    // Send to ASR as Buffer (Deepgram expects linear16 bytes)
    const pcmBuffer = Buffer.from(pcm16k.buffer, pcm16k.byteOffset, pcm16k.byteLength);
    this.asr.sendAudio(pcmBuffer);
  }

  /**
   * Handle 'mark' event — Twilio finished playing audio we sent
   */
  handleMark(mark) {
    log.debug('Twilio mark received', { name: mark.name, callId: this.callId });
    this.emit('markPlayed', mark.name);
  }

  /**
   * Handle 'stop' event — stream ended
   */
  handleStreamStop(stop) {
    log.info('Twilio media stream stopped', {
      callId: this.callId,
      accountSid: stop?.accountSid,
    });
    this.cleanup();
  }

  /**
   * Send the AI greeting to the caller via TTS
   */
  async sendGreeting() {
    const greeting = this.tenantConfig?.welcomeMessage
      || `Thank you for calling ${this.tenant.name || 'us'}. How can I help you today?`;

    // Push greeting to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    });

    broadcastTranscriptSegment(this.callId, {
      speaker: 'assistant',
      text: greeting,
      isFinal: true,
      timestamp: new Date().toISOString(),
    });

    // Initialize the dialog with the greeting so the LLM knows what was said
    try {
      // Prime the LLM conversation with the greeting context
      await this.dialogManager.processMessage(
        `[System: You just greeted the caller with: "${greeting}". Wait for their response.]`
      );
    } catch (err) {
      log.warn('Failed to prime LLM with greeting context', { error: err.message });
    }

    await this.synthesizeAndSend(greeting);
  }

  /**
   * Handle a final transcript from ASR
   */
  async handleTranscript(transcript) {
    if (!transcript.text || transcript.text.trim() === '') return;
    if (!transcript.isFinal) return;

    log.info('Received caller transcript', {
      text: transcript.text,
      callId: this.callId,
    });

    // Broadcast for live UI
    broadcastTranscriptSegment(this.callId, {
      speaker: 'caller',
      text: transcript.text,
      isFinal: true,
      timestamp: new Date().toISOString(),
    });

    // Prevent overlapping LLM requests
    if (this.isProcessing) {
      log.debug('Already processing, skipping transcript', { callId: this.callId });
      return;
    }

    this.isProcessing = true;

    try {
      // Track in conversation history
      this.conversationHistory.push({
        role: 'user',
        content: transcript.text,
        timestamp: new Date().toISOString(),
      });

      // Get AI response
      const response = await this.dialogManager.processMessage(transcript.text);
      let responseText = null;

      if (response.type === 'function_call') {
        log.info('Function call from LLM during phone call', {
          function: response.functionName,
          callId: this.callId,
        });

        const result = await this.executeFunctionCall(response.functionName, response.arguments);
        const followUp = await this.dialogManager.processMessage(
          `Function ${response.functionName} returned: ${JSON.stringify(result)}`
        );
        responseText = followUp.content || response.assistantMessage || "I've done that for you.";
      } else if (response.type === 'response' && response.content) {
        responseText = response.content;
      }

      if (responseText) {
        this.conversationHistory.push({
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
        });

        broadcastTranscriptSegment(this.callId, {
          speaker: 'assistant',
          text: responseText,
          isFinal: true,
          timestamp: new Date().toISOString(),
        });

        await this.synthesizeAndSend(responseText);
      }
    } catch (error) {
      log.error('Error processing transcript in Twilio call', {
        error: error.message,
        callId: this.callId,
      });
      try {
        await this.synthesizeAndSend("I'm sorry, I had trouble understanding. Could you repeat that?");
      } catch (e) {
        log.error('Failed to send error response', { error: e.message });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Synthesize text → TTS audio → encode to µ-law → send to Twilio
   */
  async synthesizeAndSend(text) {
    if (!this.tts || !this.streamSid || !this.isActive) return;

    try {
      log.info('Synthesizing response for caller', {
        text: text.substring(0, 80),
        callId: this.callId,
      });

      // Get raw PCM audio from TTS (24 kHz, 16-bit signed LE)
      const audioBuffer = await this.tts.synthesize(text);

      if (!audioBuffer || audioBuffer.length === 0) {
        log.warn('TTS returned empty audio', { callId: this.callId });
        return;
      }

      // Convert Buffer to Int16Array (24 kHz)
      const pcm24k = new Int16Array(
        audioBuffer.buffer,
        audioBuffer.byteOffset,
        audioBuffer.byteLength / 2
      );

      // Downsample 24 kHz → 8 kHz for Twilio
      const pcm8k = downsample(pcm24k, 24000, 8000);

      // Encode to µ-law
      const mulawBytes = encodeMulaw(pcm8k);

      // Send to Twilio in chunks (Twilio expects ~20ms frames = 160 samples at 8 kHz)
      const CHUNK_SIZE = 160; // 20ms at 8 kHz
      const totalChunks = Math.ceil(mulawBytes.length / CHUNK_SIZE);
      const markName = `response-${Date.now()}`;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = mulawBytes.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const payload = chunk.toString('base64');

        const mediaMsg = JSON.stringify({
          event: 'media',
          streamSid: this.streamSid,
          media: { payload },
        });

        if (this.ws.readyState === 1) { // WebSocket.OPEN
          this.ws.send(mediaMsg);
        } else {
          log.warn('WebSocket not open, cannot send audio', { callId: this.callId });
          return;
        }
      }

      // Send a mark so we know when Twilio finished playing this response
      if (this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({
          event: 'mark',
          streamSid: this.streamSid,
          mark: { name: markName },
        }));
      }

      log.info('Audio sent to Twilio', {
        textLength: text.length,
        mulawSize: mulawBytes.length,
        chunks: totalChunks,
        callId: this.callId,
      });
    } catch (error) {
      log.error('Failed to synthesize/send audio', {
        error: error.message,
        callId: this.callId,
      });
    }
  }

  /**
   * Execute LLM function calls (booking, transfer, etc.)
   * Mirrors the CallAgent's executeFunctionCall
   */
  async executeFunctionCall(functionName, args) {
    log.info('Executing function (phone call)', { functionName, args, callId: this.callId });
    const db = getDatabase();

    try {
      switch (functionName) {
        case 'create_booking': {
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
          emitToTenant(this.tenantId, 'booking:created', booking);
          return { success: true, bookingId: booking.id, message: `Booking confirmed for ${args.contactName}` };
        }

        case 'cancel_booking': {
          const found = await db.booking.findFirst({
            where: {
              tenantId: this.tenantId,
              OR: [
                { id: args.bookingReference },
                { contactName: { contains: args.bookingReference, mode: 'insensitive' } },
              ],
            },
          });
          if (!found) return { success: false, message: 'Booking not found' };
          await db.booking.update({ where: { id: found.id }, data: { status: 'CANCELLED', notes: args.reason } });
          return { success: true, message: 'Booking cancelled' };
        }

        case 'check_availability':
          return { success: true, message: 'We have availability throughout the day. What time works best for you?' };

        case 'transfer_to_agent':
          emitToTenant(this.tenantId, 'call:attention', {
            callId: this.callId,
            reason: args.reason,
            department: args.department,
          });
          return { success: true, message: 'Transferring you to a human agent now. Please hold.' };

        case 'get_business_info': {
          const info = {
            hours: this.tenantConfig?.businessHours || 'Monday-Friday 9am-5pm',
            location: this.tenantConfig?.businessAddress || 'Contact us for location details',
            services: this.tenantConfig?.businessDescription || 'We offer a variety of services',
            contact: this.tenantConfig?.businessPhone || 'Please leave a message',
            general: this.tenantConfig?.businessName || 'Thank you for your interest',
          };
          return { success: true, info: info[args.infoType] || info.general };
        }

        case 'leave_message': {
          await db.voicemail.create({
            data: {
              tenantId: this.tenantId,
              callId: this.callId,
              callerName: args.callerName,
              callerPhone: args.callbackNumber || null,
              transcript: args.message,
              isUrgent: args.urgency === 'high',
            },
          });
          emitToTenant(this.tenantId, 'voicemail:new', { callId: this.callId, callerName: args.callerName });
          return { success: true, message: 'Your message has been recorded. Someone will get back to you soon.' };
        }

        case 'send_text_message': {
          try {
            const { sendSMS } = await import('../services/twilio.js');
            const phoneRecord = await db.phoneNumber.findFirst({
              where: { tenantId: this.tenantId, status: 'ACTIVE', smsEnabled: true },
            });
            if (!phoneRecord) return { success: false, message: 'No SMS-enabled phone number configured.' };
            await sendSMS({
              to: args.phoneNumber,
              body: args.message,
              phoneNumberId: phoneRecord.id,
              tenantId: this.tenantId,
              callId: this.callId,
              metadata: { context: args.context || 'call', sentByAI: true },
            });
            return { success: true, message: `Text message sent to ${args.phoneNumber}` };
          } catch (smsErr) {
            log.error('SMS send failed during phone call', { error: smsErr.message });
            return { success: false, message: 'Unable to send text at this time.' };
          }
        }

        default:
          return { success: false, message: 'Unknown action' };
      }
    } catch (error) {
      log.error('Function execution error (phone)', { functionName, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Parse date/time strings 
   */
  parseDateTime(dateStr, timeStr) {
    const today = new Date();
    let targetDate = today;
    if (dateStr.toLowerCase() === 'today') targetDate = today;
    else if (dateStr.toLowerCase() === 'tomorrow') {
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + 1);
    } else {
      targetDate = new Date(dateStr);
      if (isNaN(targetDate.getTime())) targetDate = today;
    }

    // Parse time
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const meridian = timeMatch[3]?.toLowerCase();
      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;
      targetDate.setHours(hours, minutes, 0, 0);
    }
    return targetDate;
  }

  /**
   * Save the transcript to the database
   */
  async saveTranscript() {
    try {
      const db = getDatabase();
      const segments = this.conversationHistory.map((msg, idx) => ({
        index: idx,
        speaker: msg.role === 'user' ? 'caller' : 'assistant',
        text: msg.content,
        timestamp: msg.timestamp,
      }));

      await db.transcript.updateMany({
        where: { callId: this.callId },
        data: { segments },
      });

      log.info('Transcript saved', { callId: this.callId, segments: segments.length });
    } catch (err) {
      log.error('Failed to save transcript', { error: err.message, callId: this.callId });
    }
  }

  /**
   * Handle WebSocket close
   */
  handleClose(code, reason) {
    log.info('Twilio stream WebSocket closed', {
      callId: this.callId,
      code,
      reason: reason?.toString(),
    });
    this.cleanup();
  }

  /**
   * Handle WebSocket error
   */
  handleError(err) {
    log.error('Twilio stream WebSocket error', {
      error: err.message,
      callId: this.callId,
    });
  }

  /**
   * Clean up all resources
   */
  async cleanup() {
    if (!this.isActive) return;
    this.isActive = false;

    log.info('Cleaning up TwilioStreamHandler', { callId: this.callId });

    // Save transcript
    await this.saveTranscript();

    // Disconnect ASR
    if (this.asr) {
      try { await this.asr.disconnect(); } catch (e) { /* ignore */ }
      this.asr = null;
    }

    // Update call record
    try {
      const db = getDatabase();
      const call = await db.call.findUnique({ where: { id: this.callId } });
      if (call && call.status === 'ACTIVE') {
        const endedAt = new Date();
        const durationSeconds = call.startedAt
          ? Math.round((endedAt - new Date(call.startedAt)) / 1000)
          : 0;

        await db.call.update({
          where: { id: this.callId },
          data: {
            status: 'COMPLETED',
            endedAt,
            durationSeconds,
          },
        });

        broadcastCallStatus(this.callId, this.tenantId, 'COMPLETED', { durationSeconds });
      }
    } catch (e) {
      log.error('Failed to update call on cleanup', { error: e.message });
    }

    this.dialogManager = null;
    this.tts = null;
    this.emit('ended', { callId: this.callId });
  }
}

// ──────────────────────────────────────────────
// Active stream registry  
// ──────────────────────────────────────────────

const activeStreams = new Map();

/**
 * Start handling a Twilio Media Stream WebSocket.
 * Called from the HTTP upgrade handler.
 * @param {WebSocket} ws
 * @param {object} callRecord - Prisma call record
 * @param {object} tenant - Tenant with config
 * @returns {TwilioStreamHandler}
 */
export function handleTwilioStream(ws, callRecord, tenant) {
  const handler = new TwilioStreamHandler(ws, callRecord, tenant);
  activeStreams.set(callRecord.id, handler);

  handler.on('ended', ({ callId }) => {
    activeStreams.delete(callId);
    log.info('Stream handler removed from registry', { callId, activeCount: activeStreams.size });
  });

  handler.start();
  return handler;
}

/**
 * Get an active stream handler by call ID.
 */
export function getActiveStream(callId) {
  return activeStreams.get(callId);
}

/**
 * Get count of active Twilio streams.
 */
export function getActiveStreamCount() {
  return activeStreams.size;
}

export default {
  TwilioStreamHandler,
  handleTwilioStream,
  getActiveStream,
  getActiveStreamCount,
};
