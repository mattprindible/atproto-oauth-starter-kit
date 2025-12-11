/**
 * Environment Configuration & Validation
 *
 * Validates required environment variables and their formats
 * at application startup.
 */

function validateEnvironment() {
    const required = ['COOKIE_SECRET', 'PUBLIC_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
        console.error('Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }

    // Validate COOKIE_SECRET strength
    if (process.env.COOKIE_SECRET.length < 32) {
        console.error('❌ COOKIE_SECRET must be at least 32 characters long for security.');
        console.error('Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        process.exit(1);
    }

    // Validate PUBLIC_URL format
    if (!process.env.PUBLIC_URL.startsWith('http://') && !process.env.PUBLIC_URL.startsWith('https://')) {
        console.error('❌ PUBLIC_URL must start with http:// or https://');
        process.exit(1);
    }

    // Warn if using HTTP in production (not localhost)
    if (process.env.PUBLIC_URL.startsWith('http://') && !process.env.PUBLIC_URL.includes('localhost') && !process.env.PUBLIC_URL.includes('127.0.0.1')) {
        console.warn('⚠️  WARNING: PUBLIC_URL is using HTTP instead of HTTPS. This is insecure for production!');
    }
}

module.exports = { validateEnvironment };
