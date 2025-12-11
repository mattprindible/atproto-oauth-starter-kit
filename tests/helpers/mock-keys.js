/**
 * Mock cryptographic keys for testing
 * These are pre-generated test keys - DO NOT use in production!
 */

const mockKeys = {
  privateJwk: {
    kty: 'EC',
    crv: 'P-256',
    x: 'WKn-ZIGevcwGIyyrzFoZNBdaq9_TsqzGl96oc0CWuis',
    y: 'y77t-RvAHRKTsSGdIYUfweuOvwrvDD-Q3Hv5J0fSKbE',
    d: 'Hndv7ZZjs_ke2o9EJCu-lyqO3Lq0wYqJHjmF5VlwAgk',
    kid: 'test-key-id-1',
    alg: 'ES256',
    use: 'sig',
    key_ops: ['sign']
  },
  publicJwk: {
    kty: 'EC',
    crv: 'P-256',
    x: 'WKn-ZIGevcwGIyyrzFoZNBdaq9_TsqzGl96oc0CWuis',
    y: 'y77t-RvAHRKTsSGdIYUfweuOvwrvDD-Q3Hv5J0fSKbE',
    kid: 'test-key-id-1',
    alg: 'ES256',
    use: 'sig',
    key_ops: ['verify']
  }
};

module.exports = mockKeys;
