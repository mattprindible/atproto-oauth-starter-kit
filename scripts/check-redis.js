const { createClient } = require('redis');

async function main() {
    const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    await client.connect();
    console.log('Connected to Redis');

    const keys = await client.keys('*');
    console.log(`Found ${keys.length} keys:`);

    for (const key of keys) {
        const type = await client.type(key);
        console.log(`- ${key} (${type})`);

        // If it looks like a session or state, let's peek at it
        // The library uses DID as key for sessions, or random strings for state
        if (type === 'string') {
            const val = await client.get(key);
            try {
                const json = JSON.parse(val);
                // Print a summary if it's a huge object
                if (json.tokenSet) {
                    console.log(`  -> Session for: ${json.sub || 'unknown'}`);
                    console.log(`  -> Access Token expires: ${new Date(json.tokenSet.expires_at * 1000).toLocaleString()}`);
                } else {
                    console.log(`  -> Value: ${val.substring(0, 50)}...`);
                }
            } catch (e) {
                console.log(`  -> Value: ${val.substring(0, 50)}...`);
            }
        }
    }

    await client.disconnect();
}

main().catch(console.error);
