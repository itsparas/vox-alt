/**
 * Call Routes
 * Call management and lifecycle
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { AccessToken } from 'livekit-server-sdk';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize, optionalAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import config from '../config/index.js';
import { logger } from '../lib/logger.js';
import { callsTotal, callDuration, activeCallsGauge } from '../lib/metrics.js';
import { emitToTenant, broadcastCallStatus } from '../websocket/index.js';
import { canAcceptCall, getCallCapacityStats } from '../services/callQueue.js';

const router = Router();

/**
 * GET /api/calls/link/:slug
 * Get shareable call link info (public endpoint - no auth required)
 * Returns tenant branding + capacity status for public call pages
 */
router.get('/link/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { slug },
      include: { config: true },
    });

    if (!tenant || tenant.deletedAt) {
      throw ApiError.notFound('Business not found');
    }

    // Check capacity
    const capacity = await canAcceptCall(tenant.id, tenant.planId);

    res.json({
      success: true,
      data: {
        tenant: {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
        },
        config: {
          receptionistName: tenant.config?.receptionistName || 'Alex',
          welcomeMessage: tenant.config?.welcomeMessage || `Welcome to ${tenant.name}! How can I help you today?`,
          businessName: tenant.config?.businessName || tenant.name,
          businessDescription: tenant.config?.businessDescription,
          primaryColor: tenant.config?.widgetPrimaryColor || '#2563eb',
          consentRequired: tenant.config?.consentRequired ?? true,
        },
        capacity: {
          available: capacity.allowed,
          activeCount: capacity.activeCount,
          limit: capacity.limit === -1 ? 'unlimited' : capacity.limit,
        },
      },
    });
  })
);

/**
 * POST /api/calls
 * Create/initialize a new call
 */
router.post('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { callerName, callerPhone, callerEmail, metadata } = req.body;
    const db = getDatabase();

    // Generate unique room name
    const roomName = `call-${req.tenantId.slice(0, 8)}-${Date.now()}`;

    const call = await db.call.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        livekitRoom: roomName,
        status: 'PENDING',
        callerName,
        callerPhone,
        callerEmail,
        metadata,
      },
    });

    // Create empty transcript
    await db.transcript.create({
      data: {
        callId: call.id,
        tenantId: req.tenantId,
        segments: [],
      },
    });

    activeCallsGauge.inc({ tenant_id: req.tenantId });

    logger.info('Call created', { callId: call.id, tenantId: req.tenantId });

    res.status(201).json({
      success: true,
      data: call,
    });
  })
);

/**
 * GET /api/calls
 * List calls with filtering and pagination
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      search,
    } = req.query;
    const db = getDatabase();

    const where = {
      tenantId: req.tenantId,
      ...(status && { status }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { callerName: { contains: search, mode: 'insensitive' } },
          { callerEmail: { contains: search, mode: 'insensitive' } },
          { callerPhone: { contains: search } },
        ],
      }),
    };

    const [calls, total] = await Promise.all([
      db.call.findMany({
        where,
        include: {
          user: {
            select: { id: true, displayName: true, email: true },
          },
          agent: {
            select: { id: true, displayName: true, email: true },
          },
          transcript: {
            select: { id: true, isProcessed: true },
          },
          recording: {
            select: { id: true, isReady: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      db.call.count({ where }),
    ]);

    res.json({
      success: true,
      data: calls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  })
);

/**
 * GET /api/calls/active
 * List active calls
 */
router.get('/active',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const calls = await db.call.findMany({
      where: {
        tenantId: req.tenantId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        user: {
          select: { id: true, displayName: true },
        },
        agent: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: calls,
    });
  })
);

