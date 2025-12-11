/**
 * Authentication Routes
 *
 * Handles OAuth authentication endpoints:
 * - GET /login - Initiate OAuth flow
 * - GET /oauth/callback - Handle OAuth callback
 * - POST /logout - Logout and revoke tokens
 */

const express = require('express');
const { loginLimiter } = require('../../config/security');
const { initiateLogin, processCallback, logout, validateHandle } = require('./auth.service');

const router = express.Router();

/**
 * GET /login
 * Initiate OAuth login flow
 */
router.get('/login', loginLimiter, async (req, res) => {
    const handle = req.query.handle;

    // Input Validation
    const validation = validateHandle(handle);
    if (!validation.valid) {
        return res.status(400).send(validation.error);
    }

    try {
        const url = await initiateLogin(handle, req.app.locals.oauthClient);
        // Redirect user to PDS (convert to string for Express 5 compatibility)
        res.redirect(url.toString());
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send(`Failed to start login: ${err.message}`);
    }
});

/**
 * GET /oauth/callback
 * Handle OAuth callback from PDS
 */
router.get('/oauth/callback', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query);
        const session = await processCallback(params, req.app.locals.oauthClient);

        // Store DID in a signed httpOnly cookie to track the browser user
        res.cookie('user_did', session.did, {
            httpOnly: true,
            signed: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
            sameSite: 'lax', // Must be lax for top-level navigation (redirect from PDS)
            secure: true
        });

        res.redirect('/');
    } catch (err) {
        console.error('Callback error:', err);
        res.status(500).send(`Login failed: ${err.message}`);
    }
});

/**
 * POST /logout
 * Logout user and revoke OAuth tokens
 */
router.post('/logout', async (req, res) => {
    const did = req.signedCookies.user_did;

    try {
        await logout(did, req.app.locals.oauthClient);
    } catch (err) {
        console.error('Failed to revoke token:', err);
        // Continue anyway to clear cookie
    }

    res.clearCookie('user_did');
    res.json({ success: true });
});

module.exports = router;
