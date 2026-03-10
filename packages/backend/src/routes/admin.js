/**
 * Admin Routes
 * Super admin operations and system management
 */

import { Router } from 'express';
import { getDatabase } from '../db/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { tenantsGauge } from '../lib/metrics.js';

const router = Router();

// All admin routes require super admin role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const db = getDatabase();

  const [
    tenantCount,
    userCount,
    callCount,
    bookingCount,
    activeCallCount,
    recentCalls,
    tenantsByPlan,
  ] = await Promise.all([
    db.tenant.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null } }),
    db.call.count(),
    db.booking.count(),
    db.call.count({ where: { status: { in: ['PENDING', 'ACTIVE'] } } }),
    db.call.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        tenant: { select: { name: true } },
      },
    }),
    db.tenant.groupBy({
      by: ['planId'],
      _count: true,
      where: { deletedAt: null },
    }),
  ]);

  // Update metrics
  for (const plan of tenantsByPlan) {
    tenantsGauge.set({ plan: plan.planId }, plan._count);
  }

  res.json({
    success: true,
    data: {
      tenants: tenantCount,
      users: userCount,
      calls: {
        total: callCount,
        active: activeCallCount,
      },
      bookings: bookingCount,
      tenantsByPlan: tenantsByPlan.reduce((acc, p) => {
        acc[p.planId] = p._count;
        return acc;
      }, {}),
      recentCalls: recentCalls.map(c => ({
        id: c.id,
        tenant: c.tenant?.name,
        status: c.status,
        duration: c.durationSeconds,
        createdAt: c.createdAt,
      })),
    },
  });
}));

/**
 * GET /api/admin/tenants
 * List all tenants with details
 */
router.get('/tenants', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search, plan } = req.query;
  const db = getDatabase();

  const where = {
    deletedAt: null,
    ...(plan && { planId: plan }),
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
            bookings: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
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
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

/**
 * GET /api/admin/audit-logs
 * Get system audit logs
 */
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    action,
    tenantId,
    userId,
    startDate,
    endDate,
  } = req.query;

  const db = getDatabase();

  const where = {
    ...(action && { action: { contains: action } }),
    ...(tenantId && { tenantId }),
    ...(userId && { userId }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        tenant: { select: { name: true } },
        user: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit),
    }),
    db.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

/**
 * POST /api/admin/tenants/:id/impersonate
 * Get impersonation token for tenant admin
 */
router.post('/tenants/:id/impersonate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: 'TENANT_ADMIN', isActive: true },
        take: 1,
      },
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  if (tenant.users.length === 0) {
    throw new Error('No tenant admin found');
  }

  const { generateToken } = await import('../middleware/auth.js');
  const token = generateToken(tenant.users[0]);

  // Log impersonation
  await db.auditLog.create({
    data: {
      tenantId: id,
      userId: req.user.id,
      action: 'admin.impersonate',
      resourceType: 'tenant',
      resourceId: id,
      ipAddress: req.ip,
    },
  });

  logger.warn('Admin impersonation', {
    adminId: req.user.id,
    tenantId: id,
    impersonatedUser: tenant.users[0].id,
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: tenant.users[0].id,
        email: tenant.users[0].email,
        displayName: tenant.users[0].displayName,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    },
  });
}));

/**
 * POST /api/admin/cleanup
 * Run cleanup tasks
 */
router.post('/cleanup', asyncHandler(async (req, res) => {
  const { type } = req.body;
  const db = getDatabase();

  let result = {};

  switch (type) {
    case 'expired_tokens':
      const tokenResult = await db.token.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      result = { deletedTokens: tokenResult.count };
      break;

    case 'old_audit_logs':
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const logResult = await db.auditLog.deleteMany({
        where: { createdAt: { lt: thirtyDaysAgo } },
      });
      result = { deletedLogs: logResult.count };
      break;

    case 'orphaned_transcripts':
      // Find transcripts without calls
      const orphanedTranscripts = await db.transcript.findMany({
        where: {
          call: null,
        },
        select: { id: true },
      });
      
      if (orphanedTranscripts.length > 0) {
        await db.transcript.deleteMany({
          where: { id: { in: orphanedTranscripts.map(t => t.id) } },
        });
      }
      result = { deletedTranscripts: orphanedTranscripts.length };
      break;

    default:
      result = { message: 'Unknown cleanup type' };
  }

  logger.info('Cleanup task executed', { type, result });

  res.json({
    success: true,
    data: result,
  });
}));

/**
 * GET /api/admin/system
 * Get system information
 */
router.get('/system', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV,
      pid: process.pid,
    },
  });
}));

export default router;
