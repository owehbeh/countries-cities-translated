const redis = require('redis');

let client;

const connectRedis = async () => {
  try {
    const redisConfig = {
      socket: {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        reconnectDelay: 100,
        connectTimeout: 10000
      }
    };

    if (process.env.REDIS_PASSWORD) {
      redisConfig.password = process.env.REDIS_PASSWORD;
    }

    client = redis.createClient(redisConfig);

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

    client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });

    await client.connect();
    console.log(`Redis connected to ${redisConfig.socket.host}:${redisConfig.socket.port}`);
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.error('Redis config:', {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379,
      hasPassword: !!process.env.REDIS_PASSWORD
    });
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
    throw error;
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
    throw error;
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