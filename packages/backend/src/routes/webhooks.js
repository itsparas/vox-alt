/**
 * Webhook Routes
 * Handle incoming webhooks from Stripe, LiveKit, and Twilio
 */

import { Router } from 'express';
import Stripe from 'stripe';
import config from '../config/index.js';
import { getDatabase } from '../db/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import {
  handleInboundSMS,
  updateMessageStatus,
  generateVoiceResponse,
  generateConnectToRoomTwiML,
  generateForwardTwiML,
  generateVoicemailTwiML,
  validateWebhookSignature,
} from '../services/twilio.js';
import { emitToTenant } from '../websocket/index.js';

const router = Router();

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' })
  : null;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/stripe', asyncHandler(async (req, res) => {
  if (!stripe || !config.stripe.webhookSecret) {
    logger.warn('Stripe webhook received but not configured');
    return res.status(400).send('Webhook not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = getDatabase();

  logger.info('Stripe webhook received', { type: event.type });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { tenantId, planId } = session.metadata;

      if (tenantId && planId) {
        await db.tenant.update({
          where: { id: tenantId },
          data: {
            planId: planId.toUpperCase(),
            subscriptionId: session.subscription,
            subscriptionStatus: 'active',
          },
        });

        await db.auditLog.create({
          data: {
            tenantId,
            action: 'subscription.created',
            resourceType: 'subscription',
            resourceId: session.subscription,
            metadata: { planId, sessionId: session.id },
          },
        });

        logger.info('Subscription created', { tenantId, planId });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const tenant = await db.tenant.findFirst({
        where: { subscriptionId: subscription.id },
      });

      if (tenant) {
        await db.tenant.update({
          where: { id: tenant.id },
          data: {
            subscriptionStatus: subscription.status,
          },
        });

        logger.info('Subscription updated', {
          tenantId: tenant.id,
          status: subscription.status,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const tenant = await db.tenant.findFirst({
        where: { subscriptionId: subscription.id },
      });

      if (tenant) {
        await db.tenant.update({
          where: { id: tenant.id },
          data: {
            planId: 'BASIC',
            subscriptionId: null,
            subscriptionStatus: 'canceled',
          },
        });

        await db.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'subscription.deleted',
            resourceType: 'subscription',
            resourceId: subscription.id,
          },
        });

        logger.info('Subscription deleted', { tenantId: tenant.id });
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const tenant = await db.tenant.findFirst({
        where: { billingCustomerId: invoice.customer },
      });

      if (tenant) {
        await db.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'invoice.paid',
            resourceType: 'invoice',
            resourceId: invoice.id,
            metadata: {
              amount: invoice.amount_paid,
              currency: invoice.currency,
            },
          },
        });

        logger.info('Invoice paid', {
          tenantId: tenant.id,
          amount: invoice.amount_paid,
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const tenant = await db.tenant.findFirst({
        where: { billingCustomerId: invoice.customer },
      });

      if (tenant) {
        await db.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionStatus: 'past_due' },
        });

        await db.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: 'invoice.payment_failed',
            resourceType: 'invoice',
            resourceId: invoice.id,
          },
        });

        logger.warn('Invoice payment failed', { tenantId: tenant.id });
      }
      break;
    }

    default:
      logger.debug('Unhandled Stripe event', { type: event.type });
  }

  res.json({ received: true });
}));

/**
 * POST /api/webhooks/livekit
 * Handle LiveKit webhook events
 */
router.post('/livekit', asyncHandler(async (req, res) => {
  const { event, room, participant, track, egressInfo } = req.body;
  const db = getDatabase();

  logger.info('LiveKit webhook received', { event, room: room?.name });

  switch (event) {
    case 'room_started': {
      if (room?.name) {
        await db.call.updateMany({
          where: { livekitRoom: room.name },
          data: {
            livekitSid: room.sid,
            status: 'ACTIVE',
            startedAt: new Date(),
          },
        });
        logger.info('Room started', { roomName: room.name });
      }
      break;
    }

    case 'room_finished': {
      if (room?.name) {
        const call = await db.call.findFirst({
          where: { livekitRoom: room.name },
        });

        if (call && call.status === 'ACTIVE') {
          const endedAt = new Date();
          const durationSeconds = call.startedAt
            ? Math.round((endedAt - new Date(call.startedAt)) / 1000)
            : 0;

          await db.call.update({
            where: { id: call.id },
            data: {
              status: 'COMPLETED',
              endedAt,
              durationSeconds,
            },
          });

          logger.info('Room finished', {
            roomName: room.name,
            duration: durationSeconds,
          });
        }
      }
      break;
    }

    case 'participant_joined': {
      logger.info('Participant joined', {
        roomName: room?.name,
        identity: participant?.identity,
      });
      break;
    }

    case 'participant_left': {
      logger.info('Participant left', {
        roomName: room?.name,
        identity: participant?.identity,
      });
      break;
    }

    case 'track_published': {
      logger.info('Track published', {
        roomName: room?.name,
        trackType: track?.type,
        identity: participant?.identity,
      });
      break;
    }

    case 'egress_ended': {
      if (egressInfo) {
        const call = await db.call.findFirst({
          where: { livekitRoom: egressInfo.roomName },
        });

        if (call && egressInfo.fileResults?.length > 0) {
          const file = egressInfo.fileResults[0];

          await db.recording.create({
            data: {
              callId: call.id,
              tenantId: call.tenantId,
              s3Key: file.filename,
              s3Bucket: config.s3.bucket,
              fileSize: file.size || 0,
              mimeType: file.type === 'audio' ? 'audio/ogg' : 'video/mp4',
              durationMs: file.duration ? Math.round(file.duration / 1000000) : null,
              isReady: true,
            },
          });

          logger.info('Recording saved', {
            callId: call.id,
            filename: file.filename,
          });
        }
      }
      break;
    }

    default:
      logger.debug('Unhandled LiveKit event', { event });
  }

  res.json({ received: true });
}));

