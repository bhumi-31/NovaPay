const LoginAttempt = require('../models/LoginAttempt');
const logger = require('../config/logger');

/**
 * Anomaly Detection: Detects credential stuffing patterns
 *
 * Triggers if within the last 60 seconds:
 * - 5+ failed login attempts for the same email
 * - From 3+ distinct IP addresses
 *
 * This pattern strongly indicates distributed credential stuffing / bot attacks.
 */
const detectAnomalies = async (email) => {
    try {
        const windowMs = 60 * 1000; // 60-second window
        const cutoff = new Date(Date.now() - windowMs);

        const results = await LoginAttempt.aggregate([
            {
                $match: {
                    email: email.toLowerCase(),
                    success: false,
                    createdAt: { $gte: cutoff },
                },
            },
            {
                $group: {
                    _id: null,
                    totalAttempts: { $sum: 1 },
                    distinctIPs: { $addToSet: '$ip' },
                },
            },
            {
                $project: {
                    totalAttempts: 1,
                    distinctIPCount: { $size: '$distinctIPs' },
                },
            },
        ]);

        if (results.length === 0) return null;

        const { totalAttempts, distinctIPCount } = results[0];

        if (totalAttempts >= 5 && distinctIPCount >= 3) {
            const alert = {
                type: 'CREDENTIAL_STUFFING',
                email,
                totalAttempts,
                distinctIPCount,
                windowSeconds: 60,
                detectedAt: new Date().toISOString(),
            };

            logger.warn(
                { ...alert, action: 'SECURITY_ALERT' },
                `🚨 ANOMALY DETECTED: ${totalAttempts} failed logins from ${distinctIPCount} IPs for ${email} in 60s`
            );

            return alert;
        }

        return null;
    } catch (err) {
        logger.error({ err, email }, 'Anomaly detection query failed');
        return null; // Don't block auth flow if detection fails
    }
};

/**
 * Log a login attempt for tracking
 */
const recordLoginAttempt = async ({ email, userId, ip, userAgent, success, reason }) => {
    try {
        await LoginAttempt.create({
            email: email.toLowerCase(),
            userId,
            ip,
            userAgent,
            success,
            reason: reason || (success ? 'success' : 'invalid_password'),
        });
    } catch (err) {
        logger.error({ err, email }, 'Failed to record login attempt');
        // Non-critical — don't throw
    }
};

module.exports = { detectAnomalies, recordLoginAttempt };
