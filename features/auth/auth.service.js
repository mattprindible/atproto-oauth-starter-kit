/**
 * Authentication Service
 *
 * Handles OAuth flow business logic including:
 * - Login initiation
 * - OAuth callback processing
 * - Session management
 * - Token revocation
 */

/**
 * Initiate OAuth login flow
 * @param {string} handle - User's Bluesky handle
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<URL>} Authorization URL to redirect to
 */
async function initiateLogin(handle, oauthClient) {
    // Initiate OAuth authorization
    const url = await oauthClient.authorize(handle, {
        scope: 'atproto transition:generic',
    });

    return url;
}

/**
 * Process OAuth callback
 * @param {URLSearchParams} params - Query parameters from OAuth callback
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<{did: string}>} Session object with user's DID
 */
async function processCallback(params, oauthClient) {
    const { session } = await oauthClient.callback(params);
    return session;
}

/**
 * Revoke OAuth tokens and cleanup session
 * @param {string} did - User's DID
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<void>}
 */
async function logout(did, oauthClient) {
    if (did) {
        await oauthClient.revoke(did);
    }
}

/**
 * Validate handle format
 * @param {string} handle - Handle to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateHandle(handle) {
    if (!handle || typeof handle !== 'string' || handle.trim().length === 0) {
        return { valid: false, error: 'Handle required' };
    }

    // Basic handle format check (alphanumeric + dots/hyphens)
    if (!/^[a-zA-Z0-9.-]+$/.test(handle)) {
        return { valid: false, error: 'Invalid handle format' };
    }

    return { valid: true };
}

module.exports = {
    initiateLogin,
    processCallback,
    logout,
    validateHandle
};
