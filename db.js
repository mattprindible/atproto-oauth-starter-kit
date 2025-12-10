const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'db.sqlite'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_state (
    key TEXT PRIMARY KEY,
    state TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS auth_session (
    key TEXT PRIMARY KEY,
    session TEXT NOT NULL
  );
`);

module.exports = {
    // State Store (Short lived)
    stateStore: {
        async set(key, val) {
            const stmt = db.prepare('INSERT OR REPLACE INTO auth_state (key, state) VALUES (?, ?)');
            stmt.run(key, JSON.stringify(val));
        },
        async get(key) {
            const stmt = db.prepare('SELECT state FROM auth_state WHERE key = ?');
            const row = stmt.get(key);
            if (!row) return undefined;
            return JSON.parse(row.state);
        },
        async del(key) {
            const stmt = db.prepare('DELETE FROM auth_state WHERE key = ?');
            stmt.run(key);
        }
    },

    // Session Store (Long lived)
    sessionStore: {
        async set(key, val) {
            const stmt = db.prepare('INSERT OR REPLACE INTO auth_session (key, session) VALUES (?, ?)');
            stmt.run(key, JSON.stringify(val));
        },
        async get(key) {
            const stmt = db.prepare('SELECT session FROM auth_session WHERE key = ?');
            const row = stmt.get(key);
            if (!row) return undefined;
            return JSON.parse(row.session);
        },
        async del(key) {
            const stmt = db.prepare('DELETE FROM auth_session WHERE key = ?');
            stmt.run(key);
        }
    }
};
