/**
 * Integration tests for OAuth flow
 * Tests the complete OAuth authentication flow
 */

const request = require('supertest');
const { createTestApp, getSignedCookie } = require('../helpers/test-server');

describe('OAuth Flow', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('GET /client-metadata.json', () => {
    test('should return client metadata', async () => {
      const response = await request(app)
        .get('/client-metadata.json')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('client_id');
      expect(response.body).toHaveProperty('client_name');
      expect(response.body).toHaveProperty('redirect_uris');
      expect(response.body).toHaveProperty('token_endpoint_auth_method', 'private_key_jwt');
      expect(response.body).toHaveProperty('dpop_bound_access_tokens', true);
    });

    test('should include correct redirect URIs', async () => {
      const response = await request(app)
        .get('/client-metadata.json')
        .expect(200);

      expect(response.body.redirect_uris).toContain('https://test.example.com/oauth/callback');
    });

    test('should include JWKS with public key', async () => {
      const response = await request(app)
        .get('/client-metadata.json')
        .expect(200);

      expect(response.body.jwks).toHaveProperty('keys');
      expect(response.body.jwks.keys).toBeInstanceOf(Array);
      expect(response.body.jwks.keys.length).toBeGreaterThan(0);
      expect(response.body.jwks.keys[0]).toHaveProperty('kty');
      expect(response.body.jwks.keys[0]).toHaveProperty('kid');
    });
  });

  describe('GET /login', () => {
    test('should redirect to authorization URL with valid handle', async () => {
      const response = await request(app)
        .get('/login?handle=alice.bsky.social')
        .expect(302);

      expect(response.headers.location).toContain('oauth/authorize');
      expect(response.headers.location).toContain('state=');
    });

    test('should return 400 without handle parameter', async () => {
      const response = await request(app)
        .get('/login')
        .expect(400);

      expect(response.text).toContain('Handle required');
    });

    test('should return 400 with empty handle', async () => {
      const response = await request(app)
        .get('/login?handle=')
        .expect(400);

      expect(response.text).toContain('Handle required');
    });

    test('should return 400 with whitespace-only handle', async () => {
      const response = await request(app)
        .get('/login?handle=%20%20%20')
        .expect(400);

      expect(response.text).toContain('Handle required');
    });

    test('should return 400 with invalid handle format', async () => {
      const response = await request(app)
        .get('/login?handle=invalid@handle!')
        .expect(400);

      expect(response.text).toContain('Invalid handle format');
    });

    test('should accept handle with dots', async () => {
      const response = await request(app)
        .get('/login?handle=alice.bsky.social')
        .expect(302);

      expect(response.headers.location).toBeDefined();
    });

    test('should accept handle with hyphens', async () => {
      const response = await request(app)
        .get('/login?handle=alice-bob.test')
        .expect(302);

      expect(response.headers.location).toBeDefined();
    });

    test('should reject handle with special characters', async () => {
      await request(app)
        .get('/login?handle=alice@bob.com')
        .expect(400);

      await request(app)
        .get('/login?handle=alice_bob')
        .expect(400);

      await request(app)
        .get('/login?handle=alice/bob')
        .expect(400);
    });
  });

  describe('GET /oauth/callback', () => {
    test('should complete OAuth flow and set cookie', async () => {
      // First, initiate login to get a state
      const loginResponse = await request(app)
        .get('/login?handle=alice.bsky.social')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      // Now simulate callback with that state
      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=mock-code`)
        .expect(302);

      expect(response.headers.location).toBe('/');

      // Check that cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));
      expect(userDidCookie).toBeDefined();
      expect(userDidCookie).toContain('HttpOnly');
      expect(userDidCookie).toContain('Secure');
    });

    test('should return 500 with invalid state', async () => {
      const response = await request(app)
        .get('/oauth/callback?state=invalid-state&code=test-code')
        .expect(500);

      expect(response.text).toContain('Login failed');
    });

    test('should set proper cookie attributes', async () => {
      const loginResponse = await request(app)
        .get('/login?handle=test.user')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=mock-code`)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));

      expect(userDidCookie).toContain('HttpOnly');
      expect(userDidCookie).toContain('Secure');
      expect(userDidCookie).toContain('SameSite=Lax');
      expect(userDidCookie).toContain('Max-Age=');
    });
  });

  describe('POST /logout', () => {
    test('should clear cookie and return success', async () => {
      // Get CSRF token first
      const csrfResponse = await request(app).get('/api/csrf');
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      const response = await request(app)
        .post('/logout')
        .set('Cookie', csrfCookies)
        .set('x-csrf-token', csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const clearedCookie = cookies.find(c => c.startsWith('user_did='));
        if (clearedCookie) {
          // Cookie should be cleared (either empty or with past expiry)
          expect(clearedCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
        }
      }
    });

    test('should revoke token for logged-in user', async () => {
      // First create a session
      const did = 'did:plc:testlogout123';
      await app._testOAuthClient.createMockSession(did, 'test.logout');

      // Get CSRF token
      const csrfResponse = await request(app)
        .get('/api/csrf')
        .set('Cookie', getSignedCookie('user_did', did));
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      // Combine cookies
      const allCookies = [getSignedCookie('user_did', did), ...csrfCookies];

      const response = await request(app)
        .post('/logout')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was revoked
      const db = require('../../db');
      const session = await db.sessionStore.get(did);
      expect(session).toBeUndefined();
    });

    test('should succeed even if token revocation fails', async () => {
      const did = 'did:plc:nonexistent';

      // Get CSRF token
      const csrfResponse = await request(app)
        .get('/api/csrf')
        .set('Cookie', getSignedCookie('user_did', did));
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      const allCookies = [getSignedCookie('user_did', did), ...csrfCookies];

      const response = await request(app)
        .post('/logout')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Complete OAuth Flow', () => {
    test('should complete full authentication flow', async () => {
      // Step 1: Initiate login
      const loginResponse = await request(app)
        .get('/login?handle=alice.bsky.social')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');
      expect(state).toBeDefined();

      // Step 2: Complete callback
      const callbackResponse = await request(app)
        .get(`/oauth/callback?state=${state}&code=auth-code&did=did:plc:alice123`)
        .expect(302);

      expect(callbackResponse.headers.location).toBe('/');

      // Step 3: Verify session is stored
      const cookies = callbackResponse.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));
      expect(userDidCookie).toBeDefined();

      // Extract DID from cookie (simplified)
      const did = 'did:plc:alice123';

      // Step 4: Verify can access authenticated endpoints
      const db = require('../../db');
      const session = await db.sessionStore.get(did);
      expect(session).toBeDefined();
      expect(session.sub).toBe(did);
    });
  });
});
