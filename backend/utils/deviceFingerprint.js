const crypto = require('crypto');

/**
 * Generate a device fingerprint by hashing:
 * - User-Agent header
 * - IP subnet (first 3 octets for IPv4, /48 for IPv6)
 * - Optional X-Device-ID header
 *
 * This binds tokens to a device/network combination.
 * Stolen tokens used from a different device/network will be rejected.
 */
const generateFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const deviceId = req.headers['x-device-id'] || '';

    // Extract IP subnet (hide last octet for privacy + dynamic IPs)
    const ipSubnet = extractSubnet(ip);

    const raw = `${userAgent}|${ipSubnet}|${deviceId}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Extract subnet from IP address
 * - IPv4: first 3 octets (e.g., 192.168.1.x → 192.168.1)
 * - IPv6: /48 prefix
 */
const extractSubnet = (ip) => {
    // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
    const cleanIp = ip.replace(/^::ffff:/, '');

    if (cleanIp.includes(':')) {
        // IPv6: use first 3 groups (/48)
        const parts = cleanIp.split(':');
        return parts.slice(0, 3).join(':');
    }

    // IPv4: use first 3 octets
    const parts = cleanIp.split('.');
    return parts.slice(0, 3).join('.');
};

module.exports = { generateFingerprint };
