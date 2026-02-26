const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        ip: {
            type: String,
            required: true,
        },
        userAgent: {
            type: String,
            default: '',
        },
        success: {
            type: Boolean,
            required: true,
        },
        reason: {
            type: String,
            enum: ['success', 'invalid_password', 'account_locked', 'user_not_found', '2fa_failed', '2fa_required'],
            default: 'success',
        },
    },
    {
        timestamps: true,
        strict: true,
    }
);

// TTL index — auto-delete after 30 days
loginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Compound index for anomaly detection queries
loginAttemptSchema.index({ email: 1, success: 1, createdAt: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
