/**
 * Tenant Routes
 * Tenant management and configuration
 */

import { Router } from 'express';
import { body, validationResult, param } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, authorize, tenantIsolation } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * POST /api/tenants
 * Create new tenant (super admin only)
 */
router.post('/',
  authenticate,
  authorize('SUPER_ADMIN'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('slug').trim().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
    body('planId').optional().isIn(['BASIC', 'PRO', 'ENTERPRISE']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const { name, slug, planId = 'BASIC', domain } = req.body;
    const db = getDatabase();

    // Check if slug exists
    const existing = await db.tenant.findUnique({
      where: { slug },
    });

    if (existing) {
      throw ApiError.conflict('Tenant slug already exists');
    }

    const tenant = await db.tenant.create({
      data: {
        name,
        slug,
        planId,
        domain,
        config: {
          create: {
            receptionistName: 'Alex',
            voiceLanguage: 'en-US',
          },
        },
      },
      include: {
        config: true,
      },
    });

    logger.info('Tenant created', { tenantId: tenant.id, name: tenant.name });

    res.status(201).json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * GET /api/tenants
 * List all tenants (super admin only)
 */
router.get('/',
  authenticate,
  authorize('SUPER_ADMIN'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search } = req.query;
    const db = getDatabase();

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              calls: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      db.tenant.count({ where }),
    ]);

    res.json({
      success: true,
      data: tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  })
);

/**
 * GET /api/tenants/me
 * Get current tenant (authenticated user's tenant)
 */
router.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.user.tenantId },
      include: {
        config: true,
        _count: {
          select: {
            users: true,
            calls: true,
            bookings: true,
          },
        },
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant not found');
    }

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * PUT /api/tenants/me
 * Update current tenant
 */
router.put('/me',
  authenticate,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { name, domain } = req.body;

    const tenant = await db.tenant.update({
      where: { id: req.user.tenantId },
      data: {
        ...(name && { name }),
        ...(domain !== undefined && { domain }),
      },
      include: {
        config: true,
      },
    });

    logger.info('Tenant updated', { tenantId: tenant.id });

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * GET /api/tenants/me/config
 * Get current tenant configuration
 */
router.get('/me/config',
  authenticate,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const config = await db.tenantConfig.findUnique({
      where: { tenantId: req.user.tenantId },
    });

    if (!config) {
      throw ApiError.notFound('Tenant config not found');
    }

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * PUT /api/tenants/me/config
 * Update current tenant configuration
 */
router.put('/me/config',
  authenticate,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const configData = req.body;

    // Sanitize sensitive fields
    const allowedFields = [
      'asrProvider', 'ttsProvider', 'llmProvider',
      'receptionistName', 'receptionistPersonality',
      'welcomeMessage', 'goodbyeMessage',
      'voiceId', 'voiceLanguage', 'allowedLanguages',
      'businessName', 'businessDescription', 'timezone', 'businessHours',
      'recordingEnabled', 'transcriptionEnabled', 'videoEnabled', 'consentRequired',
      'retentionDays',
      'googleCalendarEnabled', 'googleCalendarId',
      'widgetPrimaryColor', 'widgetPosition',
    ];

    const sanitizedData = {};
    for (const field of allowedFields) {
      if (configData[field] !== undefined) {
        sanitizedData[field] = configData[field];
      }
    }

    const config = await db.tenantConfig.update({
      where: { tenantId: req.user.tenantId },
      data: sanitizedData,
    });

    logger.info('Tenant config updated', { tenantId: req.user.tenantId });

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * GET /api/tenants/me/stats
 * Get current tenant statistics
 */
router.get('/me/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const [calls, bookings, activeUsers] = await Promise.all([
      db.call.count({
        where: {
          tenantId: req.user.tenantId,
          ...(Object.keys(dateFilter).length && { startedAt: dateFilter }),
        },
      }),
      db.booking.count({
        where: {
          tenantId: req.user.tenantId,
          ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
        },
      }),
      db.user.count({
        where: {
          tenantId: req.user.tenantId,
          isActive: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalCalls: calls,
        totalBookings: bookings,
        activeUsers,
      },
    });
  })
);

/**
 * GET /api/tenants/current
 * Get current tenant (authenticated user's tenant) - DEPRECATED: use /me instead
 */
router.get('/current',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      include: {
        config: true,
        _count: {
          select: {
            users: true,
            calls: true,
            bookings: true,
          },
        },
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant not found');
    }

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * GET /api/tenants/:id
 * Get tenant by ID
 */
router.get('/:id',
  authenticate,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Check access
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== id) {
      throw ApiError.forbidden('Cannot access this tenant');
    }

    const tenant = await db.tenant.findUnique({
      where: { id },
      include: {
        config: true,
        _count: {
          select: {
            users: true,
            calls: true,
            bookings: true,
          },
        },
      },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant not found');
    }

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * PUT /api/tenants/:id
 * Update tenant
 */
router.put('/:id',
  authenticate,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Check access
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== id) {
      throw ApiError.forbidden('Cannot update this tenant');
    }

    // Only tenant admin or super admin can update
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'TENANT_ADMIN') {
      throw ApiError.forbidden('Insufficient permissions');
    }

    const { name, logoUrl, domain } = req.body;

    const tenant = await db.tenant.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(logoUrl !== undefined && { logoUrl }),
        ...(domain !== undefined && { domain }),
      },
      include: {
        config: true,
      },
    });

    logger.info('Tenant updated', { tenantId: id });

    res.json({
      success: true,
      data: tenant,
    });
  })
);

