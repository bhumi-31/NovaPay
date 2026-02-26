const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
        },
        balance: {
            type: Number,
            default: 1000.0, // Seed balance for demo
            min: 0,
        },
        currency: {
            type: String,
            default: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'INR'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        totalReceived: {
            type: Number,
            default: 0,
        },
        totalSent: {
            type: Number,
            default: 0,
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

// Compound index for fast lookups
walletSchema.index({ userId: 1 });

module.exports = mongoose.model('Wallet', walletSchema);
