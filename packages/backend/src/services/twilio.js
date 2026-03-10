/**
 * Twilio Service
 * Handles phone number provisioning, SMS, and voice call routing
 */

import twilio from 'twilio';
import config from '../config/index.js';
import { logger } from '../lib/logger.js';
import { getDatabase } from '../db/index.js';

let twilioClient = null;

/**
 * Get or create Twilio client singleton
 */
function getClient() {
  if (!twilioClient) {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
    }
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return twilioClient;
}

// ============================================
// Phone Number Management
// ============================================

/**
 * Search available phone numbers by country, area code, or capabilities
 * @param {Object} options
 * @param {string} options.country - ISO country code (default: 'US')
 * @param {string} [options.areaCode] - Area code filter
 * @param {string} [options.contains] - Number pattern to match (e.g., '*HELLO*')
 * @param {boolean} [options.smsEnabled] - Filter for SMS capability
 * @param {boolean} [options.voiceEnabled] - Filter for voice capability
 * @param {number} [options.limit] - Max results (default: 20)
 * @returns {Promise<Array>} Available phone numbers
 */
export async function searchAvailableNumbers({
  country = 'US',
  areaCode,
  contains,
  smsEnabled = true,
  voiceEnabled = true,
  limit = 20,
} = {}) {
  const client = getClient();

  try {
    const searchParams = {
      smsEnabled,
      voiceEnabled,
      limit,
    };

    if (areaCode) searchParams.areaCode = areaCode;
    if (contains) searchParams.contains = contains;

    const numbers = await client.availablePhoneNumbers(country)
      .local.list(searchParams);

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      locality: n.locality,
      region: n.region,
      postalCode: n.postalCode,
      country: n.isoCountry,
      capabilities: {
        voice: n.capabilities.voice,
        sms: n.capabilities.SMS,
        mms: n.capabilities.MMS,
      },
    }));
  } catch (error) {
    logger.error('Failed to search available numbers', { error: error.message, country, areaCode });
    throw error;
  }
}

/**
 * Search available toll-free numbers
 */
export async function searchTollFreeNumbers({
  country = 'US',
  contains,
  limit = 20,
} = {}) {
  const client = getClient();

  try {
    const numbers = await client.availablePhoneNumbers(country)
      .tollFree.list({ limit, ...(contains && { contains }) });

    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      friendlyName: n.friendlyName,
      country: n.isoCountry,
      capabilities: {
        voice: n.capabilities.voice,
        sms: n.capabilities.SMS,
        mms: n.capabilities.MMS,
      },
    }));
  } catch (error) {
    logger.error('Failed to search toll-free numbers', { error: error.message });
    throw error;
  }
}

/**
 * Provision (purchase) a phone number and configure webhooks
 * @param {string} phoneNumber - E.164 formatted number to purchase
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Provisioned number details
 */
export async function provisionNumber(phoneNumber, tenantId) {
  const client = getClient();
  const db = getDatabase();
  const webhookBase = config.twilio.webhookBaseUrl;

  try {
    // Purchase the number from Twilio
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber,
      voiceUrl: `${webhookBase}/api/webhooks/twilio/voice`,
      voiceMethod: 'POST',
      smsUrl: `${webhookBase}/api/webhooks/twilio/sms`,
      smsMethod: 'POST',
      statusCallback: `${webhookBase}/api/webhooks/twilio/status`,
      statusCallbackMethod: 'POST',
      friendlyName: `VoxReception - ${tenantId.slice(0, 8)}`,
    });

    // Save to database
    const phoneRecord = await db.phoneNumber.create({
      data: {
        tenantId,
        phoneNumber: purchased.phoneNumber,
        twilioSid: purchased.sid,
        friendlyName: purchased.friendlyName,
        capabilities: {
          voice: purchased.capabilities?.voice ?? true,
          sms: purchased.capabilities?.sms ?? true,
          mms: purchased.capabilities?.mms ?? false,
        },
        status: 'ACTIVE',
        monthlyCost: 1.15, // Default Twilio local number cost
      },
    });

    logger.info('Phone number provisioned', {
      phoneNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
      tenantId,
    });

    return phoneRecord;
  } catch (error) {
    logger.error('Failed to provision phone number', {
      error: error.message,
      phoneNumber,
      tenantId,
    });
    throw error;
  }
}