/**
 * PUT /api/tenants/:id/config
 * Update tenant configuration
 */
router.put('/:id/config',
  authenticate,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Check access
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== id) {
      throw ApiError.forbidden('Cannot update this tenant');
    }

    const configData = req.body;

    // Sanitize sensitive fields
    const allowedFields = [
      'asrProvider', 'ttsProvider', 'llmProvider',
      'receptionistName', 'receptionistPersonality',
      'welcomeMessage', 'goodbyeMessage',
      'voiceId', 'voiceLanguage', 'allowedLanguages',
      'businessName', 'businessDescription', 'timezone', 'businessHours',
      'recordingEnabled', 'transcriptionEnabled', 'videoEnabled', 'consentRequired',
      'retentionDays',
      'googleCalendarEnabled', 'googleCalendarId',
      'widgetPrimaryColor', 'widgetPosition',
    ];

    const sanitizedData = {};
    for (const field of allowedFields) {
      if (configData[field] !== undefined) {
        sanitizedData[field] = configData[field];
      }
    }

    const config = await db.tenantConfig.update({
      where: { tenantId: id },
      data: sanitizedData,
    });

    // Log config update
    await db.auditLog.create({
      data: {
        tenantId: id,
        userId: req.user.id,
        action: 'tenant.config_updated',
        resourceType: 'tenant_config',
        resourceId: config.id,
        metadata: { updatedFields: Object.keys(sanitizedData) },
      },
    });

    res.json({
      success: true,
      data: config,
    });
  })
);

/**
 * DELETE /api/tenants/:id
 * Soft delete tenant (super admin only)
 */
router.delete('/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    await db.tenant.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Tenant deleted', { tenantId: id });

    res.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  })
);

/**
 * GET /api/tenants/:id/stats
 * Get tenant statistics
 */
router.get('/:id/stats',
  authenticate,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { period = '30d' } = req.query;
    const db = getDatabase();

    // Check access
    if (req.user.role !== 'SUPER_ADMIN' && req.user.tenantId !== id) {
      throw ApiError.forbidden('Cannot access this tenant');
    }

    // Calculate date range
    const periodDays = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const [totalCalls, totalBookings, totalMinutes, recentCalls] = await Promise.all([
      db.call.count({
        where: {
          tenantId: id,
          createdAt: { gte: startDate },
        },
      }),
      db.booking.count({
        where: {
          tenantId: id,
          createdAt: { gte: startDate },
        },
      }),
      db.call.aggregate({
        where: {
          tenantId: id,
          createdAt: { gte: startDate },
          status: 'COMPLETED',
        },
        _sum: {
          durationSeconds: true,
        },
      }),
      db.call.findMany({
        where: {
          tenantId: id,
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          durationSeconds: true,
          primaryIntent: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalCalls,
        totalBookings,
        totalMinutes: Math.round((totalMinutes._sum.durationSeconds || 0) / 60),
        recentCalls,
        period: `${periodDays} days`,
      },
    });
  })
);

export default router;
