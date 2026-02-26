const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        fromUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null, // null for deposits
        },
        toUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        fromWallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            default: null,
        },
        toWallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },
        currency: {
            type: String,
            default: 'USD',
        },
        type: {
            type: String,
            enum: ['transfer', 'deposit', 'withdrawal'],
            required: true,
        },
        status: {
            type: String,
            enum: ['completed', 'pending', 'failed', 'flagged'],
            default: 'completed',
        },
        description: {
            type: String,
            maxlength: 200,
            default: '',
        },
        riskScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        metadata: {
            ip: String,
            userAgent: String,
            deviceFingerprint: String,
        },
        reference: {
            type: String,
            unique: true,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

// Generate unique reference before validation
transactionSchema.pre('validate', function (next) {
    if (!this.reference) {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.reference = `NP-${ts}-${rand}`;
    }
    next();
});

// Indexes for fast queries
transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });
transactionSchema.index({ status: 1, riskScore: -1 });
transactionSchema.index({ reference: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
