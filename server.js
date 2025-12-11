require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Agent } = require('@atproto/api');
const db = require('./db');
const { validateEnvironment } = require('./config/environment');
const { loginLimiter, postLimiter, loadKeys, setupCsrf } = require('./config/security');
const { createOAuthClient } = require('./config/oauth-client');

// Validate environment variables on startup
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`;

// Load security configuration
const keys = loadKeys();
const { generateCsrfToken, doubleCsrfProtection } = setupCsrf();

// Initialize App
async function main() {
    // Initialize database connection (Redis or SQLite)
    await db.initialize();

    // Initialize OAuth Client
    const { oauthClient, clientMetadata } = await createOAuthClient(
        keys,
        PUBLIC_URL,
        db.stateStore,
        db.sessionStore
    );

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
