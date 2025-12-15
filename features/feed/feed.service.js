/**
 * Feed Service
 *
 * Handles fetching the user's home timeline (posts from followed accounts).
 */

const { getAgent } = require('../../utils/agent');

/**
 * Get the user's home timeline
 * @param {string} did - User's DID
 * @param {Object} oauthClient - OAuth client instance
 * @param {string} [cursor] - Pagination cursor
 * @param {number} [limit=20] - Number of posts to fetch
 * @returns {Promise<{posts: Array, cursor?: string}>}
 */
async function getTimeline(did, oauthClient, cursor, limit = 20) {
    const agent = await getAgent(did, oauthClient);
    if (!agent) {
        return { posts: [], cursor: null };
    }

    const response = await agent.getTimeline({
        limit,
        cursor
    });

    const posts = response.data.feed.map(item => {
        const post = item.post;
        const author = post.author;
        const record = post.record;

        return {
            uri: post.uri,
            cid: post.cid,
            author: {
                did: author.did,
                handle: author.handle,
                displayName: author.displayName || author.handle,
                avatar: author.avatar
            },
            text: record.text,
            createdAt: record.createdAt,
            likeCount: post.likeCount || 0,
            repostCount: post.repostCount || 0,
            replyCount: post.replyCount || 0,
            indexedAt: post.indexedAt
        };
    });

    return {
        posts,
        cursor: response.data.cursor || null
    };
}

module.exports = { getTimeline };
