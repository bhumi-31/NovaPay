require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const logger = require('./config/logger');
const configurePassport = require('./config/passport');

const { generalLimiter } = require('./middleware/rateLimiter');
const { requestLogger } = require('./middleware/requestLogger');
const { sanitize } = require('./middleware/sanitize');
const { csrfProtection } = require('./middleware/csrfProtection');

const authRoutes = require('./routes/authRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const walletRoutes = require('./routes/walletRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════
// SECURITY MIDDLEWARE (applied globally)
// ═══════════════════════════════════════════

// 0. HTTPS redirect in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
        }
        next();
    });
    app.set('trust proxy', 1);
}

// 1. Helmet — security headers (CSP, X-Frame-Options, HSTS, etc.)
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: 'same-origin' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
    })
);

// 2. Permissions-Policy header — restrict browser APIs
app.use((req, res, next) => {
    res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );
    next();
});

// 3. CORS — locked to frontend origin only
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:5173', 'http://localhost:5174'];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, Postman)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Blocked by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID', 'X-Device-ID'],
    })
);

// 4. Body parsing with size limits
app.use(express.json({ limit: '10kb' })); // Small limit — prevents large payload attacks
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 5. Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

// 6. HPP — HTTP Parameter Pollution protection
app.use(hpp());

// 7. NoSQL injection sanitization
app.use(sanitize());

// 8. Request logging with X-Request-ID
app.use(requestLogger);

// 9. General rate limiter
app.use(generalLimiter);

// 10. CSRF protection (applied to all state-changing routes)
// Skipped in development for SPA compatibility
if (process.env.NODE_ENV === 'production') {
    app.use('/api/auth', csrfProtection);
    app.use('/api/admin', csrfProtection);
    app.use('/api/wallet', csrfProtection);
    app.use('/api/profile', csrfProtection);
}

// 11. Passport initialization (no sessions — JWT only)
configurePassport();
app.use(passport.initialize());

// ═══════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});

// ═══════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error(
        {
            err,
            requestId: req.requestId,
            path: req.originalUrl,
            method: req.method,
            action: 'unhandled_error',
        },
        'Unhandled error'
    );

    // Don't leak internal errors in production
    const message =
        process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message;

    res.status(err.status || 500).json({
        success: false,
        message,
    });
});

// ═══════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Connect to Redis
        connectRedis();

        app.listen(PORT, () => {
            logger.info(
                { port: PORT, env: process.env.NODE_ENV },
                `🔐 Hardened Auth Server running on port ${PORT}`
            );
        });
    } catch (err) {
        logger.error({ err }, 'Failed to start server');
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received — shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received — shutting down gracefully');
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Promise Rejection');
});

startServer();

module.exports = app;
