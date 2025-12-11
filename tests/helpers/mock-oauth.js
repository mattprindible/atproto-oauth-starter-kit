/**
 * Mock OAuth Client for testing
 * Simulates the @atproto/oauth-client-node without making real network calls
 */

class MockOAuthClient {
  constructor({ stateStore, sessionStore }) {
    this.stateStore = stateStore;
    this.sessionStore = sessionStore;
    this.mockSessions = new Map();
  }

  /**
   * Mock authorize - returns a fake authorization URL
   */
  async authorize(handle, options) {
    const state = 'mock-state-' + Date.now();

    // Store state for validation in callback
    await this.stateStore.set(state, {
      handle,
      timestamp: Date.now(),
      options
    });

    return new URL(`https://mock-pds.example.com/oauth/authorize?state=${state}&handle=${handle}`);
  }

  /**
   * Mock callback - simulates successful OAuth callback
   */
  async callback(params) {
    const state = params.get('state');
    const code = params.get('code') || 'mock-code';

    // Validate state exists
    const stateData = await this.stateStore.get(state);
    if (!stateData) {
      throw new Error('Invalid state parameter');
    }

    // Create mock session
    const did = params.get('did') || 'did:plc:mocktestuser123';
    const session = {
      did,
      sub: did,
      handle: stateData.handle || 'mock.test.user',
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
    };

    // Store session
    await this.sessionStore.set(did, {
      tokenSet: {
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_at: Date.now() + 3600000, // 1 hour
      },
      sub: did,
    });

    this.mockSessions.set(did, session);

    // Clean up state
    await this.stateStore.del(state);

    return { session };
  }

  /**
   * Mock restore - retrieves existing session
   */
  async restore(did) {
    const sessionData = await this.sessionStore.get(did);

    if (!sessionData) {
      throw new Error(`Session not found for DID: ${did}`);
    }

    // Check if token is expired
    if (sessionData.tokenSet.expires_at < Date.now()) {
      // Simulate token refresh
      sessionData.tokenSet.access_token = 'mock-refreshed-token-' + Date.now();
      sessionData.tokenSet.expires_at = Date.now() + 3600000;
      await this.sessionStore.set(did, sessionData);
    }

    return {
      did,
      sub: sessionData.sub,
      // Mock the methods that Agent expects
      async getProfile({ actor }) {
        return {
          data: {
            did: actor,
            handle: 'mock.test.user',
            displayName: 'Mock Test User',
            avatar: 'https://example.com/avatar.jpg',
          }
        };
      },
      async post(record) {
        return {
          uri: 'at://mock-uri',
          cid: 'mock-cid',
        };
      }
    };
  }

  /**
   * Mock revoke - removes session
   */
  async revoke(did) {
    await this.sessionStore.del(did);
    this.mockSessions.delete(did);
    return true;
  }

  /**
   * Helper to create a mock session directly (for testing)
   */
  async createMockSession(did = 'did:plc:testuser123', handle = 'test.user') {
    const sessionData = {
      tokenSet: {
        access_token: 'mock-token-' + Date.now(),
        refresh_token: 'mock-refresh-' + Date.now(),
        expires_at: Date.now() + 3600000,
      },
      sub: did,
    };

    await this.sessionStore.set(did, sessionData);

    return {
      did,
      handle,
      sessionData,
    };
  }
}

/**
 * Mock Agent that works with our mock OAuth session
 */
class MockAgent {
  constructor(session) {
    this.did = session.did || session.sub;
    this.session = session;
  }

  async getProfile({ actor }) {
    return {
      data: {
        did: actor,
        handle: 'mock.test.user',
        displayName: 'Mock Test User',
        avatar: 'https://example.com/avatar.jpg',
      }
    };
  }

  async post(record) {
    if (!record.text) {
      throw new Error('Text is required');
    }
    return {
      uri: 'at://mock-uri',
      cid: 'mock-cid',
    };
  }
}

module.exports = {
  MockOAuthClient,
  MockAgent,
};
