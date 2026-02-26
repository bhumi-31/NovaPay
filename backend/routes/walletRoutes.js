const express = require('express');
const router = express.Router();

const {
    getBalance,
    transfer,
    deposit,
    getTransactions,
    getFlaggedTransactions,
} = require('../controllers/walletController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { transferSchema, depositSchema } = require('../validators/walletSchemas');
const { generalLimiter } = require('../middleware/rateLimiter');

// All wallet routes require authentication
router.use(authenticate);

// ─── User Routes ───
router.get('/balance', getBalance);
router.post('/transfer', generalLimiter, validate(transferSchema), transfer);
router.post('/deposit', generalLimiter, validate(depositSchema), deposit);
router.get('/transactions', getTransactions);

// ─── Admin Routes ───
router.get('/flagged', authorize('admin'), getFlaggedTransactions);

module.exports = router;
