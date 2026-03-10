/**
 * Call Queue Service
 * Redis-backed call queue for managing concurrent call limits
 * Queues callers when tenant is at max concurrent capacity
 */

import { getRedisClient } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { getDatabase } from '../db/index.js';
import config from '../config/index.js';

const QUEUE_PREFIX = 'callqueue:';
const ACTIVE_PREFIX = 'activecalls:';
const QUEUE_TTL = 600; // 10 minutes max wait in queue
const ACTIVE_TTL = 7200; // 2 hours max call duration tracking

/**
 * Get the concurrent call limit for a tenant's plan
 * @param {string} planId - Plan type (BASIC, PRO, ENTERPRISE)
 * @returns {number} Max concurrent calls (-1 for unlimited)
 */
export function getConcurrentLimit(planId) {
  const plan = config.plans[planId?.toLowerCase()] || config.plans.basic;
  return plan.maxConcurrentCalls;
}

/**
 * Get the current count of active calls for a tenant
 * @param {string} tenantId
 * @returns {Promise<number>}
 */
export async function getActiveCallCount(tenantId) {
  const redis = getRedisClient();
  const key = `${ACTIVE_PREFIX}${tenantId}`;
  const members = await redis.smembers(key);
  return members.length;
}

/**
 * Register a call as active
 * @param {string} tenantId
 * @param {string} callId
 */
export async function registerActiveCall(tenantId, callId) {
  const redis = getRedisClient();
  const key = `${ACTIVE_PREFIX}${tenantId}`;
  await redis.sadd(key, callId);
  await redis.expire(key, ACTIVE_TTL);
  logger.debug('Call registered as active', { tenantId, callId });
}

/**
 * Unregister a call (call ended)
 * @param {string} tenantId
 * @param {string} callId
 */
export async function unregisterActiveCall(tenantId, callId) {
  const redis = getRedisClient();
  const key = `${ACTIVE_PREFIX}${tenantId}`;
  await redis.srem(key, callId);
  logger.debug('Call unregistered', { tenantId, callId });

  // Check if there are queued callers to promote
  await promoteNextInQueue(tenantId);
}

/**
 * Check if tenant can accept a new call
 * @param {string} tenantId
 * @param {string} planId
 * @returns {Promise<{ allowed: boolean, position?: number, activeCount: number, limit: number }>}
 */
export async function canAcceptCall(tenantId, planId) {
  const limit = getConcurrentLimit(planId);
  const activeCount = await getActiveCallCount(tenantId);

  // Unlimited
  if (limit === -1) {
    return { allowed: true, activeCount, limit: -1 };
  }

  if (activeCount < limit) {
    return { allowed: true, activeCount, limit };
  }

  return { allowed: false, activeCount, limit };
}

/**
 * Add a caller to the queue
 * @param {string} tenantId
 * @param {string} callId
 * @param {Object} callerInfo - { name, phone, visitorId }
 * @returns {Promise<{ position: number, estimatedWait: number }>}
 */
export async function addToQueue(tenantId, callId, callerInfo = {}) {
  const redis = getRedisClient();
  const queueKey = `${QUEUE_PREFIX}${tenantId}`;

  const entry = JSON.stringify({
    callId,
    ...callerInfo,
    enqueuedAt: Date.now(),
  });

  await redis.rpush(queueKey, entry);
  await redis.expire(queueKey, QUEUE_TTL);

  const position = await redis.llen(queueKey);

  logger.info('Caller added to queue', { tenantId, callId, position });

  return {
    position,
    estimatedWait: position * 120, // ~2 min per call estimate
  };
}

/**
 * Remove a caller from the queue
 * @param {string} tenantId
 * @param {string} callId
 */
export async function removeFromQueue(tenantId, callId) {
  const redis = getRedisClient();
  const queueKey = `${QUEUE_PREFIX}${tenantId}`;

  const entries = await redis.lrange(queueKey, 0, -1);
  for (const entry of entries) {
    const parsed = JSON.parse(entry);
    if (parsed.callId === callId) {
      await redis.lrem(queueKey, 1, entry);
      logger.info('Caller removed from queue', { tenantId, callId });
      break;
    }
  }
}

/**
 * Get the current queue for a tenant
 * @param {string} tenantId
 * @returns {Promise<Array>}
 */
export async function getQueue(tenantId) {
  const redis = getRedisClient();
  const queueKey = `${QUEUE_PREFIX}${tenantId}`;
  const entries = await redis.lrange(queueKey, 0, -1);
  return entries.map((e, idx) => ({
    ...JSON.parse(e),
    position: idx + 1,
  }));
}

/**
 * Get a caller's position in the queue
 * @param {string} tenantId
 * @param {string} callId
 * @returns {Promise<number|null>} Position (1-based) or null if not in queue
 */
export async function getQueuePosition(tenantId, callId) {
  const queue = await getQueue(tenantId);
  const entry = queue.find((e) => e.callId === callId);
  return entry ? entry.position : null;
}

/**
 * Promote the next caller in queue when a slot opens
 * @param {string} tenantId
 */
async function promoteNextInQueue(tenantId) {
  const redis = getRedisClient();
  const queueKey = `${QUEUE_PREFIX}${tenantId}`;

  const db = getDatabase();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { planId: true },
  });

  if (!tenant) return;

  const { allowed } = await canAcceptCall(tenantId, tenant.planId);
  if (!allowed) return;

  // Pop the next caller
  const nextEntry = await redis.lpop(queueKey);
  if (!nextEntry) return;

  const caller = JSON.parse(nextEntry);

  // Update the call to PENDING so it can be connected
  try {
    await db.call.update({
      where: { id: caller.callId },
      data: {
        status: 'PENDING',
        metadata: {
          ...((await db.call.findUnique({ where: { id: caller.callId }, select: { metadata: true } }))?.metadata || {}),
          promotedFromQueue: true,
          queuedAt: caller.enqueuedAt,
          promotedAt: Date.now(),
        },
      },
    });

    logger.info('Caller promoted from queue', {
      tenantId,
      callId: caller.callId,
    });
  } catch (error) {
    logger.error('Failed to promote caller from queue', {
      error: error.message,
      tenantId,
      callId: caller.callId,
    });
  }
}

/**
 * Get queue + active call stats for a tenant
 * @param {string} tenantId
 * @param {string} planId
 * @returns {Promise<Object>}
 */
export async function getCallCapacityStats(tenantId, planId) {
  const limit = getConcurrentLimit(planId);
  const activeCount = await getActiveCallCount(tenantId);
  const queue = await getQueue(tenantId);

  return {
    activeCount,
    limit: limit === -1 ? 'unlimited' : limit,
    available: limit === -1 ? 'unlimited' : Math.max(0, limit - activeCount),
    queueLength: queue.length,
    queue,
  };
}

export default {
  getConcurrentLimit,
  getActiveCallCount,
  registerActiveCall,
  unregisterActiveCall,
  canAcceptCall,
  addToQueue,
  removeFromQueue,
  getQueue,
  getQueuePosition,
  getCallCapacityStats,
};
