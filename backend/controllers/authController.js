const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const RefreshToken = require('../models/RefreshToken');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { generateFingerprint } = require('../utils/deviceFingerprint');
const { blacklist, isBlacklisted } = require('../utils/tokenBlacklist');
const { detectAnomalies, recordLoginAttempt } = require('../utils/anomalyDetector');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists',
            });
        }

        // Create user (password hashed by pre-save hook)
        const user = await User.create({ email, password, name });

        // Auto-create wallet with seed balance
        await Wallet.create({ userId: user._id, balance: 1000.00 });

        // Generate tokens
        const deviceFp = generateFingerprint(req);
        const { token: accessToken, jti: accessJti } = generateAccessToken(user);
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

        logger.info(
            { userId: user._id, action: 'user_registered', requestId: req.requestId },
            'New user registered'
        );

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshTokenValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: expiryDays * 24 * 60 * 60 * 1000,
            path: '/api/auth/refresh',
        });

        return res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: {
                user: user.toJSON(),
                accessToken,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'register_error', requestId: req.requestId }, 'Registration failed');
        return res.status(500).json({
            success: false,
            message: 'Registration failed',
        });
    }
};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = req.ip;
        const userAgent = req.headers['user-agent'] || '';

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            await recordLoginAttempt({ email, userId: null, ip, userAgent, success: false, reason: 'user_not_found' });
            await detectAnomalies(email);

            // Generic message to prevent user enumeration
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check account lockout
        if (user.isLocked) {
            await recordLoginAttempt({ email, userId: user._id, ip, userAgent, success: false, reason: 'account_locked' });

            logger.warn(
                { userId: user._id, action: 'locked_login_attempt', ip, requestId: req.requestId },
                'Login attempt on locked account'
            );

            return res.status(423).json({
                success: false,
                message: 'Account is temporarily locked — please try again later',
            });
        }

        // Verify password
        if (!user.password) {
            // OAuth-only account
            return res.status(401).json({
                success: false,
                message: 'This account uses Google Sign-In — please login with Google',
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            await user.incrementLoginAttempts();
            await recordLoginAttempt({ email, userId: user._id, ip, userAgent, success: false, reason: 'invalid_password' });
            await detectAnomalies(email);

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Successful login — reset failed attempts
        await user.resetLoginAttempts();
        await recordLoginAttempt({ email, userId: user._id, ip, userAgent, success: true, reason: 'success' });

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

        logger.info(
            { userId: user._id, action: 'user_login', ip, requestId: req.requestId },
            'User logged in successfully'
        );

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshTokenValue, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: expiryDays * 24 * 60 * 60 * 1000,
            path: '/api/auth/refresh',
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: user.toJSON(),
                accessToken,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'login_error', requestId: req.requestId }, 'Login failed');
        return res.status(500).json({
            success: false,
            message: 'Login failed',
        });
    }
};

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
const logout = async (req, res) => {
    try {
        // Blacklist current access token
        if (req.user?.jti && req.user?.exp) {
            const ttl = req.user.exp - Math.floor(Date.now() / 1000);
            if (ttl > 0) {
                await blacklist(req.user.jti, ttl);
            }
        }

        // Revoke refresh token from cookie
        const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
        if (refreshTokenValue) {
            const tokenHash = RefreshToken.hashToken(refreshTokenValue);
            const storedToken = await RefreshToken.findOne({ tokenHash });
            if (storedToken) {
                // Revoke entire family
                await RefreshToken.revokeFamily(storedToken.family);
            }
        }

        // Clear refresh token cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh',
        });

        logger.info(
            { userId: req.user?.id, action: 'user_logout', requestId: req.requestId },
            'User logged out'
        );

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (err) {
        logger.error({ err, action: 'logout_error', requestId: req.requestId }, 'Logout failed');
        return res.status(500).json({
            success: false,
            message: 'Logout failed',
        });
    }
};

// ─────────────────────────────────────────────
// REFRESH TOKEN (mandatory rotation)
// ─────────────────────────────────────────────
const refresh = async (req, res) => {
    try {
        // Get refresh token from cookie or body
        const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshTokenValue) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required',
            });
        }

        // Verify refresh token JWT
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshTokenValue);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
            });
        }

        // Find stored token by hash
        const tokenHash = RefreshToken.hashToken(refreshTokenValue);
        const storedToken = await RefreshToken.findOne({ tokenHash });

        // ─── REUSE DETECTION ───
        // If token not found but JWT is valid → token was already rotated → THEFT DETECTED
        if (!storedToken) {
            logger.warn(
                {
                    userId: decoded.sub,
                    family: decoded.family,
                    action: 'SECURITY_ALERT',
                    alert: 'refresh_token_reuse',
                    requestId: req.requestId,
                },
                '🚨 REFRESH TOKEN REUSE DETECTED — revoking entire family'
            );

            // Revoke ALL tokens in this family
            await RefreshToken.revokeFamily(decoded.family);

            return res.status(401).json({
                success: false,
                message: 'Token reuse detected — all sessions invalidated. Please login again.',
            });
        }

        // Check if token is revoked
        if (storedToken.isRevoked) {
            logger.warn(
                {
                    userId: decoded.sub,
                    family: decoded.family,
                    action: 'revoked_token_used',
                    requestId: req.requestId,
                },
                'Revoked refresh token used'
            );

            return res.status(401).json({
                success: false,
                message: 'Session has been invalidated — please login again',
            });
        }

        // Verify device fingerprint
        const currentFingerprint = generateFingerprint(req);
        if (storedToken.deviceFingerprint !== currentFingerprint) {
            logger.warn(
                {
                    userId: decoded.sub,
                    action: 'SECURITY_ALERT',
                    alert: 'device_fingerprint_mismatch',
                    requestId: req.requestId,
                },
                '🚨 Device fingerprint mismatch on refresh — possible token theft'
            );

            // Revoke the family as a precaution
            await RefreshToken.revokeFamily(storedToken.family);

            return res.status(401).json({
                success: false,
                message: 'Session invalid — unrecognized device. Please login again.',
            });
        }

        // ─── MANDATORY ROTATION ───
        // 1. Revoke the current token
        storedToken.isRevoked = true;
        await storedToken.save();

        // 2. Get user
        const user = await User.findById(decoded.sub);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
            });
        }

        // 3. Issue new token pair (same family)
        const { token: newAccessToken } = generateAccessToken(user);
        const { token: newRefreshToken, family } = generateRefreshToken(user, storedToken.family);

        const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
        await RefreshToken.create({
            tokenHash: RefreshToken.hashToken(newRefreshToken),
            userId: user._id,
            family: storedToken.family,
            deviceFingerprint: currentFingerprint,
            expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
        });

        // Set new refresh token cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: expiryDays * 24 * 60 * 60 * 1000,
            path: '/api/auth/refresh',
        });

        logger.info(
            { userId: user._id, family: storedToken.family, action: 'token_refreshed', requestId: req.requestId },
            'Token refreshed (rotation complete)'
        );

        return res.status(200).json({
            success: true,
            message: 'Token refreshed',
            data: {
                accessToken: newAccessToken,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'refresh_error', requestId: req.requestId }, 'Token refresh failed');
        return res.status(500).json({
            success: false,
            message: 'Token refresh failed',
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    refresh,
};
