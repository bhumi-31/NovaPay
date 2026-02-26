const crypto = require('crypto');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { generateFingerprint } = require('../utils/deviceFingerprint');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../config/logger');

/**
 * PKCE helper — generates code_verifier and code_challenge
 */
const generatePKCE = () => {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    return { codeVerifier, codeChallenge };
};

/**
 * Google OAuth callback handler
 * Called after passport authenticates the user
 */
const googleCallback = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'OAuth authentication failed',
            });
        }

        // Generate tokens
        const deviceFp = generateFingerprint(req);
        const { token: accessToken } = generateAccessToken(user);
        const { token: refreshTokenValue, family } = generateRefreshToken(user);

        // Store hashed refresh token
        const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
        await RefreshToken.create({
            tokenHash: RefreshToken.hashToken(refreshTokenValue),
            userId: user._id,
            family,
            deviceFingerprint: deviceFp,
            expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        });

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshTokenValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: expiryDays * 24 * 60 * 60 * 1000,
            path: '/api/auth/refresh',
        });

        logger.info(
            { userId: user._id, action: 'oauth_login_success', requestId: req.requestId },
            'Google OAuth login successful'
        );

        // In production, redirect to frontend with token
        // For API-only mode, return JSON
        return res.status(200).json({
            success: true,
            message: 'Google OAuth login successful',
            data: {
                user: user.toJSON(),
                accessToken,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'oauth_callback_error', requestId: req.requestId }, 'OAuth callback failed');
        return res.status(500).json({
            success: false,
            message: 'OAuth authentication failed',
        });
    }
};

module.exports = { googleCallback, generatePKCE };
