/**
 * Posts Service
 *
 * Handles post creation and validation.
 */

const { getAgent } = require('../../utils/agent');

/**
 * Validate post text
 * @param {string} text - Post text to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validatePostText(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'Text required' };
    }

    if (text.length > 300) {
        return { valid: false, error: 'Text too long (max 300 chars)' };
    }

    return { valid: true };
}

/**
 * Create a post on Bluesky
 * @param {string} did - User's DID
 * @param {string} text - Post text
 * @param {Object} oauthClient - OAuth client instance
 * @returns {Promise<void>}
 */
async function createPost(did, text, oauthClient) {
    const agent = await getAgent(did, oauthClient);

    await agent.post({
        text: text,
        createdAt: new Date().toISOString()
    });
}

module.exports = { validatePostText, createPost };
