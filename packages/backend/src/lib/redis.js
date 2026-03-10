/**
 * Redis Client
 * Connection management for caching and pub/sub
 */

import Redis from 'ioredis';
import config from '../config/index.js';
import { logger } from './logger.js';

let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

/**
 * Initialize Redis connection
 */
export async function initializeRedis() {
  try {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    await redisClient.connect();

    // Create pub/sub clients
    redisPubClient = redisClient.duplicate();
    redisSubClient = redisClient.duplicate();

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client
 */
export function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Get Redis pub client
 */
export function getRedisPubClient() {
  if (!redisPubClient) {
    throw new Error('Redis pub client not initialized');
  }
  return redisPubClient;
}

/**
 * Get Redis sub client
 */
export function getRedisSubClient() {
  if (!redisSubClient) {
    throw new Error('Redis sub client not initialized');
  }
  return redisSubClient;
}

/**
 * Cache helper functions
 */
export class Cache {
  static async get(key) {
    const client = getRedisClient();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  }

  static async set(key, value, ttlSeconds = 3600) {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  static async del(key) {
    const client = getRedisClient();
    await client.del(key);
  }

  static async delPattern(pattern) {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  static async incr(key) {
    const client = getRedisClient();
    return client.incr(key);
  }

  static async expire(key, ttlSeconds) {
    const client = getRedisClient();
    await client.expire(key, ttlSeconds);
  }
}

/**
 * Rate limiter using Redis
 */
export class RateLimiter {
  static async checkLimit(key, maxRequests, windowSeconds) {
    const client = getRedisClient();
    const current = await client.incr(key);
    
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }
    
    return {
      allowed: current <= maxRequests,
      current,
      remaining: Math.max(0, maxRequests - current),
    };
  }
}

/**
 * Distributed lock using Redis
 */
export class DistributedLock {
  static async acquire(lockKey, ttlSeconds = 30) {
    const client = getRedisClient();
    const lockValue = `${Date.now()}-${Math.random()}`;
    const acquired = await client.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
    return acquired ? lockValue : null;
  }

  static async release(lockKey, lockValue) {
    const client = getRedisClient();
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    return client.eval(script, 1, lockKey, lockValue);
  }
}

export default { initializeRedis, getRedisClient, Cache, RateLimiter, DistributedLock };