// ============================================
// Twilio Webhooks
// ============================================

/**
 * POST /api/webhooks/twilio/voice
 * Handle incoming voice calls from Twilio
 */
router.post('/twilio/voice', asyncHandler(async (req, res) => {
  const { Called, Caller, CallSid, CallStatus } = req.body;
  const db = getDatabase();

  logger.info('Twilio voice webhook received', { called: Called, caller: Caller, callSid: CallSid });

  // Validate request
  const signature = req.headers['x-twilio-signature'];
  const url = `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/voice`;
  if (!validateWebhookSignature(signature, url, req.body)) {
    logger.warn('Invalid Twilio webhook signature');
    return res.status(403).send('Invalid signature');
  }

  // Find the phone number and tenant
  const phoneRecord = await db.phoneNumber.findUnique({
    where: { phoneNumber: Called },
    include: {
      tenant: {
        include: { config: true },
      },
    },
  });

  if (!phoneRecord || phoneRecord.status !== 'ACTIVE') {
    logger.warn('Incoming call to unknown/inactive number', { called: Called });
    res.type('text/xml');
    return res.send(generateVoiceResponse(req.body));
  }

  const tenant = phoneRecord.tenant;
  const tenantConfig = tenant.config;

  // Create a call record
  const roomName = `call-${tenant.id.slice(0, 8)}-${Date.now()}`;
  const call = await db.call.create({
    data: {
      tenantId: tenant.id,
      livekitRoom: roomName,
      status: 'PENDING',
      callerPhone: Caller,
      metadata: {
        source: 'twilio',
        twilioCallSid: CallSid,
        phoneNumberId: phoneRecord.id,
        numberType: phoneRecord.numberType || 'twilio',
        businessNumber: phoneRecord.businessNumber || null,
      },
    },
  });

  // Create empty transcript
  await db.transcript.create({
    data: {
      callId: call.id,
      tenantId: tenant.id,
      segments: [],
    },
  });

  // Notify tenant via WebSocket (include business number context for BYON)
  emitToTenant(tenant.id, 'call:incoming', {
    callId: call.id,
    callerPhone: Caller,
    phoneNumber: Called,
    businessNumber: phoneRecord.businessNumber || null,
    numberType: phoneRecord.numberType || 'twilio',
    roomName,
  });

  // Check if call should be forwarded
  if (phoneRecord.forwardingNumber) {
    res.type('text/xml');
    return res.send(generateForwardTwiML(phoneRecord.forwardingNumber, Called));
  }

  // Connect to AI receptionist via stream
  res.type('text/xml');
  res.send(generateConnectToRoomTwiML(roomName, {
    greeting: tenantConfig?.welcomeMessage || `Thank you for calling ${tenant.name}. How can I help you?`,
    voice: tenantConfig?.voiceId || 'Polly.Joanna',
    language: tenantConfig?.voiceLanguage || 'en-US',
  }));
}));

/**
 * POST /api/webhooks/twilio/sms
 * Handle incoming SMS messages
 */
router.post('/twilio/sms', asyncHandler(async (req, res) => {
  logger.info('Twilio SMS webhook received', { from: req.body.From, to: req.body.To });

  // Validate request
  const signature = req.headers['x-twilio-signature'];
  const url = `${config.twilio.webhookBaseUrl}/api/webhooks/twilio/sms`;
  if (!validateWebhookSignature(signature, url, req.body)) {
    logger.warn('Invalid Twilio SMS webhook signature');
    return res.status(403).send('Invalid signature');
  }

  const message = await handleInboundSMS(req.body);

  if (message) {
    // Notify tenant via WebSocket
    emitToTenant(message.tenantId, 'message:received', {
      messageId: message.id,
      from: message.from,
      body: message.body,
    });
  }

  // Respond with empty TwiML (no auto-reply)
  res.type('text/xml');
  res.send('<Response></Response>');
}));

/**
 * POST /api/webhooks/twilio/sms-status
 * Handle SMS delivery status updates
 */