/**
 * Release (cancel) a phone number
 * @param {string} phoneNumberId - Database ID of the phone number
 * @param {string} tenantId - Tenant ID for authorization
 */
export async function releaseNumber(phoneNumberId, tenantId) {
  const client = getClient();
  const db = getDatabase();

  try {
    const phoneRecord = await db.phoneNumber.findFirst({
      where: { id: phoneNumberId, tenantId },
    });

    if (!phoneRecord) {
      throw new Error('Phone number not found');
    }

    // Release from Twilio
    await client.incomingPhoneNumbers(phoneRecord.twilioSid).remove();

    // Update database
    await db.phoneNumber.update({
      where: { id: phoneNumberId },
      data: { status: 'RELEASED' },
    });

    logger.info('Phone number released', {
      phoneNumber: phoneRecord.phoneNumber,
      tenantId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to release phone number', {
      error: error.message,
      phoneNumberId,
      tenantId,
    });
    throw error;
  }
}

/**
 * Bring Your Own Number (BYON)
 * Provisions a Twilio number and instructs the tenant to forward their existing number to it.
 * @param {string} businessNumber - The business's existing phone number (E.164)
 * @param {string} tenantId - Tenant ID
 * @param {Object} [options] - Optional: country, areaCode for the Twilio number
 * @returns {Promise<Object>} PhoneNumber record with forwarding instructions
 */
export async function setupBYON(businessNumber, tenantId, options = {}) {
  const client = getClient();
  const db = getDatabase();
  const webhookBase = config.twilio.webhookBaseUrl;

  try {
    // Try to find a number in the same area code as the business number
    const areaCode = options.areaCode || businessNumber.slice(2, 5); // Skip +1, take area code
    const country = options.country || (businessNumber.startsWith('+1') ? 'US' : 'US');

    let available;
    try {
      available = await client.availablePhoneNumbers(country)
        .local.list({ areaCode, limit: 1 });
    } catch (e) {
      // Fallback: any number in the country
      available = await client.availablePhoneNumbers(country)
        .local.list({ limit: 1 });
    }

    if (!available || available.length === 0) {
      throw new Error('No phone numbers available. Please try a different country or area code.');
    }

    const twilioNumber = available[0].phoneNumber;

    // Purchase the Twilio number with webhooks configured
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: twilioNumber,
      voiceUrl: `${webhookBase}/api/webhooks/twilio/voice`,
      voiceMethod: 'POST',
      smsUrl: `${webhookBase}/api/webhooks/twilio/sms`,
      smsMethod: 'POST',
      statusCallback: `${webhookBase}/api/webhooks/twilio/status`,
      statusCallbackMethod: 'POST',
      friendlyName: `BYON-${businessNumber} - ${tenantId.slice(0, 8)}`,
    });

    // Save to database with BYON metadata
    const phoneRecord = await db.phoneNumber.create({
      data: {
        tenantId,
        phoneNumber: purchased.phoneNumber,
        twilioSid: purchased.sid,
        friendlyName: `AI Line for ${businessNumber}`,
        numberType: 'byon',
        businessNumber,
        forwardingSetup: false,
        capabilities: {
          voice: purchased.capabilities?.voice ?? true,
          sms: purchased.capabilities?.sms ?? true,
          mms: purchased.capabilities?.mms ?? false,
        },
        status: 'ACTIVE',
        monthlyCost: 1.15,
      },
    });

    // Build forwarding instructions for the business
    const forwardingInstructions = buildForwardingInstructions(businessNumber, purchased.phoneNumber);

    logger.info('BYON number provisioned', {
      businessNumber,
      twilioNumber: purchased.phoneNumber,
      twilioSid: purchased.sid,
      tenantId,
    });

    return {
      ...phoneRecord,
      forwardingInstructions,
    };
  } catch (error) {
    logger.error('Failed to set up BYON', {
      error: error.message,
      businessNumber,
      tenantId,
    });
    throw error;
  }
}

/**
 * Mark BYON forwarding as confirmed by the tenant
 */
export async function confirmBYONForwarding(phoneNumberId, tenantId) {
  const db = getDatabase();
  return db.phoneNumber.update({
    where: { id: phoneNumberId, tenantId },
    data: { forwardingSetup: true },
  });
}

