const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Get current user's profile
 * Response data is filtered based on the user's role
 */
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Role-based field filtering — users see only their own data
        const profileData = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            twoFactorEnabled: user.twoFactorEnabled,
            createdAt: user.createdAt,
        };

        // Admins get extra metadata
        if (req.user.role === 'admin') {
            profileData.failedLoginAttempts = user.failedLoginAttempts;
            profileData.isLocked = user.isLocked;
            profileData.lockUntil = user.lockUntil;
            profileData.googleId = user.googleId ? '[linked]' : null;
        }

        return res.status(200).json({
            success: true,
            data: profileData,
        });
    } catch (err) {
        logger.error({ err, action: 'profile_error', requestId: req.requestId }, 'Failed to get profile');
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile',
        });
    }
};

module.exports = { getProfile };
