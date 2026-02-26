const express = require('express');
const passport = require('passport');
const router = express.Router();

const { googleCallback } = require('../controllers/oauthController');

// ─── Initiate Google OAuth ───
router.get(
    '/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
        accessType: 'offline',
        prompt: 'consent',
    })
);

// ─── Google OAuth Callback ───
router.get(
    '/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: '/api/oauth/failure',
    }),
    googleCallback
);

// ─── OAuth Failure Route ───
router.get('/failure', (req, res) => {
    res.status(401).json({
        success: false,
        message: 'Google OAuth authentication failed',
    });
});

module.exports = router;