/**
 * Build carrier-specific forwarding instructions
 */
function buildForwardingInstructions(businessNumber, twilioNumber) {
  // Format the Twilio number for dialing (strip +)
  const dialNumber = twilioNumber.replace('+', '');

  return {
    twilioNumber,
    summary: `Forward calls from ${businessNumber} to ${twilioNumber}`,
    methods: [
      {
        name: 'Unconditional Forwarding (All Calls)',
        description: 'All incoming calls go to AI receptionist',
        steps: [
          `Open the Phone app on your mobile`,
          `Dial *72${dialNumber} and press Call`,
          `Wait for confirmation tone, then hang up`,
          `All calls to ${businessNumber} will now go to your AI receptionist`,
        ],
        undoSteps: [
          `Dial *73 and press Call to disable forwarding`,
        ],
      },
      {
        name: 'Conditional Forwarding (Unanswered/Busy)',
        description: 'Only forwards when you don\'t answer or are busy',
        steps: [
          `Open the Phone app on your mobile`,
          `Dial *71${dialNumber} and press Call (for no-answer)`,
          `Or dial *67${dialNumber} and press Call (for busy)`,
          `Calls you miss will go to your AI receptionist`,
        ],
        undoSteps: [
          `Dial *73 to cancel no-answer forwarding`,
          `Dial *82 to cancel busy forwarding (carrier-dependent)`,
        ],
      },
      {
        name: 'iPhone Settings',
        description: 'Set up via iOS Settings app',
        steps: [
          `Go to Settings → Phone → Call Forwarding`,
          `Toggle Call Forwarding ON`,
          `Enter the number: ${twilioNumber}`,
          `Go back — forwarding is now active`,
        ],
        undoSteps: [
          `Go to Settings → Phone → Call Forwarding → toggle OFF`,
        ],
      },
      {
        name: 'Android Settings',
        description: 'Set up via Android Phone settings',
        steps: [
          `Open Phone app → tap ⋮ menu → Settings`,
          `Tap "Supplementary services" or "Call forwarding"`,
          `Select "Always forward" or "Forward when unanswered"`,
          `Enter the number: ${twilioNumber}`,
          `Tap Enable / Turn On`,
        ],
        undoSteps: [
          `Go to the same settings and tap Disable / Turn Off`,
        ],
      },
      {
        name: 'Carrier Customer Service',
        description: 'Ask your carrier to set it up',
        steps: [
          `Call your carrier's customer service number`,
          `Ask them to set up call forwarding to: ${twilioNumber}`,
          `They can set it up for all calls, or only when you don't answer`,
        ],
        undoSteps: [
          `Call your carrier and ask to remove call forwarding`,
        ],
      },
    ],
  };
}

/**
 * Update phone number configuration on Twilio
 * @param {string} phoneNumberId - Database ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} updates - Fields to update
 */
export async function updateNumberConfig(phoneNumberId, tenantId, updates) {
  const client = getClient();
  const db = getDatabase();

  try {
    const phoneRecord = await db.phoneNumber.findFirst({
      where: { id: phoneNumberId, tenantId, status: 'ACTIVE' },
    });

    if (!phoneRecord) {
      throw new Error('Active phone number not found');
    }

    // Update in database
    const updated = await db.phoneNumber.update({
      where: { id: phoneNumberId },
      data: {
        friendlyName: updates.friendlyName ?? phoneRecord.friendlyName,
        forwardingNumber: updates.forwardingNumber ?? phoneRecord.forwardingNumber,
        voicemailEnabled: updates.voicemailEnabled ?? phoneRecord.voicemailEnabled,
        smsEnabled: updates.smsEnabled ?? phoneRecord.smsEnabled,
      },
    });

    // If forwarding number changed, update Twilio config
    if (updates.forwardingNumber !== undefined) {
      const webhookBase = config.twilio.webhookBaseUrl;
      await client.incomingPhoneNumbers(phoneRecord.twilioSid).update({
        voiceUrl: `${webhookBase}/api/webhooks/twilio/voice`,
        smsUrl: `${webhookBase}/api/webhooks/twilio/sms`,
      });
    }

    logger.info('Phone number config updated', { phoneNumberId, tenantId });
    return updated;
  } catch (error) {
    logger.error('Failed to update phone number config', {
      error: error.message,
      phoneNumberId,
    });
    throw error;
  }
}

