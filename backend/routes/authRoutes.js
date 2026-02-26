const express = require('express');
const router = express.Router();

const { register, login, logout, refresh, setup2FA, verify2FA } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter, twoFactorLimiter } = require('../middleware/rateLimiter');
const { registerSchema, loginSchema, refreshSchema, twoFactorVerifySchema } = require('../validators/authSchemas');
const { generateCsrfToken } = require('../middleware/csrfProtection');

// ─── Public Routes ───
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', authLimiter, validate(refreshSchema), refresh);

// ─── CSRF Token endpoint ───
router.get('/csrf-token', (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ success: true, csrfToken: token });
});

// ─── Authenticated Routes ───
router.post('/logout', authenticate, logout);

// ─── 2FA Routes (authenticated + strict rate limit) ───
router.post('/2fa/setup', authenticate, twoFactorLimiter, setup2FA);
router.post('/2fa/verify', authenticate, twoFactorLimiter, validate(twoFactorVerifySchema), verify2FA);

module.exports = router;
