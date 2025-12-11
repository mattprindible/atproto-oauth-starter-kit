/**
 * Test server setup utilities
 * Provides a configured Express app for testing without starting the actual server
 */

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');
const { JoseKey } = require('@atproto/jwk-jose');
const { Agent } = require('@atproto/api');
const db = require('../../db');
const { MockOAuthClient, MockAgent } = require('./mock-oauth');
const mockKeys = require('./mock-keys');

let testDbInitialized = false;

/**
 * Create a test Express app configured like the main server
 * This duplicates the setup from server.js but allows us to inject mocks
 */
async function createTestApp(options = {}) {
  // Initialize test database (SQLite in-memory)
  if (!testDbInitialized) {
    // Force SQLite for tests (even if REDIS_URL is set)
    const originalRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    await db.initialize();

    // Restore original value
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    }

    testDbInitialized = true;
  }

  const app = express();
  const PUBLIC_URL = process.env.PUBLIC_URL || 'https://test.example.com';

  // Rate Limiters (more permissive for tests)
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: options.loginRateLimit || 1000, // Higher limit for tests
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many login attempts, please try again later.'
  });

  const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.postRateLimit || 1000, // Higher limit for tests
    standardHeaders: true,
    legacyHeaders: false,
    message: 'You are posting too fast.'
  });

  // Use mock keys
  const privateKey = await JoseKey.fromJWK(mockKeys.privateJwk);

  // Client Metadata
  const clientMetadata = {
    client_id: `${PUBLIC_URL}/client-metadata.json`,
    client_name: 'ATProto OAuth Test',
    client_uri: PUBLIC_URL,
    redirect_uris: [`${PUBLIC_URL}/oauth/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto transition:generic',
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
    jwks: {
      keys: [mockKeys.publicJwk]
    }
  };

  // Initialize Mock OAuth Client
  const oauthClient = new MockOAuthClient({
    clientMetadata,
    keyset: [privateKey],
    stateStore: db.stateStore,
    sessionStore: db.sessionStore,
  });

  // CSRF Setup
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

  // Middleware setup
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // CSRF Token Endpoint
  app.get('/api/csrf', (req, res) => {
    const token = generateCsrfToken(req, res);
    res.json({ token });
  });

  // Apply CSRF protection
  app.use(doubleCsrfProtection);

  // --- Routes (same as server.js) ---

  app.get('/client-metadata.json', (req, res) => {
    res.json(clientMetadata);
  });

  app.get('/login', loginLimiter, async (req, res) => {
    const handle = req.query.handle;

    if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
      return res.status(400).send('Handle required');
    }
    if (!/^[a-zA-Z0-9.-]+$/.test(handle)) {
      return res.status(400).send('Invalid handle format');
    }

    try {
      const url = await oauthClient.authorize(handle, {
        scope: 'atproto transition:generic',
      });
      res.redirect(url.toString());
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).send(`Failed to start login: ${err.message}`);
    }
  });

  app.get('/oauth/callback', async (req, res) => {
    try {
      const params = new URLSearchParams(req.query);
      const { session } = await oauthClient.callback(params);

      res.cookie('user_did', session.did, {
        httpOnly: true,
        signed: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        secure: true
      });

      res.redirect('/');
    } catch (err) {
      console.error('Callback error:', err);
      res.status(500).send(`Login failed: ${err.message}`);
    }
  });

  app.get('/api/me', async (req, res) => {
    const did = req.signedCookies.user_did;
    if (!did) return res.json({ loggedIn: false });

    try {
      const agent = await getAgent(did, oauthClient);
      if (!agent) return res.json({ loggedIn: false });

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
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  app.post('/api/post', postLimiter, async (req, res) => {
    const did = req.signedCookies.user_did;
    if (!did) return res.status(401).json({ error: 'Not logged in' });

    const { text } = req.body;

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

  // Helper: Get Agent for DID
  async function getAgent(did, oauthClient) {
    try {
      const oauthSession = await oauthClient.restore(did);
      const agent = new MockAgent(oauthSession);
      return agent;
    } catch (err) {
      console.warn(`Failed to restore session for ${did}:`, err);
      return null;
    }
  }

  // Attach oauth client to app for test access
  app._testOAuthClient = oauthClient;

  return app;
}

/**
 * Helper to get a signed cookie value for testing
 */
function getSignedCookie(name, value) {
  const crypto = require('crypto');
  const secret = process.env.COOKIE_SECRET;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, '');
  return `${name}=s:${value}.${signature}`;
}

module.exports = {
  createTestApp,
  getSignedCookie,
};
