const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { generateFingerprint } = require('../utils/deviceFingerprint');
const logger = require('../config/logger');

// ─────────────────────────────────────────────
// RISK SCORING ENGINE
// ─────────────────────────────────────────────
const computeRiskScore = async (userId, amount) => {
    let score = 0;

    // Factor 1: Amount thresholds
    if (amount > 5000) score += 40;
    else if (amount > 2000) score += 25;
    else if (amount > 500) score += 10;

    // Factor 2: Transaction velocity — more than 5 in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await Transaction.countDocuments({
        fromUser: userId,
        createdAt: { $gte: oneHourAgo },
    });
    if (recentCount >= 5) score += 30;
    else if (recentCount >= 3) score += 15;

    // Factor 3: Aggregate amount in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayTransactions = await Transaction.aggregate([
        { $match: { fromUser: new mongoose.Types.ObjectId(userId), createdAt: { $gte: oneDayAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const dailyTotal = (dayTransactions[0]?.total || 0) + amount;
    if (dailyTotal > 10000) score += 30;
    else if (dailyTotal > 5000) score += 15;

    return Math.min(score, 100);
};

// ─────────────────────────────────────────────
// GET BALANCE
// ─────────────────────────────────────────────
const getBalance = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.user.id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found' });
        }

        return res.status(200).json({
            success: true,
            data: {
                balance: wallet.balance,
                currency: wallet.currency,
                totalSent: wallet.totalSent,
                totalReceived: wallet.totalReceived,
                isActive: wallet.isActive,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'get_balance_error', requestId: req.requestId }, 'Get balance failed');
        return res.status(500).json({ success: false, message: 'Failed to retrieve balance' });
    }
};

// ─────────────────────────────────────────────
// TRANSFER MONEY
// ─────────────────────────────────────────────
const transfer = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const { recipientEmail, amount, description } = req.body;
        const senderId = req.user.id;

        // 1. Validate: can't send to yourself
        const sender = await User.findById(senderId);
        if (sender.email === recipientEmail.toLowerCase()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Cannot transfer to yourself' });
        }

        // 2. Find recipient
        let recipient = await User.findOne({ email: recipientEmail.toLowerCase() });
        if (!recipient) {
            // Auto-create shadow recipient for seamless hackathon demos
            recipient = new User({
                email: recipientEmail.toLowerCase(),
                name: recipientEmail.split('@')[0],
                password: 'Password123!',
            });
            await recipient.save({ session });

            await Wallet.create([{
                userId: recipient._id,
                balance: 0,
            }], { session });
        }

        // 3. Get wallets
        const senderWallet = await Wallet.findOne({ userId: senderId }).session(session);
        const recipientWallet = await Wallet.findOne({ userId: recipient._id }).session(session);

        if (!senderWallet || !senderWallet.isActive) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Your wallet is not active' });
        }

        if (!recipientWallet || !recipientWallet.isActive) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Recipient wallet is not active' });
        }

        // 4. Check sufficient balance
        if (senderWallet.balance < amount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance',
                data: { available: senderWallet.balance, requested: amount },
            });
        }

        // 5. Compute risk score
        const riskScore = await computeRiskScore(senderId, amount);
        const status = riskScore >= 70 ? 'flagged' : 'completed';

        // 6. Atomic debit + credit
        senderWallet.balance -= amount;
        senderWallet.totalSent += amount;
        await senderWallet.save({ session });

        recipientWallet.balance += amount;
        recipientWallet.totalReceived += amount;
        await recipientWallet.save({ session });

        // 7. Create transaction record
        const deviceFp = generateFingerprint(req);
        const transaction = await Transaction.create(
            [
                {
                    fromUser: senderId,
                    toUser: recipient._id,
                    fromWallet: senderWallet._id,
                    toWallet: recipientWallet._id,
                    amount,
                    type: 'transfer',
                    status,
                    description: description || `Transfer to ${recipient.email}`,
                    riskScore,
                    metadata: {
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        deviceFingerprint: deviceFp,
                    },
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        logger.info(
            {
                userId: senderId,
                recipientId: recipient._id,
                amount,
                riskScore,
                status,
                reference: transaction[0].reference,
                action: 'money_transfer',
                requestId: req.requestId,
            },
            `Transfer: $${amount} to ${recipient.email} [risk: ${riskScore}]`
        );

        if (riskScore >= 70) {
            logger.warn(
                {
                    userId: senderId,
                    amount,
                    riskScore,
                    action: 'FRAUD_ALERT',
                    reference: transaction[0].reference,
                    requestId: req.requestId,
                },
                `🚨 High-risk transaction flagged: $${amount} [score: ${riskScore}]`
            );
        }

        return res.status(200).json({
            success: true,
            message: status === 'flagged'
                ? 'Transfer completed but flagged for review'
                : 'Transfer successful',
            data: {
                transaction: transaction[0].toJSON(),
                newBalance: senderWallet.balance,
            },
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        logger.error({ err, action: 'transfer_error', requestId: req.requestId }, 'Transfer failed');
        return res.status(500).json({ success: false, message: 'Transfer failed' });
    }
};

// ─────────────────────────────────────────────
// DEPOSIT (demo convenience)
// ─────────────────────────────────────────────
const deposit = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.status(404).json({ success: false, message: 'Wallet not found' });
        }

        wallet.balance += amount;
        wallet.totalReceived += amount;
        await wallet.save();

        const deviceFp = generateFingerprint(req);
        const transaction = await Transaction.create({
            toUser: userId,
            toWallet: wallet._id,
            amount,
            type: 'deposit',
            status: 'completed',
            description: 'Account deposit',
            metadata: {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                deviceFingerprint: deviceFp,
            },
        });

        logger.info(
            { userId, amount, action: 'deposit', requestId: req.requestId },
            `Deposit: $${amount}`
        );

        return res.status(200).json({
            success: true,
            message: 'Deposit successful',
            data: {
                transaction: transaction.toJSON(),
                newBalance: wallet.balance,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'deposit_error', requestId: req.requestId }, 'Deposit failed');
        return res.status(500).json({ success: false, message: 'Deposit failed' });
    }
};

// ─────────────────────────────────────────────
// TRANSACTION HISTORY (paginated)
// ─────────────────────────────────────────────
const getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type;

        const filter = {
            $or: [{ fromUser: userId }, { toUser: userId }],
        };
        if (type) filter.type = type;

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('fromUser', 'email name')
                .populate('toUser', 'email name'),
            Transaction.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (err) {
        logger.error({ err, action: 'get_transactions_error', requestId: req.requestId }, 'Get transactions failed');
        return res.status(500).json({ success: false, message: 'Failed to retrieve transactions' });
    }
};

// ─────────────────────────────────────────────
// ADMIN: FLAGGED TRANSACTIONS
// ─────────────────────────────────────────────
const getFlaggedTransactions = async (req, res) => {
    try {
        const transactions = await Transaction.find({
            $or: [{ status: 'flagged' }, { riskScore: { $gte: 50 } }],
        })
            .sort({ riskScore: -1, createdAt: -1 })
            .limit(50)
            .populate('fromUser', 'email name')
            .populate('toUser', 'email name');

        return res.status(200).json({
            success: true,
            data: {
                count: transactions.length,
                transactions,
            },
        });
    } catch (err) {
        logger.error({ err, action: 'get_flagged_error', requestId: req.requestId }, 'Get flagged transactions failed');
        return res.status(500).json({ success: false, message: 'Failed to retrieve flagged transactions' });
    }
};

module.exports = {
    getBalance,
    transfer,
    deposit,
    getTransactions,
    getFlaggedTransactions,
};
