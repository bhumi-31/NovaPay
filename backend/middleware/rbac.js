const logger = require('../config/logger');

/**
 * Role-Based Access Control middleware
 * Usage: authorize('admin') or authorize('user', 'admin')
 *
 * Checks req.user.role against allowed roles.
 * Must be used AFTER authenticate middleware.
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            logger.warn(
                {
                    userId: req.user.id,
                    role: req.user.role,
                    requiredRoles: allowedRoles,
                    path: req.originalUrl,
                    action: 'unauthorized_access',
                },
                'Unauthorized access attempt'
            );

            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
            });
        }

        next();
    };
};

module.exports = { authorize };
