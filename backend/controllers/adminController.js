const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { blacklistAllForUser } = require('../utils/tokenBlacklist');
const logger = require('../config/logger');

/**
 * Get all users (admin only)
 * Filtered response — sensitive fields excluded
 */
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('email name role twoFactorEnabled failedLoginAttempts lockUntil createdAt')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: {
                count: users.length,
                users,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'admin_get_users_error', requestId: req.requestId }, 'Failed to get users');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve users',
        });
    }
};

/**
 * Force logout a specific user (admin only)
 * Revokes all refresh tokens + blacklists all access tokens
 */
const forceLogout = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Revoke all refresh tokens for the user
        await RefreshToken.revokeAllForUser(userId);

        // Blacklist all existing access tokens (mass revocation)
        await blacklistAllForUser(userId);

        logger.warn(
            {
                adminId: req.user.id,
                targetUserId: userId,
                action: 'admin_force_logout',
                requestId: req.requestId,
            },
            `Admin force-logged out user ${userId}`
        );

        return res.status(200).json({
            success: true,
            message: `All sessions for user ${userId} have been invalidated`,
        });
    } catch (err) {
        logger.error({ err, action: 'admin_force_logout_error', requestId: req.requestId }, 'Force logout failed');
        return res.status(500).json({
            success: false,
            message: 'Force logout failed',
        });
    }
};

module.exports = { getAllUsers, forceLogout };
