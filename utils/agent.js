/**
 * Agent Utilities
 *
 * Helper functions for managing ATProto agents and sessions.
 */

const { Agent } = require('@atproto/api');

/**
 * Get Agent for a given DID by restoring OAuth session
 * @param {string} did - User's DID
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<Agent|null>} Agent instance or null if session expired
 */
async function getAgent(did, oauthClient) {
    try {
        const oauthSession = await oauthClient.restore(did);
        // Note: oauthSession might refresh tokens internally here!

        // Create actual API Agent
        const agent = new Agent(oauthSession);
        return agent;
    } catch (err) {
        console.warn(`Failed to restore session for ${did}:`, err);
        return null;
    }
}

module.exports = { getAgent };