/**
 * GET /api/calls/:id
 * Get call details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const call = await db.call.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
      include: {
        user: {
          select: { id: true, displayName: true, email: true },
        },
        agent: {
          select: { id: true, displayName: true, email: true },
        },
        transcript: true,
        recording: true,
        bookings: true,
      },
    });

    if (!call) {
      throw ApiError.notFound('Call not found');
    }

    res.json({
      success: true,
      data: call,
    });
  })
);

/**
 * PUT /api/calls/:id
 * Update call status/details
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, agentId, intents, primaryIntent } = req.body;
    const db = getDatabase();

    const existingCall = await db.call.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existingCall) {
      throw ApiError.notFound('Call not found');
    }

    const updateData = {
      ...(status && { status }),
      ...(agentId && { agentId }),
      ...(intents && { intents }),
      ...(primaryIntent && { primaryIntent }),
    };

    // Handle status transitions
    if (status === 'ACTIVE' && !existingCall.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateData.endedAt = new Date();
      
      if (existingCall.startedAt) {
        updateData.durationSeconds = Math.round(
          (new Date() - new Date(existingCall.startedAt)) / 1000
        );

        // Update metrics
        callDuration.observe(
          { tenant_id: req.tenantId, status },
          updateData.durationSeconds
        );
      }

      activeCallsGauge.dec({ tenant_id: req.tenantId });
      callsTotal.inc({
        tenant_id: req.tenantId,
        status,
        intent: primaryIntent || 'unknown',
      });
    }

    const call = await db.call.update({
      where: { id },
      data: updateData,
    });

    // Log status change
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'call.status_changed',
        resourceType: 'call',
        resourceId: id,
        metadata: { oldStatus: existingCall.status, newStatus: status },
      },
    });

    logger.info('Call updated', { callId: id, status });

    res.json({
      success: true,
      data: call,
    });
  })
);

/**
 * POST /api/calls/:id/start
 * Start a call (set status to ACTIVE)
 */
router.post('/:id/start',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const call = await db.call.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    logger.info('Call started', { callId: id });

    res.json({
      success: true,
      data: call,
    });
  })
);

/**
 * POST /api/calls/:id/end
 * End a call
 */
router.post('/:id/end',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status = 'COMPLETED' } = req.body;
    const db = getDatabase();

    const existingCall = await db.call.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!existingCall) {
      throw ApiError.notFound('Call not found');
    }

    const endedAt = new Date();
    const durationSeconds = existingCall.startedAt
      ? Math.round((endedAt - new Date(existingCall.startedAt)) / 1000)
      : 0;

    const call = await db.call.update({
      where: { id },
      data: {
        status,
        endedAt,
        durationSeconds,
      },
    });

    // Update metrics
    if (durationSeconds > 0) {
      callDuration.observe({ tenant_id: req.tenantId, status }, durationSeconds);
    }
    activeCallsGauge.dec({ tenant_id: req.tenantId });
    callsTotal.inc({
      tenant_id: req.tenantId,
      status,
      intent: call.primaryIntent || 'unknown',
    });

    logger.info('Call ended', { callId: id, duration: durationSeconds });

    res.json({
      success: true,
      data: call,
    });
  })
);

/**
 * POST /api/calls/:id/escalate
 * Escalate call to human agent
 */
router.post('/:id/escalate',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { targetAgentId, reason } = req.body;
    const db = getDatabase();

    const call = await db.call.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!call) {
      throw ApiError.notFound('Call not found');
    }

    // Find available agent or use specified agent
    let agentId = targetAgentId;

    if (!agentId) {
      // Find first available agent
      const availableAgent = await db.user.findFirst({
        where: {
          tenantId: req.tenantId,
          role: 'AGENT',
          isActive: true,
        },
      });

      if (!availableAgent) {
        throw ApiError.badRequest('No agents available');
      }

      agentId = availableAgent.id;
    }

    const updatedCall = await db.call.update({
      where: { id },
      data: {
        agentId,
        intents: { push: 'escalated' },
        metadata: {
          ...call.metadata,
          escalationReason: reason,
          escalatedAt: new Date().toISOString(),
        },
      },
      include: {
        agent: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Log escalation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'call.escalated',
        resourceType: 'call',
        resourceId: id,
        metadata: { agentId, reason },
      },
    });

    logger.info('Call escalated', { callId: id, agentId });

    res.json({
      success: true,
      data: updatedCall,
    });
  })
);

/**
 * PUT /api/calls/:id/disposition
 * Set call disposition and notes
 */
router.put('/:id/disposition',
  authenticate,
  tenantIsolation,
  [
    param('id').isUUID(),
    body('disposition').isString().isIn([
      'ANSWERED', 'VOICEMAIL', 'MISSED', 'ABANDONED', 'TRANSFERRED',
      'ESCALATED', 'BOOKED', 'MESSAGE_TAKEN', 'INFO_PROVIDED', 'SPAM', 'FOLLOW_UP_NEEDED',
    ]),
    body('notes').optional().isString(),
    body('sentiment').optional().isIn(['positive', 'neutral', 'negative']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Invalid disposition data', errors.array());
    }

    const { id } = req.params;
    const { disposition, notes, sentiment } = req.body;
    const db = getDatabase();

    const call = await db.call.findFirst({
      where: { id, tenantId: req.tenantId },
    });

    if (!call) {
      throw ApiError.notFound('Call not found');
    }

    const updated = await db.call.update({
      where: { id },
      data: {
        disposition,
        outcome: disposition,
        ...(notes && { notes }),
        ...(sentiment && { sentiment }),
      },
    });

    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'call.disposition_set',
        resourceType: 'call',
        resourceId: id,
        metadata: { disposition, sentiment },
      },
    });

    logger.info('Call disposition set', { callId: id, disposition });

    res.json({ success: true, data: updated });
  })
);

