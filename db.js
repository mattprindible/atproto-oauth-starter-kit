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
        const db = new Database(path.join(__dirname, 'db.sqlite'));

        // Initialize tables (Unified schema name pattern)
        db.exec(`
        CREATE TABLE IF NOT EXISTS auth_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_session (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

        stateStore = createStore(null, db, 'auth_state');
        sessionStore = createStore(null, db, 'auth_session');
        console.log('✅ SQLite initialized successfully');
    }

    isInitialized = true;
}

module.exports = {
    initialize,
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
