const { verifyAccessToken } = require('../utils/jwt');
const { isBlacklisted, isUserRevoked } = require('../utils/tokenBlacklist');
const logger = require('../config/logger');

/**
 * Authentication middleware
 * - Extracts JWT from Authorization header
 * - Verifies token signature + iss + aud claims
 * - Checks Redis blacklist (per-token and per-user revocation)
 * - Attaches decoded user to req.user
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied — no token provided',
            });
        }

        const token = authHeader.split(' ')[1];

        // 1. Verify token signature + claims
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (err) {
            const message =
                err.name === 'TokenExpiredError'
                    ? 'Token expired'
                    : err.name === 'JsonWebTokenError'
                        ? 'Invalid token'
                        : 'Token verification failed';

            return res.status(401).json({ success: false, message });
        }

        // 2. Check per-token blacklist
        if (decoded.jti && (await isBlacklisted(decoded.jti))) {
            logger.warn(
                { userId: decoded.sub, jti: decoded.jti, action: 'blacklisted_token_used' },
                'Blacklisted token used'
            );
            return res.status(401).json({
                success: false,
                message: 'Token has been revoked',
            });
        }

        // 3. Check per-user mass revocation
        if (await isUserRevoked(decoded.sub, decoded.iat)) {
            logger.warn(
                { userId: decoded.sub, action: 'revoked_user_token_used' },
                'Token used after mass revocation'
            );
            return res.status(401).json({
                success: false,
                message: 'All sessions have been invalidated — please login again',
            });
        }

        // 4. Attach user payload to request
        req.user = {
            id: decoded.sub,
            role: decoded.role,
            email: decoded.email,
            jti: decoded.jti,
            iat: decoded.iat,
            exp: decoded.exp,
        };

        next();
    } catch (err) {
        logger.error({ err, action: 'auth_middleware_error' }, 'Auth middleware unexpected error');
        return res.status(500).json({
            success: false,
            message: 'Authentication error',
        });
    }
};

module.exports = { authenticate };
