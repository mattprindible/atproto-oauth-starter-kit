/**
 * OAuth Client Configuration
 *
 * Creates and configures the ATProto OAuth client with proper metadata
 * and key management.
 */

const { JoseKey } = require('@atproto/jwk-jose');
const { NodeOAuthClient } = require('@atproto/oauth-client-node');

/**
 * Create client metadata for OAuth
 * @param {string} publicUrl - The public URL of this application
 * @param {Object} keys - Keys object with publicJwk
 * @returns {Object} Client metadata for OAuth
 */
function createClientMetadata(publicUrl, keys) {
    return {
        client_id: `${publicUrl}/client-metadata.json`,
        client_name: 'ATProto OAuth Example',
        client_uri: publicUrl,
        logo_uri: `${publicUrl}/logo.png`, // Optional
        tos_uri: `${publicUrl}/tos`, // Optional
        policy_uri: `${publicUrl}/policy`, // Optional
        redirect_uris: [`${publicUrl}/oauth/callback`],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: 'atproto transition:generic', // Standard scope for now
        token_endpoint_auth_method: 'private_key_jwt',
        token_endpoint_auth_signing_alg: 'ES256',
        dpop_bound_access_tokens: true,
        jwks: {
            keys: [keys.publicJwk]
        }
    };
}

/**
 * Create and configure OAuth client
 * @param {Object} keys - Keys object with privateJwk
 * @param {string} publicUrl - The public URL of this application
 * @param {Object} stateStore - Store for OAuth state
 * @param {Object} sessionStore - Store for OAuth sessions
 * @param {Function} requestLock - Lock function for token refresh coordination
 * @returns {Promise<{oauthClient: NodeOAuthClient, clientMetadata: Object}>}
 */
async function createOAuthClient(keys, publicUrl, stateStore, sessionStore, requestLock) {
    const privateKey = await JoseKey.fromJWK(keys.privateJwk);
    const clientMetadata = createClientMetadata(publicUrl, keys);

    const oauthClient = new NodeOAuthClient({
        clientMetadata,
        keyset: [privateKey],
        stateStore,
        sessionStore,
        requestLock,
    });

    return { oauthClient, clientMetadata };
}

module.exports = { createOAuthClient };
