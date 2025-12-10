# ATProtocol OAuth Starter Kit

A minimal, robust "Confidential Client" implementation for ATProtocol (Bluesky) OAuth authentication in Node.js.

This project serves as a blueprint for building Bluesky apps that:
- ✅ Authenticate with real Bluesky accounts (bsky.social) or self-hosted PDS.
- ✅ Use **Confidential Client** auth (Private Key JWT) for better security and 90-day sessions.
- ✅ Handle the full OAuth lifecycle: Login, Callback, Token Refresh, and Revocation.
- ✅ Store sessions persistently (SQLite included, easily swappable for Postgres/Redis).

## Why this exists?

Most ATProto examples use "App Passwords", which are limited. The official OAuth flow lets users log in securely without sharing their main password, but it requires hosting a public "Client Metadata" file and handling cryptographic keys. This starter kit wires all that up for you.

## Getting Started

### 1. Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/your-username/atproto-oauth-starter.git
cd atproto-oauth-starter
npm install
```

### 2. Generate Identity

Run the helper script to generate your app's cryptographic keys (`keys.json`). This defines your app's "Identity".

```bash
npm run generate-keys
```

> **Note**: In production, manage `keys.json` carefully. If you lose it, your users will be logged out.

### 3. Expose to the Internet

For Bluesky to verify your app, it must be able to fetch your `client-metadata.json` from a public URL.

For local development, use **ngrok**:

```bash
# Install ngrok if you haven't
brew install --cask ngrok

# Start tunnel
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://random-name.ngrok-free.app`).

### 4. Configure

Create a `.env` file:

```ini
PORT=3000
# Your public URL from ngrok (no trailing slash)
PUBLIC_URL=https://random-name.ngrok-free.app
# A secret for signing cookies
COOKIE_SECRET=change-this-to-something-secret
```

### 5. Run

```bash
npm run dev
```

Visit your `PUBLIC_URL` in a browser. You can now log in with any Bluesky handle!

## Project Structure

- **`server.js`**: Main Express app. Handles the OAuth endpoints (`/client-metadata.json`, `/login`, `/oauth/callback`).
- **`db.js`**: Simple SQLite wrapper. Stores OAuth state (login attempts) and Sessions (tokens).
- **`public/`**: Frontend assets.
- **`scripts/generate-keys.js`**: Creates the JWK (JSON Web Key) pair.

## Moving to Production

1.  **Database**: Swap `db.js` for a real database (PostgreSQL, Redis). The OAuth client just needs an interface with `set()`, `get()`, and `del()`.
2.  **Deployment**: Deploy this code to a server with a static domain (e.g., `myapp.com`). Update `PUBLIC_URL` in `.env`.
3.  **Keys**: Commit your code, but **DO NOT commit `keys.json`**. Generate new keys on your production server or inject them via environment variables.

## License

MIT
