const express = require('express');
const router = express.Router();

const { getProfile } = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');

// ─── Protected: Get current user profile ───
router.get('/', authenticate, getProfile);

module.exports = router;
