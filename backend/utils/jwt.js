const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a short-lived access token
 */
const generateAccessToken = (user) => {
    const jti = uuidv4(); // Unique token ID for blacklisting

    const payload = {
        sub: user._id || user.id,
        role: user.role,
        email: user.email,
    };

    const options = {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        jwtid: jti,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, options);
    return { token, jti };
};

/**
 * Generate a refresh token (raw value — hash before storing)
 */
const generateRefreshToken = (user, family = null) => {
    const jti = uuidv4();
    const tokenFamily = family || uuidv4(); // New family if first token

    const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);

    const payload = {
        sub: user._id || user.id,
        family: tokenFamily,
        type: 'refresh',
    };

    const options = {
        expiresIn: `${expiryDays}d`,
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        jwtid: jti,
    };

    const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, options);
    return { token, jti, family: tokenFamily, expiryDays };
};

/**
 * Verify access token — validates signature + iss + aud
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
    });
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
    });
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
};
