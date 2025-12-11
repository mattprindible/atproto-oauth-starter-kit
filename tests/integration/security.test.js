/**
 * Integration tests for security features
 * Tests rate limiting, CSRF protection, cookie security, and input validation
 */

const request = require('supertest');
const { createTestApp, getSignedCookie } = require('../helpers/test-server');

describe('Security Features', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe('CSRF Protection', () => {
    test('should reject POST /api/post without CSRF token', async () => {
      const did = 'did:plc:csrftest';
      await app._testOAuthClient.createMockSession(did, 'csrf.test');
      const cookieHeader = getSignedCookie('user_did', did);

      const response = await request(app)
        .post('/api/post')
        .set('Cookie', cookieHeader)
        .send({ text: 'Test post' });

      // CSRF protection should block this (403 or 500 depending on middleware)
      expect([403, 500]).toContain(response.status);
    });

    test('should reject POST /logout without CSRF token', async () => {
      const response = await request(app)
        .post('/logout');

      // CSRF protection should block this (403 or 500)
      expect([403, 500]).toContain(response.status);
    });

    test('should allow POST with valid CSRF token', async () => {
      const did = 'did:plc:csrfvalid';
      await app._testOAuthClient.createMockSession(did, 'valid.test');
      const userCookie = getSignedCookie('user_did', did);

      // Get CSRF token with the user cookie
      const csrfResponse = await request(app)
        .get('/api/csrf')
        .set('Cookie', userCookie);
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      // Combine all cookies
      const allCookies = [userCookie, ...csrfCookies];

      const response = await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ text: 'Valid post' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should allow GET requests without CSRF token', async () => {
      await request(app).get('/api/me').expect(200);
      await request(app).get('/client-metadata.json').expect(200);
      await request(app).get('/login?handle=test.user'); // Will fail for other reasons but not CSRF
    });

    test('should reject POST with invalid CSRF token', async () => {
      const did = 'did:plc:invalidcsrf';
      await app._testOAuthClient.createMockSession(did, 'invalid.test');
      const cookieHeader = getSignedCookie('user_did', did);

      const response = await request(app)
        .post('/api/post')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', 'invalid-token-12345')
        .send({ text: 'Test' });

      // CSRF protection should block this (403 or 500)
      expect([403, 500]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limit on login endpoint', async () => {
      // Create app with low rate limit for testing
      const testApp = await createTestApp({
        loginRateLimit: 5 // Only 5 requests allowed
      });

      const requests = [];

      // Make 6 requests (1 more than limit)
      for (let i = 0; i < 6; i++) {
        requests.push(
          request(testApp)
            .get('/login?handle=test.user')
            .then(res => ({ status: res.status, headers: res.headers }))
        );
      }

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Check for rate limit headers
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.headers['ratelimit-limit']).toBeDefined();
    }, 15000); // Increase timeout for this test

    test('should enforce rate limit on post endpoint', async () => {
      const testApp = await createTestApp({
        postRateLimit: 3 // Only 3 posts allowed
      });

      const did = 'did:plc:ratelimitpost';
      await testApp._testOAuthClient.createMockSession(did, 'rate.test');
      const userCookie = getSignedCookie('user_did', did);

      const csrfResponse = await request(testApp)
        .get('/api/csrf')
        .set('Cookie', userCookie);
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      const allCookies = [userCookie, ...csrfCookies];

      const requests = [];

      // Make 4 requests (1 more than limit)
      for (let i = 0; i < 4; i++) {
        requests.push(
          request(testApp)
            .post('/api/post')
            .set('Cookie', allCookies)
            .set('x-csrf-token', csrfToken)
            .send({ text: `Post ${i}` })
            .then(res => res.status)
        );
      }

      const statuses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = statuses.filter(s => s === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    }, 15000);

    test('should include rate limit information in headers', async () => {
      const response = await request(app)
        .get('/login?handle=test.user')
        .expect(302);

      // Should have rate limit headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Cookie Security', () => {
    test('should set HttpOnly flag on user_did cookie', async () => {
      const loginResponse = await request(app)
        .get('/login?handle=alice.test')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=test`)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));

      expect(userDidCookie).toContain('HttpOnly');
    });

    test('should set Secure flag on user_did cookie', async () => {
      const loginResponse = await request(app)
        .get('/login?handle=alice.test')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=test`)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));

      expect(userDidCookie).toContain('Secure');
    });

    test('should set SameSite=Lax on user_did cookie', async () => {
      const loginResponse = await request(app)
        .get('/login?handle=alice.test')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=test`)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));

      expect(userDidCookie).toContain('SameSite=Lax');
    });

    test('should sign cookies', async () => {
      const loginResponse = await request(app)
        .get('/login?handle=alice.test')
        .expect(302);

      const authUrl = new URL(loginResponse.headers.location);
      const state = authUrl.searchParams.get('state');

      const response = await request(app)
        .get(`/oauth/callback?state=${state}&code=test`)
        .expect(302);

      const cookies = response.headers['set-cookie'];
      const userDidCookie = cookies.find(c => c.startsWith('user_did='));

      // Signed cookies have format: s:value.signature (may be URL-encoded)
      expect(userDidCookie).toMatch(/user_did=s(%3A|:)[^;]+\.[^;]+/);
    });

    test('should reject tampered cookies', async () => {
      // Set a cookie with invalid signature
      const response = await request(app)
        .get('/api/me')
        .set('Cookie', 'user_did=s:did:plc:fake.invalidsignature')
        .expect(200);

      // Should not be authenticated
      expect(response.body.loggedIn).toBe(false);
    });
  });

  describe('Input Validation', () => {
    test('should validate handle format in login', async () => {
      const invalidHandles = [
        'user@domain.com',  // @ not allowed
        'user_name',        // _ not allowed
        'user/name',        // / not allowed
        'user name',        // space not allowed
        'user#name',        // # not allowed
        '',                 // empty
        '   ',              // whitespace only
      ];

      for (const handle of invalidHandles) {
        await request(app)
          .get(`/login?handle=${encodeURIComponent(handle)}`)
          .expect(400);
      }
    });

    test('should validate text in post endpoint', async () => {
      const did = 'did:plc:validation';
      await app._testOAuthClient.createMockSession(did, 'validation.test');
      const userCookie = getSignedCookie('user_did', did);

      const csrfResponse = await request(app)
        .get('/api/csrf')
        .set('Cookie', userCookie);
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      const allCookies = [userCookie, ...csrfCookies];

      // Missing text
      await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({})
        .expect(400);

      // Empty text
      await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ text: '' })
        .expect(400);

      // Non-string text
      await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ text: 123 })
        .expect(400);

      // Too long text
      await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ text: 'a'.repeat(301) })
        .expect(400);
    });
  });

  describe('Helmet Security Headers', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/api/me')
        .expect(200);

      // Helmet sets various security headers
      // Check for some common ones
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });

  describe('Authentication Security', () => {
    test('should reject requests to protected endpoints without auth', async () => {
      const response = await request(app)
        .post('/api/post')
        .set('x-csrf-token', 'test')
        .send({ text: 'Test' });

      // Should be blocked (401 for auth, 403/500 for CSRF - either way it's blocked)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should reject requests with expired/invalid sessions', async () => {
      const cookieHeader = getSignedCookie('user_did', 'did:plc:nonexistent');

      const response = await request(app)
        .get('/api/me')
        .set('Cookie', cookieHeader)
        .expect(200);

      expect(response.body.loggedIn).toBe(false);
    });

    test('should not expose internal error details', async () => {
      // When errors occur, response should be generic
      const response = await request(app)
        .get('/oauth/callback?state=invalid')
        .expect(500);

      // Should contain generic error message, not stack traces
      expect(response.text).not.toContain('at ');
      expect(response.text).not.toContain('Error:');
      expect(response.text).toContain('Login failed');
    });
  });

  describe('JSON Payload Size Limit', () => {
    test('should reject payloads larger than 1MB', async () => {
      const largePayload = {
        text: 'a'.repeat(2 * 1024 * 1024) // 2MB
      };

      const response = await request(app)
        .post('/api/post')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(largePayload));

      // Should reject large payloads (413 or 500 depending on when limit is enforced)
      expect([413, 500]).toContain(response.status);
    });

    test('should accept payloads under 1MB', async () => {
      const did = 'did:plc:payloadtest';
      await app._testOAuthClient.createMockSession(did, 'payload.test');
      const userCookie = getSignedCookie('user_did', did);

      const csrfResponse = await request(app)
        .get('/api/csrf')
        .set('Cookie', userCookie);
      const csrfToken = csrfResponse.body.token;
      const csrfCookies = csrfResponse.headers['set-cookie'];

      const allCookies = [userCookie, ...csrfCookies];

      // 300 chars is well under 1MB
      const response = await request(app)
        .post('/api/post')
        .set('Cookie', allCookies)
        .set('x-csrf-token', csrfToken)
        .send({ text: 'a'.repeat(300) })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