// ============================================
// SMS / Messaging
// ============================================

/**
 * Send an SMS message
 * @param {Object} options
 * @param {string} options.to - Destination phone number (E.164)
 * @param {string} options.body - Message text
 * @param {string} options.phoneNumberId - Source phone number DB ID
 * @param {string} options.tenantId - Tenant ID
 * @param {string} [options.callId] - Associated call ID (if during a call)
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Promise<Object>} Message record
 */
export async function sendSMS({
  to,
  body,
  phoneNumberId,
  tenantId,
  callId = null,
  metadata = null,
}) {
  const client = getClient();
  const db = getDatabase();

  try {
    // Get the source phone number
    const phoneRecord = await db.phoneNumber.findFirst({
      where: { id: phoneNumberId, tenantId, status: 'ACTIVE', smsEnabled: true },
    });

    if (!phoneRecord) {
      throw new Error('Active SMS-enabled phone number not found');
    }

    // Send via Twilio
    const twilioMessage = await client.messages.create({
      to,
      from: phoneRecord.phoneNumber,
      body,
      statusCallback: `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/sms-status`,
    });

    // Save to database
    const message = await db.message.create({
      data: {
        tenantId,
        phoneNumberId,
        callId,
        direction: 'OUTBOUND',
        status: 'QUEUED',
        from: phoneRecord.phoneNumber,
        to,
        body,
        twilioSid: twilioMessage.sid,
        twilioStatus: twilioMessage.status,
        metadata,
      },
    });

    logger.info('SMS sent', {
      messageId: message.id,
      twilioSid: twilioMessage.sid,
      to,
      tenantId,
    });

    return message;
  } catch (error) {
    logger.error('Failed to send SMS', {
      error: error.message,
      to,
      tenantId,
    });
    throw error;
  }
}

/**
 * Handle inbound SMS webhook from Twilio
 * @param {Object} twilioBody - Twilio webhook payload
 * @returns {Promise<Object>} Created message record
 */
export async function handleInboundSMS(twilioBody) {
  const db = getDatabase();
  const { From, To, Body, MessageSid, NumMedia } = twilioBody;

  try {
    // Find the phone number in our system
    const phoneRecord = await db.phoneNumber.findUnique({
      where: { phoneNumber: To },
    });

    if (!phoneRecord) {
      logger.warn('Inbound SMS to unknown number', { to: To, from: From });
      return null;
    }

    // Collect media URLs if any
    const mediaUrls = [];
    const numMedia = parseInt(NumMedia, 10) || 0;
    for (let i = 0; i < numMedia; i++) {
      const url = twilioBody[`MediaUrl${i}`];
      if (url) mediaUrls.push(url);
    }

    // Save to database
    const message = await db.message.create({
      data: {
        tenantId: phoneRecord.tenantId,
        phoneNumberId: phoneRecord.id,
        direction: 'INBOUND',
        status: 'RECEIVED',
        from: From,
        to: To,
        body: Body || '',
        twilioSid: MessageSid,
        twilioStatus: 'received',
        mediaUrls,
      },
    });

    logger.info('Inbound SMS received', {
      messageId: message.id,
      from: From,
      to: To,
      tenantId: phoneRecord.tenantId,
    });

    return message;
  } catch (error) {
    logger.error('Failed to handle inbound SMS', {
      error: error.message,
      from: From,
      to: To,
    });
    throw error;
  }
}

/**
 * Update message status from Twilio status callback
 * @param {Object} statusBody - Twilio status webhook payload
 */
export async function updateMessageStatus(statusBody) {
  const db = getDatabase();
  const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = statusBody;

  try {
    const statusMap = {
      queued: 'QUEUED',
      sent: 'SENT',
      delivered: 'DELIVERED',
      failed: 'FAILED',
      undelivered: 'FAILED',
    };

    await db.message.updateMany({
      where: { twilioSid: MessageSid },
      data: {
        status: statusMap[MessageStatus] || 'QUEUED',
        twilioStatus: MessageStatus,
        errorCode: ErrorCode || null,
        errorMessage: ErrorMessage || null,
      },
    });

    logger.debug('Message status updated', { messageSid: MessageSid, status: MessageStatus });
  } catch (error) {
    logger.error('Failed to update message status', {
      error: error.message,
      messageSid: MessageSid,
    });
  }
}

