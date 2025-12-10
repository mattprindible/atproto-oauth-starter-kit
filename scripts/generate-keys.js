const { generateKeyPair, exportJWK } = require('jose');
const fs = require('fs');
const path = require('path');

async function main() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });

    const privateJwk = await exportJWK(privateKey);
    const publicJwk = await exportJWK(publicKey);

    // Add kid (Key ID) - useful if we rotate keys later
    const kid = 'key-1';
    privateJwk.kid = kid;
    publicJwk.kid = kid;

    // Specific properties for ATProtocol checks
    privateJwk.use = 'sig';
    publicJwk.use = 'sig';
    privateJwk.alg = 'ES256';
    publicJwk.alg = 'ES256';

    const keys = {
        privateJwk,
        publicJwk
    };

    const outputPath = path.join(__dirname, '..', 'keys.json');
    fs.writeFileSync(outputPath, JSON.stringify(keys, null, 2));

    console.log(`Keys generated and saved to ${outputPath}`);
    console.log('PUBLIC KEY (for client-metadata.json):');
    console.log(JSON.stringify(publicJwk, null, 2));
}

main().catch(console.error);
