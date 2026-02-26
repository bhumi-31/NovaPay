const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
        },
        password: {
            type: String,
            minlength: 8,
            // Not required — OAuth users won't have a password
        },
        name: {
            type: String,
            trim: true,
            maxlength: 100,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },

        // ─── Google OAuth ───
        googleId: {
            type: String,
            sparse: true,
            unique: true,
        },

        // ─── Two-Factor Authentication ───
        twoFactorSecret: { type: String, select: false },
        twoFactorEnabled: { type: Boolean, default: false },

        // ─── Account Lockout ───
        failedLoginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date, default: null },
    },
    {
        timestamps: true,
        // Strict schema — reject any fields not in the schema
        strict: true,
        // Remove __v and transform _id
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                delete ret.twoFactorSecret;
                return ret;
            },
        },
    }
);

// ─── Virtual: isLocked ───
userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ─── Pre-save: Hash password ───
userSchema.pre('save', async function (next) {
    // Only hash if password was modified
    if (!this.isModified('password')) return next();
    if (!this.password) return next();

    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// ─── Instance Methods ───
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementLoginAttempts = async function () {
    const lockDuration = parseInt(process.env.LOCK_DURATION_MINUTES || '15', 10);
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);

    // If previous lock has expired, reset
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { failedLoginAttempts: 1, lockUntil: null },
        });
    }

    const updates = { $inc: { failedLoginAttempts: 1 } };

    // Lock account if max attempts reached
    if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = {
            lockUntil: new Date(Date.now() + lockDuration * 60 * 1000),
        };
    }

    return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function () {
    return this.updateOne({
        $set: { failedLoginAttempts: 0, lockUntil: null },
    });
};

module.exports = mongoose.model('User', userSchema);
