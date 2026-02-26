const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema(
    {
        // Hashed token — raw value is NEVER stored
        tokenHash: {
            type: String,
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        // Family UUID — all tokens from the same refresh chain share this
        family: {
            type: String,
            required: true,
            index: true,
        },
        // Device fingerprint hash for binding tokens to devices
        deviceFingerprint: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expireAfterSeconds: 0 }, // TTL index — auto-delete expired tokens
        },
        isRevoked: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        strict: true,
    }
);

// ─── Static Methods ───

/**
 * Hash a raw refresh token for storage
 */
refreshTokenSchema.statics.hashToken = function (rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Revoke an entire token family (on reuse detection)
 */
refreshTokenSchema.statics.revokeFamily = async function (family) {
    return this.updateMany({ family }, { $set: { isRevoked: true } });
};

/**
 * Revoke all tokens for a specific user
 */
refreshTokenSchema.statics.revokeAllForUser = async function (userId) {
    return this.updateMany({ userId }, { $set: { isRevoked: true } });
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
