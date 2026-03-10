/**
 * User Routes
 * User management within tenants
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, tenantIsolation, authorize } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/users
 * List users in tenant
 */
router.get('/',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, search, active } = req.query;
    const db = getDatabase();

    const where = {
      tenantId: req.tenantId,
      deletedAt: null,
      ...(role && { role }),
      ...(active !== undefined && { isActive: active === 'true' }),
      ...(search && {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      db.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
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
 * POST /api/users
 * Create new user in tenant
 */
router.post('/',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [
    body('email').isEmail().normalizeEmail(),
    body('displayName').trim().isLength({ min: 2, max: 100 }),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['TENANT_ADMIN', 'AGENT', 'USER']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest('Validation failed', errors.array());
    }

    const { email, displayName, password, role } = req.body;
    const db = getDatabase();

    // Check if email exists in tenant
    const existing = await db.user.findFirst({
      where: {
        email,
        tenantId: req.tenantId,
      },
    });

    if (existing) {
      throw ApiError.conflict('Email already exists in this organization');
    }

    // Only super admin can create tenant admins
    if (role === 'TENANT_ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only super admins can create tenant admins');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        tenantId: req.tenantId,
        email,
        displayName,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Log user creation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'user.created',
        resourceType: 'user',
        resourceId: user.id,
      },
    });

    logger.info('User created', { userId: user.id, email: user.email });

    res.status(201).json({
      success: true,
      data: user,
    });
  })
);

/**
 * GET /api/users/:id
 * Get user details
 */
router.get('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Users can view their own profile, admins can view any user
    if (req.user.id !== id && 
        req.user.role !== 'SUPER_ADMIN' && 
        req.user.role !== 'TENANT_ADMIN') {
      throw ApiError.forbidden('Cannot view this user');
    }

    const user = await db.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            calls: true,
            agentCalls: true,
            bookings: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id',
  authenticate,
  tenantIsolation,
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { displayName, avatarUrl, role, isActive } = req.body;
    const db = getDatabase();

    // Check permissions
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === 'SUPER_ADMIN' || req.user.role === 'TENANT_ADMIN';

    if (!isSelf && !isAdmin) {
      throw ApiError.forbidden('Cannot update this user');
    }

    // Only admins can change role and active status
    if ((role || isActive !== undefined) && !isAdmin) {
      throw ApiError.forbidden('Insufficient permissions to change role or status');
    }

    const updateData = {
      ...(displayName && { displayName }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    };

    if (isAdmin) {
      if (role) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });

    // Log update
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: id,
        metadata: { updatedFields: Object.keys(updateData) },
      },
    });

    res.json({
      success: true,
      data: user,
    });
  })
);

/**
 * POST /api/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/:id/reset-password',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [
    param('id').isUUID(),
    body('newPassword').isLength({ min: 8 }),
  ],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const db = getDatabase();

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db.user.update({
      where: { id },
      data: { passwordHash },
    });

    // Log password reset
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'user.password_reset',
        resourceType: 'user',
        resourceId: id,
      },
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  })
);

/**
 * POST /api/users/:id/deactivate
 * Deactivate user
 */
router.post('/:id/deactivate',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Prevent self-deactivation
    if (req.user.id === id) {
      throw ApiError.badRequest('Cannot deactivate your own account');
    }

    await db.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Log deactivation
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'user.deactivated',
        resourceType: 'user',
        resourceId: id,
      },
    });

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  })
);

/**
 * POST /api/users/:id/activate
 * Activate user
 */
router.post('/:id/activate',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    await db.user.update({
      where: { id },
      data: { isActive: true },
    });

    res.json({
      success: true,
      message: 'User activated successfully',
    });
  })
);

/**
 * DELETE /api/users/:id
 * Soft delete user
 */
router.delete('/:id',
  authenticate,
  tenantIsolation,
  authorize('SUPER_ADMIN', 'TENANT_ADMIN'),
  [param('id').isUUID()],
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    // Prevent self-deletion
    if (req.user.id === id) {
      throw ApiError.badRequest('Cannot delete your own account');
    }

    await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    // Log deletion
    await db.auditLog.create({
      data: {
        tenantId: req.tenantId,
        userId: req.user.id,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: id,
      },
    });

    logger.info('User deleted', { userId: id });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  })
);

/**
 * GET /api/users/agents/available
 * Get available agents
 */
router.get('/agents/available',
  authenticate,
  tenantIsolation,
  asyncHandler(async (req, res) => {
    const db = getDatabase();

    const agents = await db.user.findMany({
      where: {
        tenantId: req.tenantId,
        role: 'AGENT',
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
      },
    });

    res.json({
      success: true,
      data: agents,
    });
  })
);

export default router;