// ============================================
// Voice Call Handling
// ============================================

/**
 * Generate TwiML for incoming voice calls
 * Routes to the appropriate tenant's AI receptionist
 * @param {Object} twilioBody - Twilio voice webhook payload
 * @returns {string} TwiML response
 */
export function generateVoiceResponse(twilioBody) {
  const { VoiceResponse } = twilio.twiml;
  const response = new VoiceResponse();
  
  // The actual call routing is handled by the webhook handler
  // This generates a default response for fallback
  response.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    'Thank you for calling. Please hold while we connect you.'
  );
  response.pause({ length: 1 });

  return response.toString();
}

/**
 * Generate TwiML to connect caller to a LiveKit room via SIP
 * @param {string} roomName - LiveKit room name
 * @param {Object} [options] - Additional options
 * @returns {string} TwiML response
 */
export function generateConnectToRoomTwiML(roomName, options = {}) {
  const { VoiceResponse } = twilio.twiml;
  const response = new VoiceResponse();

  // Optionally play a greeting first
  if (options.greeting) {
    response.say(
      { voice: options.voice || 'Polly.Joanna', language: options.language || 'en-US' },
      options.greeting
    );
  }

  // Connect to LiveKit room via SIP trunk
  if (options.sipUri) {
    const dial = response.dial({
      callerId: options.callerId,
      timeout: 30,
    });
    dial.sip(options.sipUri);
  } else {
    // Default: stream audio to our WebSocket for processing
    const connect = response.connect();
    connect.stream({
      url: `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/stream`,
      name: roomName,
    });
  }

  return response.toString();
}

/**
 * Generate TwiML to forward a call to another number
 * @param {string} forwardingNumber - Number to forward to
 * @param {string} [callerId] - Caller ID to display
 * @returns {string} TwiML response
 */
export function generateForwardTwiML(forwardingNumber, callerId) {
  const { VoiceResponse } = twilio.twiml;
  const response = new VoiceResponse();

  response.say(
    { voice: 'Polly.Joanna' },
    'Please hold while we transfer your call.'
  );

  const dial = response.dial({
    callerId,
    timeout: 30,
    action: `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/dial-status`,
  });
  dial.number(forwardingNumber);

  return response.toString();
}

/**
 * Generate TwiML for voicemail
 * @param {string} tenantId - Tenant ID for recording URL
 * @returns {string} TwiML response
 */
export function generateVoicemailTwiML(tenantId) {
  const { VoiceResponse } = twilio.twiml;
  const response = new VoiceResponse();

  response.say(
    { voice: 'Polly.Joanna' },
    'No one is available to take your call. Please leave a message after the beep.'
  );

  response.record({
    maxLength: 120,
    action: `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/voicemail?tenantId=${tenantId}`,
    transcribe: true,
    transcribeCallback: `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/voicemail-transcription`,
    playBeep: true,
  });

  // Fallback if caller doesn't record
  response.say('We did not receive a recording. Goodbye.');

  return response.toString();
}

/**
 * Validate that a Twilio webhook request is authentic
 * @param {string} signature - X-Twilio-Signature header
 * @param {string} url - Full URL of the webhook
 * @param {Object} params - Request body params
 * @returns {boolean} Whether the request is valid
 */
export function validateWebhookSignature(signature, url, params) {
  if (config.env === 'development') {
    return true; // Skip validation in development
  }
  return twilio.validateRequest(
    config.twilio.authToken,
    signature,
    url,
    params
  );
}

export default {
  searchAvailableNumbers,
  searchTollFreeNumbers,
  provisionNumber,
  releaseNumber,
  setupBYON,
  confirmBYONForwarding,
  updateNumberConfig,
  sendSMS,
  handleInboundSMS,
  updateMessageStatus,
  generateVoiceResponse,
  generateConnectToRoomTwiML,
  generateForwardTwiML,
  generateVoicemailTwiML,
  validateWebhookSignature,
};
