require('dotenv').config();
const { JoseKey } = require('@atproto/jwk-jose');
const { doubleCsrf } = require('csrf-csrf');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { NodeOAuthClient } = require('@atproto/oauth-client-node');
const { Agent } = require('@atproto/api');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const db = require('./db');

// Validate required environment variables
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

validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`;

// Rate Limiters
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, please try again later.'
});

const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 60, // Limit each IP to 60 posts per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: 'You are posting too fast.'
});

// Load Keys
// Load Keys
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
    const keysPath = path.join(__dirname, 'keys.json');
    if (!fs.existsSync(keysPath)) {
        console.error('❌ No keys found! Set KEYS_JSON env var or run "npm run generate-keys".');
        process.exit(1);
    }
    keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    console.log('🔑 Loaded keys from local keys.json file');
}

// CSRF Setup
const {
    generateCsrfToken,
    doubleCsrfProtection,
} = doubleCsrf({
    getSecret: () => process.env.COOKIE_SECRET, // A function that optionally takes the request and returns a secret
    getSessionIdentifier: (req) => req.signedCookies?.user_did || "anon", // Required by csrf-csrf
    cookieName: "x-csrf-token", // The name of the cookie to be used, recommend using x-csrf-token
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",  // Stricter protection
        path: "/",
        secure: true,
    },
    size: 64, // The size of the generated tokens in bits
    ignoredMethods: ["GET", "HEAD", "OPTIONS"], // A list of request methods that will not be protected.
    getTokenFromRequest: (req) => req.headers["x-csrf-token"], // A function that returns the token from the request
});

// Initialize App
async function main() {
    // Initialize database connection (Redis or SQLite)
    await db.initialize();

    const privateKey = await JoseKey.fromJWK(keys.privateJwk);

    // Client Metadata
    const clientMetadata = {
        client_id: `${PUBLIC_URL}/client-metadata.json`,
        client_name: 'ATProto OAuth Example',
        client_uri: PUBLIC_URL,
        logo_uri: `${PUBLIC_URL}/logo.png`, // Optional
        tos_uri: `${PUBLIC_URL}/tos`, // Optional
        policy_uri: `${PUBLIC_URL}/policy`, // Optional
        redirect_uris: [`${PUBLIC_URL}/oauth/callback`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'atproto transition:generic', // Standard scope for now
        token_endpoint_auth_method: 'private_key_jwt',
        token_endpoint_auth_signing_alg: 'ES256',
        dpop_bound_access_tokens: true,
        jwks: {
            keys: [keys.publicJwk]
        }
    };

    // Initialize OAuth Client
    // console.log('Using Client Metadata:', JSON.stringify(clientMetadata, null, 2));

    const oauthClient = new NodeOAuthClient({
        clientMetadata,
        keyset: [privateKey], // Library expects 'keyset', not 'keys'
        stateStore: db.stateStore,
        sessionStore: db.sessionStore,
    });

    // Trust proxy - required when behind reverse proxy (ngrok, load balancer, etc.)
    // This allows Express to read the real client IP from X-Forwarded-For header
    app.set('trust proxy', 1);

    app.use(helmet({
        contentSecurityPolicy: false, // Disabled for simplicity with inline scripts
    }));
    app.use(express.json({ limit: '1mb' })); // Prevent DoS via large JSON payloads
    app.use(express.static('public'));
    app.use(cookieParser(process.env.COOKIE_SECRET));

    // CSRF Token Endpoint
    app.get('/api/csrf', (req, res) => {
        const token = generateCsrfToken(req, res);
        res.json({ token });
    });

    // Apply CSRF protection to all unsafe routes
    // We explicitly exempt /client-metadata.json and /oauth/callback or just apply globally 
    // since they are GET requests, they are ignored by default.
    // The only unsafe route is /api/post and /logout
    app.use(doubleCsrfProtection);

    // --- Routes ---

    // 1. Metadata Endpoint (Critical)
    app.get('/client-metadata.json', (req, res) => {
        res.json(clientMetadata);
    });

    // 2. Login - Init
    app.get('/login', loginLimiter, async (req, res) => {
        const handle = req.query.handle;

        // Input Validation
        if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
            return res.status(400).send('Handle required');
        }
        // Basic handle format check (alphanumeric + dots/hyphens)
        if (!/^[a-zA-Z0-9.-]+$/.test(handle)) {
            return res.status(400).send('Invalid handle format');
        }

        try {
            // Revoke any existing session? Maybe not needed for minimal.

            // Initiate interaction
            const url = await oauthClient.authorize(handle, {
                scope: 'atproto transition:generic',
            });

            // Redirect user to PDS (convert to string for Express 5 compatibility)
            res.redirect(url.toString());
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).send(`Failed to start login: ${err.message}`);
        }
    });

    // 3. Callback
    app.get('/oauth/callback', async (req, res) => {
        try {
            const params = new URLSearchParams(req.query);
            const { session } = await oauthClient.callback(params);

            // Session is established!
            // session.did is the user's DID.

            // Store DID in a signed httpOnly cookie to track the browser user
            res.cookie('user_did', session.did, {
                httpOnly: true,
                signed: true,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
                sameSite: 'lax', // Must be lax for top-level navigation (redirect from PDS)
                secure: true
            });

            res.redirect('/');
        } catch (err) {
            console.error('Callback error:', err);
            res.status(500).send(`Login failed: ${err.message}`);
        }
    });

    // 4. API - Get Current User
    app.get('/api/me', async (req, res) => {
        const did = req.signedCookies.user_did;
        if (!did) return res.json({ loggedIn: false });

        try {
            // Restore session for this DID
            const agent = await getAgent(did, oauthClient);
            if (!agent) return res.json({ loggedIn: false }); // Session expired/gone

            const profile = await agent.getProfile({ actor: agent.did });

            res.json({
                loggedIn: true,
                did: agent.did,
                handle: profile.data.handle,
                displayName: profile.data.displayName,
                avatar: profile.data.avatar
            });
        } catch (err) {
            console.error('API Me error:', err);
            // Don't expose internal errors
            res.status(500).json({ error: 'Failed to fetch profile' });
        }
    });

    // 5. API - Post
    app.post('/api/post', postLimiter, async (req, res) => {
        const did = req.signedCookies.user_did;
        if (!did) return res.status(401).json({ error: 'Not logged in' });

        const { text } = req.body;

        // Input Validation
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Text required' });
        }
        if (text.length > 300) {
            return res.status(400).json({ error: 'Text too long (max 300 chars)' });
        }

        try {
            const agent = await getAgent(did, oauthClient);
            await agent.post({
                text: text,
                createdAt: new Date().toISOString()
            });
            res.json({ success: true });
        } catch (err) {
            console.error('Post error:', err);
            res.status(500).json({ error: 'Failed to post' });
        }
    });

    // 6. Logout
    app.post('/logout', async (req, res) => {
        const did = req.signedCookies.user_did;
        if (did) {
            try {
                await oauthClient.revoke(did);
            } catch (err) {
                console.error('Failed to revoke token:', err);
            }
        }
        res.clearCookie('user_did');
        res.json({ success: true });
    });

    // Error Handler
    app.use((err, req, res, next) => {
        console.error('Unhandled Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    });

    app.listen(PORT, () => {
        console.log(`Server running at ${PUBLIC_URL}`);
        console.log(`Client ID is ${PUBLIC_URL}/client-metadata.json`);
    });
}

// Helper: Get Agent for DID
async function getAgent(did, oauthClient) {
    try {
        const oauthSession = await oauthClient.restore(did);
        // Note: oauthSession might refresh tokens internally here!

        // Create actual API Agent
        const agent = new Agent(oauthSession);
        return agent;
    } catch (err) {
        console.warn(`Failed to restore session for ${did}:`, err);
        return null;
    }
}

main().catch(console.error);
