/**
 * LiveKit Routes
 * Token generation and room management
 */

import { Router } from 'express';
import express from 'express';
import { AccessToken, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';
import { body, param, validationResult } from 'express-validator';
import config from '../config/index.js';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, optionalAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { activeCallsGauge } from '../lib/metrics.js';
import { callAgentManager } from '../services/callAgent.js';
import { canAcceptCall, registerActiveCall, unregisterActiveCall, addToQueue, getCallCapacityStats } from '../services/callQueue.js';
import { emitToTenant } from '../websocket/index.js';

const router = Router();

// Initialize LiveKit Room Service Client
const roomService = new RoomServiceClient(
  config.livekit.url.replace('ws', 'http'), // Convert WS to HTTP for API
  config.livekit.apiKey,
  config.livekit.apiSecret
);

// Initialize webhook receiver
const webhookReceiver = new WebhookReceiver(
  config.livekit.apiKey,
  config.livekit.apiSecret
);

// Initialize call agent manager
callAgentManager.initialize();

/**
 * Generate LiveKit access token
 * @param {string} roomName - Room name
 * @param {string} participantName - Participant identity
 * @param {object} options - Additional options
 */
async function generateLiveKitToken(roomName, participantName, options = {}) {
  const token = new AccessToken(
    config.livekit.apiKey,
    config.livekit.apiSecret,
    {
      identity: participantName,
      ttl: options.ttl || config.livekit.tokenTtl,
      metadata: options.metadata ? JSON.stringify(options.metadata) : undefined,
    }
  );

  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: options.canPublish !== false,
    canSubscribe: options.canSubscribe !== false,
    canPublishData: options.canPublishData !== false,
  });

  return await token.toJwt();
}

/**
 * POST /api/livekit/token
 * Generate token to join a room (for authenticated users)
 */
