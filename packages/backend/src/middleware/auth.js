/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { getDatabase } from '../db/index.js';
import { ApiError } from './errorHandler.js';
import { logger } from '../lib/logger.js';

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret);

    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(ApiError.unauthorized('Token expired'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);

      req.user = {
        id: decoded.userId,
        tenantId: decoded.tenantId,
        role: decoded.role,
        email: decoded.email,
      };
    }

    next();
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
}

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Tenant isolation middleware
 * Ensures users can only access their own tenant's data
 */
export async function tenantIsolation(req, res, next) {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Super admins can access any tenant
    if (req.user.role === 'SUPER_ADMIN') {
      // Allow tenant override via header for super admins
      const tenantIdHeader = req.headers['x-tenant-id'];
      if (tenantIdHeader) {
        req.tenantId = tenantIdHeader;
      } else {
        req.tenantId = req.user.tenantId;
      }
      return next();
    }

    // Regular users can only access their own tenant
    req.tenantId = req.user.tenantId;

    // Validate tenant exists and is active
    const db = getDatabase();
    const tenant = await db.tenant.findUnique({
      where: { id: req.tenantId },
      select: { id: true, deletedAt: true },
    });

    if (!tenant || tenant.deletedAt) {
      return next(ApiError.forbidden('Tenant not found or inactive'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verify user belongs to tenant
 */
export async function verifyTenantMembership(req, res, next) {
  try {
    if (!req.user || !req.tenantId) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const db = getDatabase();
    const user = await db.user.findFirst({
      where: {
        id: req.user.id,
        tenantId: req.tenantId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!user) {
      return next(ApiError.forbidden('User not found in tenant'));
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  const payload = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '30d',
  });
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
}

export default {
  authenticate,
  optionalAuth,
  authorize,
  tenantIsolation,
  verifyTenantMembership,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
