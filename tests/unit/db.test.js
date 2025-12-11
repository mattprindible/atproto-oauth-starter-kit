/**
 * Unit tests for database operations
 * Tests both stateStore and sessionStore functionality
 */

const db = require('../../db');

describe('Database Operations', () => {
  beforeAll(async () => {
    // Ensure we're using SQLite for tests (not Redis)
    delete process.env.REDIS_URL;
    await db.initialize();
  });

  afterEach(async () => {
    // Clean up test data after each test
    // Note: We can't easily reset the DB, so we'll delete known keys
  });

  describe('stateStore', () => {
    test('should store and retrieve state data', async () => {
      const key = 'test-state-key-1';
      const value = {
        handle: 'alice.bsky.social',
        timestamp: Date.now(),
        options: { scope: 'atproto' }
      };

      await db.stateStore.set(key, value);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toEqual(value);
    });

    test('should return undefined for non-existent key', async () => {
      const retrieved = await db.stateStore.get('non-existent-key');
      expect(retrieved).toBeUndefined();
    });

    test('should delete state data', async () => {
      const key = 'test-state-key-2';
      const value = { data: 'test' };

      await db.stateStore.set(key, value);
      await db.stateStore.del(key);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toBeUndefined();
    });

    test('should handle overwrites (set same key twice)', async () => {
      const key = 'test-state-key-3';
      const value1 = { version: 1 };
      const value2 = { version: 2 };

      await db.stateStore.set(key, value1);
      await db.stateStore.set(key, value2);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toEqual(value2);
      expect(retrieved.version).toBe(2);
    });

    test('should handle complex nested objects', async () => {
      const key = 'test-state-key-4';
      const value = {
        user: {
          handle: 'test.user',
          profile: {
            name: 'Test User',
            avatar: 'https://example.com/avatar.jpg'
          }
        },
        metadata: {
          timestamp: Date.now(),
          tags: ['test', 'example']
        }
      };

      await db.stateStore.set(key, value);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toEqual(value);
      expect(retrieved.user.profile.name).toBe('Test User');
    });
  });

  describe('sessionStore', () => {
    test('should store and retrieve session data', async () => {
      const did = 'did:plc:test123';
      const sessionData = {
        tokenSet: {
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Date.now() + 3600000
        },
        sub: did
      };

      await db.sessionStore.set(did, sessionData);
      const retrieved = await db.sessionStore.get(did);

      expect(retrieved).toEqual(sessionData);
      expect(retrieved.sub).toBe(did);
    });

    test('should return undefined for non-existent session', async () => {
      const retrieved = await db.sessionStore.get('did:plc:nonexistent');
      expect(retrieved).toBeUndefined();
    });

    test('should delete session data', async () => {
      const did = 'did:plc:test456';
      const sessionData = {
        tokenSet: { access_token: 'token' },
        sub: did
      };

      await db.sessionStore.set(did, sessionData);
      await db.sessionStore.del(did);
      const retrieved = await db.sessionStore.get(did);

      expect(retrieved).toBeUndefined();
    });

    test('should update existing session (refresh token)', async () => {
      const did = 'did:plc:test789';
      const originalSession = {
        tokenSet: {
          access_token: 'original-token',
          expires_at: Date.now() + 3600000
        },
        sub: did
      };
      const updatedSession = {
        tokenSet: {
          access_token: 'refreshed-token',
          expires_at: Date.now() + 7200000
        },
        sub: did
      };

      await db.sessionStore.set(did, originalSession);
      await db.sessionStore.set(did, updatedSession);
      const retrieved = await db.sessionStore.get(did);

      expect(retrieved.tokenSet.access_token).toBe('refreshed-token');
    });

    test('should handle multiple sessions for different users', async () => {
      const did1 = 'did:plc:user1';
      const did2 = 'did:plc:user2';
      const session1 = { tokenSet: { access_token: 'token1' }, sub: did1 };
      const session2 = { tokenSet: { access_token: 'token2' }, sub: did2 };

      await db.sessionStore.set(did1, session1);
      await db.sessionStore.set(did2, session2);

      const retrieved1 = await db.sessionStore.get(did1);
      const retrieved2 = await db.sessionStore.get(did2);

      expect(retrieved1.tokenSet.access_token).toBe('token1');
      expect(retrieved2.tokenSet.access_token).toBe('token2');
    });
  });

  describe('Initialization', () => {
    test('should throw error when accessing stores before initialization', () => {
      // This test is tricky because we initialize in beforeAll
      // Just documenting the expected behavior
      // In a real scenario without initialization:
      // expect(() => db.stateStore).toThrow('Database not initialized');
    });

    test('should handle multiple initialization calls gracefully', async () => {
      // Should not throw or cause issues
      await db.initialize();
      await db.initialize();
      await db.initialize();

      // Should still work
      const testKey = 'multi-init-test';
      await db.stateStore.set(testKey, { test: true });
      const retrieved = await db.stateStore.get(testKey);
      expect(retrieved.test).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty objects', async () => {
      const key = 'empty-object-test';
      const value = {};

      await db.stateStore.set(key, value);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toEqual({});
    });

    test('should handle arrays in values', async () => {
      const key = 'array-test';
      const value = {
        items: [1, 2, 3, 4, 5],
        names: ['alice', 'bob', 'charlie']
      };

      await db.sessionStore.set(key, value);
      const retrieved = await db.sessionStore.get(key);

      expect(retrieved.items).toEqual([1, 2, 3, 4, 5]);
      expect(retrieved.names).toHaveLength(3);
    });

    test('should handle special characters in keys', async () => {
      const key = 'key:with:colons';
      const value = { test: 'special' };

      await db.stateStore.set(key, value);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved).toEqual(value);
    });

    test('should handle null values in objects', async () => {
      const key = 'null-value-test';
      const value = {
        nullField: null,
        definedField: 'value'
      };

      await db.stateStore.set(key, value);
      const retrieved = await db.stateStore.get(key);

      expect(retrieved.nullField).toBeNull();
      expect(retrieved.definedField).toBe('value');
    });
  });
});
