/**
 * Profile Service
 *
 * Handles user profile operations including fetching current user data.
 */

const { getAgent } = require('../../utils/agent');

/**
 * Get current user's profile
 * @param {string} did - User's DID
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<{loggedIn: boolean, did?: string, handle?: string, displayName?: string, avatar?: string}>}
 */
async function getCurrentUserProfile(did, oauthClient) {
    if (!did) {
        return { loggedIn: false };
    }

    // Restore session for this DID
    const agent = await getAgent(did, oauthClient);
    if (!agent) {
        return { loggedIn: false }; // Session expired/gone
    }

    const profile = await agent.getProfile({ actor: agent.did });

    return {
        loggedIn: true,
        did: agent.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar
    };
}

module.exports = { getCurrentUserProfile };
