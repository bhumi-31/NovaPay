const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * CSRF Protection using Double-Submit Cookie pattern
 *
 * How it works:
 * 1. On GET /api/auth/csrf-token, server generates a random token
 * 2. Token is set as an HttpOnly cookie AND returned in the response body
 * 3. Client sends the token in X-CSRF-Token header on state-changing requests
 * 4. Server compares the cookie value with the header value
 *
 * This is stateless (no server-side session needed) and works with SPAs.
 */

const CSRF_COOKIE = '_csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a CSRF token and set it as a cookie
 */
const generateCsrfToken = (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');

    res.cookie(CSRF_COOKIE, token, {
        httpOnly: true,
        secure: false, // Hackathon mode: allow over HTTP for local testing
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
    });

    return token;
};

/**
 * Validate CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
 */
const csrfProtection = (req, res, next) => {
    // Skip for safe HTTP methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken) {
        logger.warn(
            {
                ip: req.ip,
                path: req.originalUrl,
                action: 'csrf_missing',
            },
            'CSRF token missing'
        );
        return res.status(403).json({
            success: false,
            message: 'CSRF token missing',
        });
    }

    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(cookieToken, headerToken)) {
        logger.warn(
            {
                ip: req.ip,
                path: req.originalUrl,
                action: 'csrf_mismatch',
            },
            '🚨 CSRF token mismatch — possible CSRF attack'
        );
        return res.status(403).json({
            success: false,
            message: 'CSRF token invalid',
        });
    }

    next();
};

/**
 * Timing-safe string comparison
 */
const timingSafeEqual = (a, b) => {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

module.exports = { csrfProtection, generateCsrfToken };
