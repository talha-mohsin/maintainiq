/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Redis from 'ioredis';

let redisClient = null;
const inMemoryCache = new Map();

const REDIS_URL = process.env.REDIS_URL;

if (REDIS_URL) {
  try {
    console.log(`🔌 Initializing Redis Cache with URL: ${REDIS_URL}`);
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 3) {
          console.warn("⚠️ Redis connection failed 3 times. Falling back to in-memory caching.");
          return null; // stop retrying
        }
        return Math.min(times * 100, 1000);
      }
    });

    redisClient.on('error', (err) => {
      console.warn("⚠️ Redis client error:", err.message);
    });

    redisClient.on('connect', () => {
      console.log("🚀 Redis connected successfully. Caching is live on Redis.");
    });
  } catch (error) {
    console.warn("⚠️ Could not construct Redis client, falling back to In-Memory Caching:", error.message);
    redisClient = null;
  }
} else {
  console.log("ℹ️ No REDIS_URL environment variable found. Using In-Memory Caching fallback.");
}

export const cacheService = {
  /**
   * Get a cached value
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async get(key) {
    if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.warn(`⚠️ Redis GET error for key ${key}:`, err.message);
      }
    }

    // In-Memory fallback
    const entry = inMemoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      inMemoryCache.delete(key);
      return null;
    }

    return entry.value;
  },

  /**
   * Set a cached value
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlSeconds 
   */
  async set(key, value, ttlSeconds = 300) {
    if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
      try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch (err) {
        console.warn(`⚠️ Redis SET error for key ${key}:`, err.message);
      }
    }

    // In-Memory fallback
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    inMemoryCache.set(key, {
      value,
      expiresAt
    });
  },

  /**
   * Invalidate a cached value
   * @param {string} key 
   */
  async del(key) {
    if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
      try {
        await redisClient.del(key);
        return;
      } catch (err) {
        console.warn(`⚠️ Redis DEL error for key ${key}:`, err.message);
      }
    }

    inMemoryCache.delete(key);
  },

  /**
   * Invalidate all keys matching a pattern/prefix
   * @param {string} prefix 
   */
  async invalidatePattern(prefix) {
    console.log(`🧹 Invalidating cache keys starting with: ${prefix}`);
    if (redisClient && (redisClient.status === 'ready' || redisClient.status === 'connect')) {
      try {
        const keys = await redisClient.keys(`${prefix}*`);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
        return;
      } catch (err) {
        console.warn(`⚠️ Redis key invalidation error for prefix ${prefix}:`, err.message);
      }
    }

    // In-Memory key cleanup
    for (const key of inMemoryCache.keys()) {
      if (key.startsWith(prefix)) {
        inMemoryCache.delete(key);
      }
    }
  }
};
