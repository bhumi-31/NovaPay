const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Structured request logging middleware
 *
 * - Generates X-Request-ID if not present (or uses one from Nginx)
 * - Logs every request with structured fields for SIEM compatibility
 * - Fields: timestamp, requestId, userId, ip, method, path, statusCode, duration
 */
const requestLogger = (req, res, next) => {
    // Generate or use existing X-Request-ID
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const startTime = Date.now();

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;

        const logData = {
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            duration: `${duration}ms`,
            userId: req.user?.id || null,
            action: 'http_request',
        };

        // Log level based on status code
        if (res.statusCode >= 500) {
            logger.error(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
        } else if (res.statusCode >= 400) {
            logger.warn(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
        } else {
            logger.info(logData, `${req.method} ${req.originalUrl} ${res.statusCode}`);
        }
    });

    next();
};

module.exports = { requestLogger };
