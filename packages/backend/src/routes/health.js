/**
 * Health Check Routes
 * Application health and readiness endpoints
 */

import { Router } from 'express';
import { getDatabase } from '../db/index.js';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready
 * Readiness probe - checks all dependencies
 */
router.get('/ready', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
  };

  try {
    // Check database
    const db = getDatabase();
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
  }

  try {
    // Check Redis
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = true;
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
  }

  const isReady = Object.values(checks).every(Boolean);

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/detailed
 * Detailed health status
 */
router.get('/detailed', async (req, res) => {
  const status = {
    service: 'voxreception-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {},
  };

  // Database check
  try {
    const db = getDatabase();
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    status.checks.database = {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    status.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  // Redis check
  try {
    const redis = getRedisClient();
    const start = Date.now();
    await redis.ping();
    status.checks.redis = {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    status.checks.redis = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  const allHealthy = Object.values(status.checks).every(
    check => check.status === 'healthy'
  );

  res.status(allHealthy ? 200 : 503).json(status);
});

export default router;
