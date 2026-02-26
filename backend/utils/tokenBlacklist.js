const { getRedis } = require('../config/redis');
const logger = require('../config/logger');

const BLACKLIST_PREFIX = 'bl:';

/**
 * Add a token's JTI to the Redis blacklist
 * TTL = remaining time until token expiry
 */
const blacklist = async (jti, ttlSeconds) => {
    try {
        const redis = getRedis();
        const key = `${BLACKLIST_PREFIX}${jti}`;

        // Set with auto-expiry so blacklist is self-cleaning
        await redis.set(key, '1', 'EX', ttlSeconds);

        logger.debug({ jti }, 'Token blacklisted');
    } catch (err) {
        logger.error({ err, jti }, 'Failed to blacklist token');
        throw err;
    }
};

/**
 * Check if a token JTI is blacklisted — O(1) lookup
 */
const isBlacklisted = async (jti) => {
    try {
        const redis = getRedis();
        const key = `${BLACKLIST_PREFIX}${jti}`;
        const result = await redis.exists(key);
        return result === 1;
    } catch (err) {
        logger.error({ err, jti }, 'Blacklist check failed — denying by default');
        // Fail-closed: if Redis is down, deny the request
        return true;
    }
};

/**
 * Blacklist all active tokens for a user by storing a "revoke-all" timestamp
 */
const blacklistAllForUser = async (userId) => {
    try {
        const redis = getRedis();
        const key = `revoke-all:${userId}`;
        // Store current timestamp — all tokens issued before this are invalid
        await redis.set(key, Date.now().toString(), 'EX', 7 * 24 * 60 * 60); // 7 days
        logger.info({ userId }, 'All tokens revoked for user');
    } catch (err) {
        logger.error({ err, userId }, 'Failed to revoke all tokens for user');
        throw err;
    }
};

/**
 * Check if a user's tokens have been mass-revoked
 */
const isUserRevoked = async (userId, tokenIssuedAt) => {
    try {
        const redis = getRedis();
        const key = `revoke-all:${userId}`;
        const revokedAt = await redis.get(key);

        if (!revokedAt) return false;

        // Token was issued before the revocation — it's invalid
        return tokenIssuedAt * 1000 < parseInt(revokedAt, 10);
    } catch (err) {
        logger.error({ err, userId }, 'User revocation check failed — denying by default');
        return true; // Fail-closed
    }
};

module.exports = { blacklist, isBlacklisted, blacklistAllForUser, isUserRevoked };
