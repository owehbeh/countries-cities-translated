const redis = require('redis');

let client;

const connectRedis = async () => {
  try {
    client = redis.createClient({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('Redis server refused connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      console.log('Connected to Redis');
    });

    client.on('ready', () => {
      console.log('Redis client ready');
    });

    client.on('end', () => {
      console.log('Redis connection closed');
    });

    await client.connect();
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!client) {
    throw new Error('Redis client not initialized');
  }
  return client;
};

const closeRedis = async () => {
  if (client) {
    await client.quit();
  }
};

const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    const result = await client.get(key);
    return result ? JSON.parse(result) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
};

const cacheSet = async (key, value, expiration = 0) => {
  try {
    const client = getRedisClient();
    if (expiration > 0) {
      await client.setEx(key, expiration, JSON.stringify(value));
    } else {
      // No expiration - persist forever
      await client.set(key, JSON.stringify(value));
    }
    return true;
  } catch (error) {
    console.error('Redis SET error:', error);
    return false;
  }
};

const cacheDelete = async (key) => {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Redis DELETE error:', error);
    return false;
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis,
  cacheGet,
  cacheSet,
  cacheDelete
};