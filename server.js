require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const db = require('./db');
const { validateEnvironment } = require('./config/environment');
const { loadKeys, setupCsrf } = require('./config/security');
const { createOAuthClient } = require('./config/oauth-client');
const authRoutes = require('./features/auth/auth.routes');
const profileRoutes = require('./features/profile/profile.routes');
const postsRoutes = require('./features/posts/posts.routes');
const feedRoutes = require('./features/feed/feed.routes');
const metadataRoutes = require('./features/metadata/metadata.routes');

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

    // Make shared resources available to routes
    app.locals.oauthClient = oauthClient;
    app.locals.clientMetadata = clientMetadata;
    app.locals.generateCsrfToken = generateCsrfToken;

    // Trust proxy - required when behind reverse proxy (ngrok, load balancer, etc.)
    // This allows Express to read the real client IP from X-Forwarded-For header
    app.set('trust proxy', 1);

    app.use(helmet({
        contentSecurityPolicy: false, // Disabled for simplicity with inline scripts
    }));
    app.use(express.json({ limit: '1mb' })); // Prevent DoS via large JSON payloads
    app.use(express.static('public'));
    app.use(cookieParser(process.env.COOKIE_SECRET));

    // Apply CSRF protection to all unsafe routes
    // We explicitly exempt /client-metadata.json and /oauth/callback or just apply globally
    // since they are GET requests, they are ignored by default.
    // The only unsafe route is /api/post and /logout
    app.use(doubleCsrfProtection);

    // --- Routes ---

    // Metadata Routes (client-metadata.json, /api/csrf)
    app.use('/', metadataRoutes);

    // Auth Routes (login, callback, logout)
    app.use('/', authRoutes);

    // Profile Routes (/api/me)
    app.use('/api', profileRoutes);

    // Posts Routes (/api/post)
    app.use('/api', postsRoutes);

    // Feed Routes (/api/feed)
    app.use('/api', feedRoutes);

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

main().catch(console.error);