router.post('/token',
  authenticate,
  tenantIsolation,
  [
    body('roomName').optional().trim().isLength({ min: 1, max: 100 }),
    body('participantName').optional().trim().isLength({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const db = getDatabase();
    const { roomName, participantName, callId } = req.body;

    let room = roomName;
    let call;

    if (callId) {
      // Join existing call
      call = await db.call.findFirst({
        where: {
          id: callId,
          tenantId: req.tenantId,
        },
      });

      if (!call) {
        throw ApiError.notFound('Call not found');
      }

      room = call.livekitRoom;
    } else {
      // Creating a new call — check concurrency limit
      const tenant = await db.tenant.findUnique({
        where: { id: req.tenantId },
        select: { planId: true },
      });

      const capacity = await canAcceptCall(req.tenantId, tenant.planId);
      if (!capacity.allowed) {
        throw ApiError.conflict(
          `Concurrent call limit reached (${capacity.limit}). ${capacity.activeCount} calls currently active.`
        );
      }

      if (!room) {
        room = `room-${req.tenantId.slice(0, 8)}-${uuidv4().slice(0, 8)}`;
      }
    }

    const identity = participantName || `user-${req.user.id.slice(0, 8)}`;
    
    const token = await generateLiveKitToken(room, identity, {
      metadata: {
        userId: req.user.id,
        tenantId: req.tenantId,
        role: req.user.role,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        roomName: room,
        identity,
        url: config.livekit.url,
      },
    });
  })
);

/**
 * POST /api/livekit/widget-token
 * Generate token for embed widget (public endpoint)
 */
router.post('/widget-token',
  [
    body('tenantSlug').trim().isLength({ min: 1 }),
    body('visitorId').optional().trim(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const { tenantSlug, visitorId, visitorName } = req.body;
    const db = getDatabase();

    // Find tenant by slug
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      include: { config: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw ApiError.notFound('Tenant not found');
    }

    // Check concurrent call limit
    const capacity = await canAcceptCall(tenant.id, tenant.planId);
    if (!capacity.allowed) {
      // Return queue info instead of rejecting
      const roomName = `widget-${tenant.id.slice(0, 8)}-${uuidv4().slice(0, 8)}`;
      const identity = visitorId || `visitor-${uuidv4().slice(0, 8)}`;

      // Create call record with QUEUED status
      const call = await db.call.create({
        data: {
          tenantId: tenant.id,
          livekitRoom: roomName,
          status: 'PENDING',
          callerName: visitorName,
          metadata: {
            source: 'widget',
            visitorId: identity,
            queued: true,
          },
        },
      });

      const queueInfo = await addToQueue(tenant.id, call.id, {
        name: visitorName,
        visitorId: identity,
      });

      return res.status(202).json({
        success: true,
        queued: true,
        data: {
          callId: call.id,
          position: queueInfo.position,
          estimatedWait: queueInfo.estimatedWait,
          message: `All receptionists are busy. You are number ${queueInfo.position} in the queue.`,
          config: {
            receptionistName: tenant.config?.receptionistName,
            welcomeMessage: tenant.config?.welcomeMessage,
            primaryColor: tenant.config?.widgetPrimaryColor,
          },
        },
      });
    }

    // Generate room and visitor identity
    const roomName = `widget-${tenant.id.slice(0, 8)}-${uuidv4().slice(0, 8)}`;
    const identity = visitorId || `visitor-${uuidv4().slice(0, 8)}`;

    // Create call record
    const call = await db.call.create({
      data: {
        tenantId: tenant.id,
        livekitRoom: roomName,
        status: 'PENDING',
        callerName: visitorName,
        metadata: {
          source: 'widget',
          visitorId: identity,
        },
      },
    });

    // Generate token with limited permissions for visitors
    const token = await generateLiveKitToken(roomName, identity, {
      metadata: {
        callId: call.id,
        tenantId: tenant.id,
        role: 'visitor',
      },
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Update metrics
    activeCallsGauge.inc({ tenant_id: tenant.id });

    logger.info('Widget token generated', {
      callId: call.id,
      tenantId: tenant.id,
      roomName,
    });

    res.json({
      success: true,
      data: {
        token,
        roomName,
        identity,
        callId: call.id,
        url: config.livekit.url,
        config: {
          receptionistName: tenant.config?.receptionistName,
          welcomeMessage: tenant.config?.welcomeMessage,
          consentRequired: tenant.config?.consentRequired,
          primaryColor: tenant.config?.widgetPrimaryColor,
        },
      },
    });
  })
);

/**
 * POST /api/livekit/rooms
 * Create a new room
 */
router.post('/rooms',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { name, emptyTimeout = 300, maxParticipants = 10 } = req.body;

    const roomName = name || `room-${req.tenantId.slice(0, 8)}-${uuidv4().slice(0, 8)}`;

    try {
      const room = await roomService.createRoom({
        name: roomName,
        emptyTimeout,
        maxParticipants,
        metadata: JSON.stringify({
          tenantId: req.tenantId,
          createdBy: req.user.id,
        }),
      });

      logger.info('Room created', { roomName, tenantId: req.tenantId });

      res.status(201).json({
        success: true,
        data: {
          name: room.name,
          sid: room.sid,
          emptyTimeout: room.emptyTimeout,
          maxParticipants: room.maxParticipants,
          creationTime: room.creationTime,
        },
      });
    } catch (error) {
      logger.error('Failed to create room', { error: error.message });
      throw ApiError.internal('Failed to create room');
    }
  })
);

/**
 * GET /api/livekit/rooms
 * List rooms
 */
router.get('/rooms',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    try {
      const rooms = await roomService.listRooms();

      // Filter by tenant (rooms with metadata containing tenantId)
      const tenantRooms = rooms.filter(room => {
        try {
          const metadata = JSON.parse(room.metadata || '{}');
          return metadata.tenantId === req.tenantId;
        } catch {
          return false;
        }
      });

      res.json({
        success: true,
        data: tenantRooms.map(room => ({
          name: room.name,
          sid: room.sid,
          numParticipants: room.numParticipants,
          creationTime: room.creationTime,
        })),
      });
    } catch (error) {
      logger.error('Failed to list rooms', { error: error.message });
      throw ApiError.internal('Failed to list rooms');
    }
  })
);

