/**
 * Security Configuration
 *
 * Handles rate limiting, key loading, and CSRF protection setup.
 */

const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');
const fs = require('fs');
const path = require('path');

/**
 * Login Rate Limiter
 * Prevents brute force login attempts
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, please try again later.'
});

/**
 * Post Rate Limiter
 * Prevents spam posting
 */
const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 60, // Limit each IP to 60 posts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'You are posting too fast.'
});

/**
 * Load cryptographic keys from KEYS_JSON env var or keys.json file
 * @returns {Object} Keys object with privateJwk and publicJwk
 */
function loadKeys() {
    let keys;

    if (process.env.KEYS_JSON) {
        try {
            keys = JSON.parse(process.env.KEYS_JSON);
            console.log('🔑 Loaded keys from KEYS_JSON environment variable');
        } catch (err) {
            console.error('❌ Failed to parse KEYS_JSON. Ensure it is valid JSON.');
            process.exit(1);
        }
    } else {
        const keysPath = path.join(process.cwd(), 'keys.json');
        if (!fs.existsSync(keysPath)) {
            console.error('❌ No keys found! Set KEYS_JSON env var or run "npm run generate-keys".');
            process.exit(1);
        }
        keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
        console.log('🔑 Loaded keys from local keys.json file');
    }

    return keys;
}

/**
 * Setup CSRF protection middleware
 * @returns {Object} Object containing generateCsrfToken and doubleCsrfProtection
 */
function setupCsrf() {
    const {
        generateCsrfToken,
        doubleCsrfProtection,
    } = doubleCsrf({
        getSecret: () => process.env.COOKIE_SECRET,
        getSessionIdentifier: (req) => req.signedCookies?.user_did || "anon",
        cookieName: "x-csrf-token",
        cookieOptions: {
            httpOnly: true,
            sameSite: "strict",
            path: "/",
            secure: true,
        },
        size: 64,
        ignoredMethods: ["GET", "HEAD", "OPTIONS"],
        getTokenFromRequest: (req) => req.headers["x-csrf-token"],
    });

    return { generateCsrfToken, doubleCsrfProtection };
}

module.exports = {
    loginLimiter,
    postLimiter,
    loadKeys,
    setupCsrf
};
