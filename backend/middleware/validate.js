const logger = require('../config/logger');

/**
 * Joi validation middleware factory
 *
 * Uses ALLOWLIST mode:
 * - Only defined fields are accepted
 * - Unknown fields are rejected (not stripped silently)
 * - Type coercion is DISABLED — unexpected types are rejected
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,     // Report all errors, not just first
            allowUnknown: false,   // Reject unknown fields (allowlist mode)
            stripUnknown: false,   // Don't silently strip — reject instead
            convert: false,        // Disable type coercion
        });

        if (error) {
            const details = error.details.map((d) => ({
                field: d.path.join('.'),
                message: d.message,
            }));

            logger.warn(
                {
                    ip: req.ip,
                    path: req.originalUrl,
                    errors: details,
                    action: 'validation_failed',
                },
                'Input validation failed'
            );

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: details,
            });
        }

        // Replace request source with validated & sanitized value
        req[source] = value;
        next();
    };
};

module.exports = { validate };