/**
 * GET /api/livekit/rooms/:roomName
 * Get room details
 */
router.get('/rooms/:roomName',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { roomName } = req.params;

    try {
      const rooms = await roomService.listRooms([roomName]);
      
      if (rooms.length === 0) {
        throw ApiError.notFound('Room not found');
      }

      const room = rooms[0];

      // Get participants
      const participants = await roomService.listParticipants(roomName);

      res.json({
        success: true,
        data: {
          name: room.name,
          sid: room.sid,
          numParticipants: room.numParticipants,
          creationTime: room.creationTime,
          participants: participants.map(p => ({
            identity: p.identity,
            sid: p.sid,
            state: p.state,
            joinedAt: p.joinedAt,
          })),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error('Failed to get room', { error: error.message });
      throw ApiError.internal('Failed to get room');
    }
  })
);

/**
 * DELETE /api/livekit/rooms/:roomName
 * Delete a room
 */
router.delete('/rooms/:roomName',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { roomName } = req.params;

    try {
      await roomService.deleteRoom(roomName);

      logger.info('Room deleted', { roomName, tenantId: req.tenantId });

      res.json({
        success: true,
        message: 'Room deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete room', { error: error.message });
      throw ApiError.internal('Failed to delete room');
    }
  })
);

/**
 * POST /api/livekit/rooms/:roomName/remove-participant
 * Remove participant from room
 */
router.post('/rooms/:roomName/remove-participant',
  authenticate,
  tenantIsolation,
  [body('identity').trim().isLength({ min: 1 })],
  asyncHandler(async (req, res) => {
    const { roomName } = req.params;
    const { identity } = req.body;

    try {
      await roomService.removeParticipant(roomName, identity);

      logger.info('Participant removed', { roomName, identity });

      res.json({
        success: true,
        message: 'Participant removed successfully',
      });
    } catch (error) {
      logger.error('Failed to remove participant', { error: error.message });
      throw ApiError.internal('Failed to remove participant');
    }
  })
);

/**
 * POST /api/livekit/rooms/:roomName/mute
 * Mute participant track
 */
router.post('/rooms/:roomName/mute',
  authenticate,
  tenantIsolation,
  [
    body('identity').trim().isLength({ min: 1 }),
    body('trackSid').trim().isLength({ min: 1 }),
    body('muted').isBoolean(),
  ],
  asyncHandler(async (req, res) => {
    const { roomName } = req.params;
    const { identity, trackSid, muted } = req.body;

    try {
      await roomService.mutePublishedTrack(roomName, identity, trackSid, muted);

      res.json({
        success: true,
        message: `Track ${muted ? 'muted' : 'unmuted'} successfully`,
      });
    } catch (error) {
      logger.error('Failed to mute track', { error: error.message });
      throw ApiError.internal('Failed to mute track');
    }
  })
);

/**
 * POST /api/livekit/webhook
 * LiveKit webhook handler for room events
 */