router.post('/twilio/sms-status', asyncHandler(async (req, res) => {
  logger.debug('Twilio SMS status webhook', {
    messageSid: req.body.MessageSid,
    status: req.body.MessageStatus,
  });

  await updateMessageStatus(req.body);
  res.sendStatus(200);
}));

/**
 * POST /api/webhooks/twilio/status
 * Handle general Twilio status callbacks
 */
router.post('/twilio/status', asyncHandler(async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  const db = getDatabase();

  logger.info('Twilio call status update', { callSid: CallSid, status: CallStatus });

  if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'no-answer' || CallStatus === 'busy') {
    // Find call by Twilio CallSid in metadata
    const calls = await db.call.findMany({
      where: {
        metadata: {
          path: ['twilioCallSid'],
          equals: CallSid,
        },
      },
    });

    if (calls.length > 0) {
      const call = calls[0];
      const statusMap = {
        completed: 'COMPLETED',
        failed: 'FAILED',
        'no-answer': 'CANCELLED',
        busy: 'CANCELLED',
      };

      await db.call.update({
        where: { id: call.id },
        data: {
          status: statusMap[CallStatus] || 'COMPLETED',
          endedAt: new Date(),
          durationSeconds: CallDuration ? parseInt(CallDuration, 10) : null,
        },
      });
    }
  }

  res.sendStatus(200);
}));

/**
 * POST /api/webhooks/twilio/dial-status
 * Handle call forwarding/dial result
 */
router.post('/twilio/dial-status', asyncHandler(async (req, res) => {
  const { DialCallStatus } = req.body;
  logger.info('Twilio dial status', { status: DialCallStatus });

  // If forwarded call wasn't answered, offer voicemail
  if (DialCallStatus === 'no-answer' || DialCallStatus === 'busy' || DialCallStatus === 'failed') {
    // Find tenant from the Called number
    const db = getDatabase();
    const phoneRecord = await db.phoneNumber.findUnique({
      where: { phoneNumber: req.body.Called },
    });

    if (phoneRecord?.voicemailEnabled) {
      res.type('text/xml');
      return res.send(generateVoicemailTwiML(phoneRecord.tenantId));
    }
  }

  res.type('text/xml');
  res.send('<Response></Response>');
}));

/**
 * POST /api/webhooks/twilio/voicemail
 * Handle voicemail recording from Twilio
 */
router.post('/twilio/voicemail', asyncHandler(async (req, res) => {
  const { RecordingUrl, RecordingSid, RecordingDuration, CallSid, Caller } = req.body;
  const tenantId = req.query.tenantId;
  const db = getDatabase();

  logger.info('Twilio voicemail received', {
    recordingSid: RecordingSid,
    duration: RecordingDuration,
    caller: Caller,
    tenantId,
  });

  if (!tenantId) {
    logger.warn('Voicemail webhook missing tenantId query param');
    res.type('text/xml');
    return res.send('<Response><Say>Goodbye.</Say></Response>');
  }

  // Find the call record
  let callId = null;
  if (CallSid) {
    const calls = await db.call.findMany({
      where: {
        metadata: {
          path: ['twilioCallSid'],
          equals: CallSid,
        },
      },
      take: 1,
    });
    if (calls.length > 0) callId = calls[0].id;
  }

  // Create voicemail record
  await db.voicemail.create({
    data: {
      tenantId,
      callId,
      callerPhone: Caller || null,
      recordingUrl: RecordingUrl ? `${RecordingUrl}.mp3` : null,
      recordingSid: RecordingSid || null,
      durationMs: RecordingDuration ? parseInt(RecordingDuration, 10) * 1000 : null,
      mimeType: 'audio/mpeg',
    },
  });

  // Notify tenant via WebSocket
  emitToTenant(tenantId, 'voicemail:new', {
    callerPhone: Caller,
    duration: RecordingDuration,
    callId,
  });

  logger.info('Voicemail saved', { tenantId, callId, recordingSid: RecordingSid });

  res.type('text/xml');
  res.send('<Response><Say>Thank you for your message. Goodbye.</Say></Response>');
}));

/**
 * POST /api/webhooks/twilio/voicemail-transcription
 * Handle voicemail transcription callback from Twilio
 */
router.post('/twilio/voicemail-transcription', asyncHandler(async (req, res) => {
  const { TranscriptionText, TranscriptionSid, RecordingSid, TranscriptionStatus } = req.body;
  const db = getDatabase();

  logger.info('Twilio voicemail transcription received', {
    transcriptionSid: TranscriptionSid,
    recordingSid: RecordingSid,
    status: TranscriptionStatus,
  });

  if (TranscriptionStatus === 'completed' && RecordingSid) {
    // Find voicemail by recording SID and update with transcription
    await db.voicemail.updateMany({
      where: { recordingSid: RecordingSid },
      data: {
        transcript: TranscriptionText || '',
      },
    });

    logger.info('Voicemail transcription saved', { recordingSid: RecordingSid });
  }

  res.sendStatus(200);
}));

export default router;
