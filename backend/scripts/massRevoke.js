#!/usr/bin/env node

/**
 * Mass Token Revocation Script
 *
 * Usage:
 *   node scripts/massRevoke.js --user <userId>     # Revoke all tokens for a specific user
 *   node scripts/massRevoke.js --all               # Revoke ALL tokens for ALL users
 *
 * This script:
 * 1. Revokes all refresh tokens in MongoDB
 * 2. Sets a mass-revocation timestamp in Redis (invalidates all access tokens issued before now)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');

const connectDB = require('../config/db');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

const args = process.argv.slice(2);

const run = async () => {
    await connectDB();
    const redis = new Redis(process.env.REDIS_URI);

    try {
        if (args.includes('--all')) {
            console.log('🚨 REVOKING ALL TOKENS FOR ALL USERS...');

            // Revoke all refresh tokens
            const result = await RefreshToken.updateMany({}, { $set: { isRevoked: true } });
            console.log(`   ✅ Revoked ${result.modifiedCount} refresh tokens`);

            // Set mass-revocation for all users
            const users = await User.find().select('_id');
            for (const user of users) {
                await redis.set(`revoke-all:${user._id}`, Date.now().toString(), 'EX', 7 * 24 * 60 * 60);
            }
            console.log(`   ✅ Mass revocation set for ${users.length} users`);

        } else if (args.includes('--user')) {
            const userId = args[args.indexOf('--user') + 1];
            if (!userId) {
                console.error('❌ Please provide a user ID: --user <userId>');
                process.exit(1);
            }

            console.log(`🚨 Revoking all tokens for user: ${userId}`);

            // Revoke refresh tokens
            const result = await RefreshToken.revokeAllForUser(userId);
            console.log(`   ✅ Revoked ${result.modifiedCount} refresh tokens`);

            // Set mass-revocation in Redis
            await redis.set(`revoke-all:${userId}`, Date.now().toString(), 'EX', 7 * 24 * 60 * 60);
            console.log('   ✅ Access token mass revocation set');

        } else {
            console.log('Usage:');
            console.log('  node scripts/massRevoke.js --user <userId>');
            console.log('  node scripts/massRevoke.js --all');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await redis.quit();
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
