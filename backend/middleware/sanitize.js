const mongoSanitize = require('express-mongo-sanitize');
const logger = require('../config/logger');

/**
 * NoSQL injection sanitization middleware
 *
 * Strips keys starting with '$' from req.body, req.query, req.params
 * Prevents MongoDB operator injection (e.g., { "$gt": "" } in password field)
 *
 * Note: This does NOT protect against injection in aggregation pipelines.
 * Aggregation stages must be audited separately — never pass user input
 * into $where, $function, or dynamic pipeline stages.
 */
const sanitize = () => {
    return (req, res, next) => {
        const hasDollarKeys = (obj) => {
            if (typeof obj !== 'object' || obj === null) return false;
            return JSON.stringify(obj).includes('"$');
        };

        // Log if malicious input detected (before sanitization)
        if (hasDollarKeys(req.body) || hasDollarKeys(req.query) || hasDollarKeys(req.params)) {
            logger.warn(
                {
                    ip: req.ip,
                    path: req.originalUrl,
                    action: 'nosql_injection_attempt',
                },
                '🚨 NoSQL injection attempt detected and sanitized'
            );
        }

        // Apply express-mongo-sanitize
        mongoSanitize({ replaceWith: '_' })(req, res, next);
    };
};

module.exports = { sanitize };
