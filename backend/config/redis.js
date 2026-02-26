const Redis = require('ioredis');
const logger = require('./logger');

let redis;

const connectRedis = () => {
    redis = new Redis(process.env.REDIS_URI, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            const delay = Math.min(times * 200, 5000);
            return delay;
        },
        lazyConnect: false,
    });

    redis.on('connect', () => {
        logger.info('Redis connected');
    });

    redis.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
    });

    redis.on('close', () => {
        logger.warn('Redis connection closed');
    });

    return redis;
};

const getRedis = () => {
    if (!redis) {
        throw new Error('Redis not initialized — call connectRedis() first');
    }
    return redis;
};

module.exports = { connectRedis, getRedis };