router.post('/webhook',
  express.raw({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    const authHeader = req.get('Authorization');
    const db = getDatabase();

    try {
      // Convert body to string for webhook verification
      let body;
      if (Buffer.isBuffer(req.body)) {
        body = req.body.toString('utf8');
      } else if (typeof req.body === 'string') {
        body = req.body;
      } else if (typeof req.body === 'object') {
        // Body was already parsed as JSON, convert back to string
        body = JSON.stringify(req.body);
      } else {
        body = String(req.body);
      }
      
      // Verify webhook signature
      const event = await webhookReceiver.receive(body, authHeader);

      logger.info('LiveKit webhook received', { event: event.event });

      switch (event.event) {
        case 'participant_joined': {
          const { room, participant } = event;
          
          // Check if this is a visitor joining a widget call
          if (room.name.startsWith('widget-') && participant.identity.startsWith('visitor-')) {
            // Find the call record
            const call = await db.call.findFirst({
              where: { livekitRoom: room.name },
              include: { tenant: true },
            });

            if (call) {
              // Update call status
              await db.call.update({
                where: { id: call.id },
                data: { 
                  status: 'ACTIVE',
                  startedAt: new Date(),
                },
              });

              // Register active call for concurrency tracking
              await registerActiveCall(call.tenantId, call.id);

              // Emit capacity update to dashboard
              emitToTenant(call.tenantId, 'call:capacity_changed', {
                callId: call.id,
                event: 'call_started',
              });

              // Start the AI agent for this call
              try {
                await callAgentManager.startAgent(call.id, room.name, call.tenantId);
                logger.info('Call agent started for widget call', { 
                  callId: call.id, 
                  roomName: room.name 
                });
              } catch (agentError) {
                logger.error('Failed to start call agent', { 
                  error: agentError.message,
                  callId: call.id 
                });
              }
            }
          }
          break;
        }

        case 'participant_left': {
          const { room, participant } = event;
          
          // Find call for this room
          const call = await db.call.findFirst({
            where: { livekitRoom: room.name },
          });

          if (call) {
            // Stop the agent
            await callAgentManager.stopAgent(call.id);

            // If visitor left, end the call
            if (participant.identity.startsWith('visitor-')) {
              await db.call.update({
                where: { id: call.id },
                data: {
                  status: 'COMPLETED',
                  endedAt: new Date(),
                },
              });

              // Unregister from concurrency tracking (will auto-promote queued callers)
              await unregisterActiveCall(call.tenantId, call.id);

              activeCallsGauge.dec({ tenant_id: call.tenantId });

              // Emit capacity update
              emitToTenant(call.tenantId, 'call:capacity_changed', {
                callId: call.id,
                event: 'call_ended',
              });

              logger.info('Call completed - visitor left', { callId: call.id });
            }
          }
          break;
        }

        case 'room_finished': {
          const { room } = event;
          
          // Find and finalize call
          const call = await db.call.findFirst({
            where: { 
              livekitRoom: room.name,
              status: { in: ['PENDING', 'ACTIVE'] },
            },
          });

          if (call) {
            await callAgentManager.stopAgent(call.id);
            
            await db.call.update({
              where: { id: call.id },
              data: {
                status: call.status === 'PENDING' ? 'MISSED' : 'COMPLETED',
                endedAt: new Date(),
              },
            });

            // Unregister from concurrency tracking
            await unregisterActiveCall(call.tenantId, call.id);

            activeCallsGauge.dec({ tenant_id: call.tenantId });

            // Emit capacity update
            emitToTenant(call.tenantId, 'call:capacity_changed', {
              callId: call.id,
              event: 'room_finished',
            });

            logger.info('Room finished', { roomName: room.name, callId: call.id });
          }
          break;
        }

        case 'track_published': {
          // Audio track published - could trigger ASR start
          logger.debug('Track published', { 
            room: event.room?.name,
            participant: event.participant?.identity,
            track: event.track?.type,
          });
          break;
        }

        default:
          logger.debug('Unhandled LiveKit event', { event: event.event });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Webhook verification failed', { error: error.message });
      res.status(401).json({ error: 'Invalid webhook signature' });
    }
  })
);

/**
 * GET /api/livekit/capacity
 * Get current call capacity stats for the tenant
 */
router.get('/capacity',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      select: { planId: true },
    });

    const stats = await getCallCapacityStats(req.tenantId, tenant.planId);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * POST /api/livekit/start-agent
 * Manually start AI agent for a call (for testing)
 */
router.post('/start-agent',
  authenticate,
  tenantIsolation,
  [body('callId').trim().isUUID()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const { callId } = req.body;
    const db = getDatabase();

    const call = await db.call.findFirst({
      where: {
        id: callId,
        tenantId: req.tenantId,
      },
    });

    if (!call) {
      throw ApiError.notFound('Call not found');
    }

    try {
      const agent = await callAgentManager.startAgent(call.id, call.livekitRoom, call.tenantId);

      res.json({
        success: true,
        data: {
          callId: call.id,
          roomName: call.livekitRoom,
          status: 'Agent started',
        },
      });
    } catch (error) {
      logger.error('Failed to start agent', { error: error.message, callId });
      throw ApiError.internal('Failed to start agent: ' + error.message);
    }
  })
);

export default router;
