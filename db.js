const Database = require('better-sqlite3');
const { createClient } = require('redis');
const path = require('path');

// Factory to create a store interface
const createStore = (redisClient, sqliteDb, tableName) => {
    if (redisClient) {
        // Redis Implementation
        return {
            async set(key, val) {
                await redisClient.set(key, JSON.stringify(val));
            },
            async get(key) {
                const val = await redisClient.get(key);
                return val ? JSON.parse(val) : undefined;
            },
            async del(key) {
                await redisClient.del(key);
            }
        };
    } else {
        // SQLite Implementation
        return {
            async set(key, val) {
                const stmt = sqliteDb.prepare(`INSERT OR REPLACE INTO ${tableName} (key, value) VALUES (?, ?)`);
                stmt.run(key, JSON.stringify(val));
            },
            async get(key) {
                const stmt = sqliteDb.prepare(`SELECT value FROM ${tableName} WHERE key = ?`);
                const row = stmt.get(key);
                if (!row) return undefined;
                return JSON.parse(row.value);
            },
            async del(key) {
                const stmt = sqliteDb.prepare(`DELETE FROM ${tableName} WHERE key = ?`);
                stmt.run(key);
            }
        };
    }
};

// In-memory locks for SQLite mode (single instance only)
const inMemoryLocks = new Map();

// Create a request lock function for OAuth token refresh coordination
const createRequestLock = (redisClient) => {
    if (redisClient) {
        // Redis-based distributed lock using SET NX PX
        return async (key, fn) => {
            const lockKey = `lock:${key}`;
            const lockValue = `${Date.now()}-${Math.random()}`;
            const lockTimeout = 30000; // 30 second lock timeout

            // Try to acquire lock
            const acquired = await redisClient.set(lockKey, lockValue, {
                NX: true,  // Only set if not exists
                PX: lockTimeout  // Expire after timeout
            });

            if (!acquired) {
                // Wait and retry once
                await new Promise(resolve => setTimeout(resolve, 100));
                const retryAcquired = await redisClient.set(lockKey, lockValue, {
                    NX: true,
                    PX: lockTimeout
                });
                if (!retryAcquired) {
                    throw new Error(`Could not acquire lock for ${key}`);
                }
            }

            try {
                return await fn();
            } finally {
                // Release lock only if we still own it
                const currentValue = await redisClient.get(lockKey);
                if (currentValue === lockValue) {
                    await redisClient.del(lockKey);
                }
            }
        };
    } else {
        // In-memory lock for SQLite (single instance)
        return async (key, fn) => {
            // Wait for any existing lock to release
            while (inMemoryLocks.has(key)) {
                await inMemoryLocks.get(key);
            }

            // Create a new lock promise
            let releaseLock;
            const lockPromise = new Promise(resolve => {
                releaseLock = resolve;
            });
            inMemoryLocks.set(key, lockPromise);

            try {
                return await fn();
            } finally {
                inMemoryLocks.delete(key);
                releaseLock();
            }
        };
    }
};

let stateStore;
let sessionStore;
let requestLock;
let redisClient;
let sqliteDb;
let isInitialized = false;

// Initialize database connection (must be called before using stores)
async function initialize() {
    if (isInitialized) {
        return; // Already initialized
    }

    if (process.env.REDIS_URL) {
        console.log('⚡️ Using Redis for storage');
        redisClient = createClient({
            url: process.env.REDIS_URL
        });

        redisClient.on('error', (err) => console.error('Redis Client Error', err));

        try {
            // Wait for connection to be established
            await redisClient.connect();
            console.log('✅ Redis connected successfully');

            stateStore = createStore(redisClient, null, null);
            sessionStore = createStore(redisClient, null, null);
            requestLock = createRequestLock(redisClient);
        } catch (err) {
            console.error('❌ Failed to connect to Redis:', err.message);
            throw new Error(`Redis connection failed: ${err.message}`);
        }

    } else {
        console.log('📂 Using SQLite for storage');
        sqliteDb = new Database(path.join(__dirname, 'db.sqlite'));

        // Initialize tables (Unified schema name pattern)
        sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS auth_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_session (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

        stateStore = createStore(null, sqliteDb, 'auth_state');
        sessionStore = createStore(null, sqliteDb, 'auth_session');
        requestLock = createRequestLock(null);
        console.log('✅ SQLite initialized successfully');
    }

    isInitialized = true;
}

// Close database connection
async function close() {
    if (!isInitialized) {
        return;
    }

    if (redisClient) {
        try {
            await redisClient.quit();
            console.log('✅ Redis connection closed');
        } catch (err) {
            console.error('Error closing Redis:', err);
        }
    }

    if (sqliteDb) {
        try {
            sqliteDb.close();
            console.log('✅ SQLite connection closed');
        } catch (err) {
            console.error('Error closing SQLite:', err);
        }
    }

    isInitialized = false;
    stateStore = null;
    sessionStore = null;
    requestLock = null;
    redisClient = null;
    sqliteDb = null;
}

// Health check for monitoring
async function healthCheck() {
    if (!isInitialized) {
        return false;
    }

    try {
        if (redisClient) {
            // Check Redis connectivity with ping
            await redisClient.ping();
            return true;
        } else if (sqliteDb) {
            // Check SQLite by running a simple query
            const stmt = sqliteDb.prepare('SELECT 1');
            stmt.get();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
}

module.exports = {
    initialize,
    close,
    healthCheck,
    get stateStore() {
        if (!isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return stateStore;
    },
    get sessionStore() {
        if (!isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return sessionStore;
    },
    get requestLock() {
        if (!isInitialized) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        return requestLock;
    }
};
