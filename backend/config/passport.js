const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const logger = require('./logger');

const configurePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL,
                // PKCE is enforced by the Google OAuth endpoint when using authorization code flow
                // passport-google-oauth20 uses authorization code flow by default
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user already linked with Google
                    let user = await User.findOne({ googleId: profile.id });

                    if (user) {
                        logger.info({ userId: user._id, action: 'oauth_login' }, 'Google OAuth login');
                        return done(null, user);
                    }

                    // Check if email already exists (account linking)
                    const email = profile.emails?.[0]?.value;
                    if (email) {
                        user = await User.findOne({ email });
                        if (user) {
                            user.googleId = profile.id;
                            await user.save();
                            logger.info({ userId: user._id, action: 'oauth_link' }, 'Google account linked');
                            return done(null, user);
                        }
                    }

                    // Create new user from Google profile
                    user = await User.create({
                        email,
                        googleId: profile.id,
                        name: profile.displayName,
                        // No password — OAuth-only account
                    });

                    logger.info({ userId: user._id, action: 'oauth_register' }, 'New user via Google OAuth');
                    return done(null, user);
                } catch (err) {
                    logger.error({ err, action: 'oauth_error' }, 'Google OAuth strategy error');
                    return done(err, null);
                }
            }
        )
    );

    // Serialize / deserialize (stateless JWT — minimal usage)
    passport.serializeUser((user, done) => done(null, user._id));
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};

module.exports = configurePassport;
