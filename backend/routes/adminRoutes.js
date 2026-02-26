const express = require('express');
const router = express.Router();

const { getAllUsers, forceLogout } = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// ─── Admin-only Routes ───
// Both authenticate (verify JWT) and authorize (check role) middleware applied

router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.post('/force-logout/:userId', authenticate, authorize('admin'), forceLogout);

module.exports = router;
