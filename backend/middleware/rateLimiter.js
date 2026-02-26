const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests — please try again later',
    },
    handler: (req, res, next, options) => {
        logger.warn(
            {
                ip: req.ip,
                path: req.originalUrl,
                action: 'rate_limit_exceeded',
            },
            'General rate limit exceeded'
        );
        res.status(options.statusCode).json(options.message);
    },
});

/**
 * Strict auth rate limiter
 * 10 requests per 15 minutes per IP (login, register, refresh)
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts — account may be temporarily locked',
    },
    handler: (req, res, next, options) => {
        logger.warn(
            {
                ip: req.ip,
                path: req.originalUrl,
                action: 'auth_rate_limit_exceeded',
            },
            'Auth rate limit exceeded — possible brute force'
        );
        res.status(options.statusCode).json(options.message);
    },
    // Use IP + path combination as key for per-endpoint limiting
    keyGenerator: (req) => `${req.ip}:${req.path}`,
});

/**
 * 2FA rate limiter — very strict
 * 5 requests per 15 minutes per IP
 */
const twoFactorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many 2FA attempts — please wait before trying again',
    },
    handler: (req, res, next, options) => {
        logger.warn(
            {
                ip: req.ip,
                action: '2fa_rate_limit_exceeded',
            },
            '2FA rate limit exceeded'
        );
        res.status(options.statusCode).json(options.message);
    },
});

module.exports = { generalLimiter, authLimiter, twoFactorLimiter };
