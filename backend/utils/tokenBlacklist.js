const { getRedis } = require('../config/redis');
const logger = require('../config/logger');

const BLACKLIST_PREFIX = 'bl:';

// --- IN-MEMORY FALLBACK FOR HACKATHON ---
const memoryBlacklist = new Map(); // jti -> expiryTimestamp
const memoryRevokedUsers = new Map(); // userId -> revokedTimestamp

// Cleanup interval for memory maps
setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of memoryBlacklist.entries()) {
        if (now > exp) memoryBlacklist.delete(jti);
    }
}, 60 * 60 * 1000).unref();

const isRedisAlive = () => {
    try {
        const redis = getRedis();
        return redis.status === 'ready';
    } catch (err) {
        return false;
    }
};
// ----------------------------------------

/**
 * Add a token's JTI to the Redis blacklist (or memory fallback)
 * TTL = remaining time until token expiry
 */
const blacklist = async (jti, ttlSeconds) => {
    try {
        if (isRedisAlive()) {
            const redis = getRedis();
            const key = `${BLACKLIST_PREFIX}${jti}`;
            // Set with auto-expiry so blacklist is self-cleaning
            await redis.set(key, '1', 'EX', ttlSeconds);
        } else {
            memoryBlacklist.set(jti, Date.now() + (ttlSeconds * 1000));
            logger.info({ jti }, 'Token blacklisted in memory (Redis fallback)');
        }
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
        if (isRedisAlive()) {
            const redis = getRedis();
            const key = `${BLACKLIST_PREFIX}${jti}`;
            const result = await redis.exists(key);
            return result === 1;
        } else {
            const exp = memoryBlacklist.get(jti);
            if (exp && Date.now() < exp) return true;
            return false;
        }
    } catch (err) {
        logger.error({ err, jti }, 'Blacklist check failed — allowing fallback');
        // Hackathon modification: if Redis is down, allow it rather than locking everyone out
        return false;
    }
};

/**
 * Blacklist all active tokens for a user by storing a "revoke-all" timestamp
 */
const blacklistAllForUser = async (userId) => {
    try {
        if (isRedisAlive()) {
            const redis = getRedis();
            const key = `revoke-all:${userId}`;
            // Store current timestamp — all tokens issued before this are invalid
            await redis.set(key, Date.now().toString(), 'EX', 7 * 24 * 60 * 60); // 7 days
        } else {
            memoryRevokedUsers.set(userId.toString(), Date.now());
            logger.info({ userId }, 'All tokens revoked in memory (Redis fallback)');
        }
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
        let revokedAt;
        if (isRedisAlive()) {
            const redis = getRedis();
            const key = `revoke-all:${userId}`;
            revokedAt = await redis.get(key);
        } else {
            revokedAt = memoryRevokedUsers.get(userId.toString());
        }

        if (!revokedAt) return false;

        // Token was issued before the revocation — it's invalid
        return tokenIssuedAt * 1000 < parseInt(revokedAt, 10);
    } catch (err) {
        logger.error({ err, userId }, 'User revocation check failed — allowing fallback');
        // Hackathon modification: fail open to allow testing
        return false;
    }
};

module.exports = { blacklist, isBlacklisted, blacklistAllForUser, isUserRevoked };
