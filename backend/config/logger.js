const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: isProduction ? 'info' : 'debug',

    // Structured base fields on every log entry
    base: {
        service: 'hardened-auth',
        env: process.env.NODE_ENV || 'development',
    },

    // ISO timestamp for SIEM compatibility
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive fields from logs
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'refreshToken'],
        censor: '[REDACTED]',
    },

    // Pretty print in development only
    transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
});

module.exports = logger;
