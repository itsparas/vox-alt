/**
 * Authentication Routes
 * Login, registration, password reset, token refresh
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { body, validationResult } from 'express-validator';
import { getDatabase } from '../db/index.js';
import { authenticate, generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Validation middleware
const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('displayName').trim().isLength({ min: 2, max: 100 }),
  body('tenantName').optional().trim().isLength({ min: 2, max: 100 }),
  body('tenantId').optional().isUUID(),
];

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }

  const { email, password } = req.body;
  const db = getDatabase();

  // Find user by email
  const user = await db.user.findFirst({
    where: {
      email,
      deletedAt: null,
      isActive: true,
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planId: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Generate tokens
  const accessToken = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  // Log successful login
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  logger.info('User logged in', { userId: user.id, email: user.email });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        tenant: user.tenant,
      },
    },
  });
}));

/**
 * POST /api/auth/register
 * New user registration
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }

  const { email, password, displayName, tenantName, tenantId } = req.body;
  const db = getDatabase();

  // Check if email exists
  const existingUser = await db.user.findFirst({
    where: { email },
  });

  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  let tenant;

  if (tenantId) {
    // Join existing tenant
    tenant = await db.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw ApiError.notFound('Tenant not found');
    }
  } else {
    // Create new tenant for the user
    const slug = `tenant-${uuidv4().slice(0, 8)}`;
    tenant = await db.tenant.create({
      data: {
        name: tenantName || `${displayName}'s Organization`,
        slug,
        planId: 'BASIC',
        config: {
          create: {
            receptionistName: 'Alex',
            voiceLanguage: 'en-US',
          },
        },
      },
    });
  }

  // Create user
  const user = await db.user.create({
    data: {
      tenantId: tenant.id,
      email,
      passwordHash,
      displayName,
      role: tenantId ? 'USER' : 'TENANT_ADMIN', // First user is admin
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planId: true,
        },
      },
    },
  });

  // Generate tokens
  const accessToken = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  // Log registration
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.registered',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  logger.info('User registered', { userId: user.id, email: user.email });

  res.status(201).json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        tenant: user.tenant,
      },
    },
  });
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw ApiError.badRequest('Refresh token required');
  }

  const decoded = verifyRefreshToken(refreshToken);
  const db = getDatabase();

  const user = await db.user.findFirst({
    where: {
      id: decoded.userId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planId: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiError.unauthorized('User not found');
  }

  const accessToken = generateToken(user);
  const newRefreshToken = generateRefreshToken(user);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
}));

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const db = getDatabase();

  const user = await db.user.findUnique({
    where: { id: req.user.id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planId: true,
          config: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      tenant: user.tenant,
    },
  });
}));

/**
 * PUT /api/auth/me
 * Update current user profile
 */
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { displayName, avatarUrl } = req.body;
  const db = getDatabase();

  const user = await db.user.update({
    where: { id: req.user.id },
    data: {
      ...(displayName && { displayName }),
      ...(avatarUrl && { avatarUrl }),
    },
  });

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
}));

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current and new password required');
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  const db = getDatabase();

  const user = await db.user.findUnique({
    where: { id: req.user.id },
  });

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });

  // Log password change
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      action: 'user.password_changed',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: 'Password updated successfully',
  });
}));

/**
 * POST /api/auth/logout
 * User logout (invalidate tokens on client side)
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const db = getDatabase();

  // Log logout
  await db.auditLog.create({
    data: {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      action: 'user.logout',
      resourceType: 'user',
      resourceId: req.user.id,
      ipAddress: req.ip,
    },
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}));

export default router;