/**
 * GET /api/calls/:id/transcript
 * Get call transcript
 */
router.get('/:id/transcript',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const transcript = await db.transcript.findFirst({
      where: {
        callId: id,
        tenantId: req.tenantId,
      },
    });

    if (!transcript) {
      throw ApiError.notFound('Transcript not found');
    }

    res.json({
      success: true,
      data: transcript,
    });
  })
);

/**
 * GET /api/calls/:id/recording
 * Get call recording download URL
 */
router.get('/:id/recording',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const recording = await db.recording.findFirst({
      where: {
        callId: id,
        tenantId: req.tenantId,
      },
    });

    if (!recording) {
      throw ApiError.notFound('Recording not found');
    }

    if (!recording.isReady) {
      throw ApiError.badRequest('Recording is still processing');
    }

    // Import storage service dynamically to avoid circular deps
    const { getDownloadUrl } = await import('../services/storage.js');
    
    try {
      const url = await getDownloadUrl(recording.s3Key, recording.s3Bucket, 3600);
      
      res.json({
        success: true,
        data: {
          url,
          mimeType: recording.mimeType,
          durationMs: recording.durationMs,
          fileSize: recording.fileSize,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get recording URL', { error: error.message, recordingId: recording.id });
      throw ApiError.internal('Failed to get recording URL');
    }
  })
);

/**
 * POST /api/calls/:id/join
 * Generate token for human agent to join an escalated call
 */
router.post('/:id/join',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'AGENT'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Get the call
    const call = await db.call.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
      },
    });

    if (!call) {
      throw ApiError.notFound('Call not found');
    }

    if (!call.livekitRoom) {
      throw ApiError.badRequest('Call has no active room');
    }

    // Update call with agent assignment
    await db.call.update({
      where: { id },
      data: {
        agentId: req.user.id,
        status: 'IN_PROGRESS',
        agentJoinedAt: new Date(),
      },
    });

    // Generate LiveKit token for agent
    const token = new AccessToken(
      config.livekit.apiKey,
      config.livekit.apiSecret,
      {
        identity: `human-agent-${req.user.id.slice(0, 8)}`,
        name: req.user.displayName || 'Human Agent',
        ttl: config.livekit.tokenTtl,
        metadata: JSON.stringify({
          userId: req.user.id,
          tenantId: req.tenantId,
          role: 'human_agent',
          callId: id,
        }),
      }
    );

    token.addGrant({
      roomJoin: true,
      room: call.livekitRoom,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    // Notify that an agent has joined
    broadcastCallStatus(id, req.tenantId, 'AGENT_JOINED', {
      agentId: req.user.id,
      agentName: req.user.displayName || 'Human Agent',
    });

    logger.info('Agent joined call', { 
      callId: id, 
      agentId: req.user.id,
      roomName: call.livekitRoom,
    });

    res.json({
      success: true,
      data: {
        token: jwt,
        roomName: call.livekitRoom,
        url: config.livekit.url,
        callId: id,
      },
    });
  })
);

/**
 * GET /api/calls/escalated
 * Get all escalated calls for the tenant
 */
router.get('/escalated',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN', 'AGENT'),
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const escalatedCalls = await db.call.findMany({
      where: {
        tenantId: req.tenantId,
        status: 'ESCALATED',
      },
      include: {
        agent: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: { escalatedAt: 'desc' },
    });

    res.json({
      success: true,
      data: escalatedCalls,
    });
  })
);

/**
 * DELETE /api/calls/:id
 * Delete call (admin only)
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Delete related records
    await db.$transaction([
      db.transcript.deleteMany({ where: { callId: id } }),
      db.recording.deleteMany({ where: { callId: id } }),
      db.call.delete({ where: { id } }),
    ]);

    logger.info('Call deleted', { callId: id });

    res.json({
      success: true,
      message: 'Call deleted successfully',
    });
  })
);

export default router;
