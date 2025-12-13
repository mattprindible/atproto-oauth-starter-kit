/**
 * Metadata Routes
 *
 * Handles metadata and utility endpoints:
 * - GET /client-metadata.json - OAuth client metadata
 * - GET /api/csrf - CSRF token generation
 * - GET /api/health - Health check endpoint
 */

const express = require('express');
const db = require('../../db');

const router = express.Router();

/**
 * GET /client-metadata.json
 * OAuth client metadata (required for ATProto OAuth)
 */
router.get('/client-metadata.json', (req, res) => {
    res.json(req.app.locals.clientMetadata);
});

/**
 * GET /api/csrf
 * Get CSRF token for protected requests
 */
router.get('/api/csrf', (req, res) => {
    const token = req.app.locals.generateCsrfToken(req, res);
    res.json({ token });
});

/**
 * GET /api/health
 * Health check endpoint for monitoring and container orchestration
 * Returns 200 OK if the service is healthy, 503 if degraded
 */
router.get('/api/health', async (req, res) => {
    try {
        // Check database connectivity
        const dbHealthy = await db.healthCheck();

        const health = {
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbHealthy ? 'connected' : 'disconnected'
        };

        const statusCode = dbHealthy ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});

module.exports = router;
