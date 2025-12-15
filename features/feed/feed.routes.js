/**
 * Feed Routes
 *
 * Handles feed endpoints:
 * - GET /api/feed - Get user's home timeline
 */

const express = require('express');
const { getTimeline } = require('./feed.service');

const router = express.Router();

/**
 * GET /api/feed
 * Get the authenticated user's home timeline
 * Query params:
 *   - cursor: pagination cursor for next page
 *   - limit: number of posts (default 20, max 50)
 */
router.get('/feed', async (req, res) => {
    const did = req.signedCookies.user_did;
    if (!did) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const cursor = req.query.cursor || undefined;
    let limit = parseInt(req.query.limit, 10) || 20;
    limit = Math.min(Math.max(limit, 1), 50); // Clamp between 1 and 50

    try {
        const timeline = await getTimeline(did, req.app.locals.oauthClient, cursor, limit);
        res.json(timeline);
    } catch (err) {
        console.error('Feed error:', err);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

module.exports = router;
