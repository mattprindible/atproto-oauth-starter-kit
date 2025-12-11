/**
 * Profile Routes
 *
 * Handles user profile endpoints:
 * - GET /api/me - Get current authenticated user's profile
 */

const express = require('express');
const { getCurrentUserProfile } = require('./profile.service');

const router = express.Router();

/**
 * GET /api/me
 * Get current authenticated user's profile
 */
router.get('/me', async (req, res) => {
    const did = req.signedCookies.user_did;

    try {
        const profile = await getCurrentUserProfile(did, req.app.locals.oauthClient);
        res.json(profile);
    } catch (err) {
        console.error('API Me error:', err);
        // Don't expose internal errors
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

module.exports = router;
