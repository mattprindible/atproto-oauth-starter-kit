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

let stateStore;
let sessionStore;
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
    }
};
