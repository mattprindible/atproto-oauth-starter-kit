/**
 * Posts Routes
 *
 * Handles post creation endpoints:
 * - POST /api/post - Create a new post
 */

const express = require('express');
const { postLimiter } = require('../../config/security');
const { validatePostText, createPost } = require('./posts.service');

const router = express.Router();

/**
 * POST /api/post
 * Create a new post
 */
router.post('/post', postLimiter, async (req, res) => {
    const did = req.signedCookies.user_did;
    if (!did) {
        return res.status(401).json({ error: 'Not logged in' });
    }

    const { text } = req.body;

    // Input Validation
    const validation = validatePostText(text);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        await createPost(did, text, req.app.locals.oauthClient);
        res.json({ success: true });
    } catch (err) {
        console.error('Post error:', err);
        res.status(500).json({ error: 'Failed to post' });
    }
});

module.exports = router;
