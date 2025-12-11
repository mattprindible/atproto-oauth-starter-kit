/**
 * Metadata Routes
 *
 * Handles metadata and utility endpoints:
 * - GET /client-metadata.json - OAuth client metadata
 * - GET /api/csrf - CSRF token generation
 */

const express = require('express');

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

module.exports = router;
