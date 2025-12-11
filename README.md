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
- **`tests/`**: Comprehensive test suite (unit & integration tests).

## Testing

This project includes a comprehensive test suite to ensure reliability and prevent regressions as you build on top of it.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (great for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Test Coverage

The test suite includes **90 tests** covering:

- **Unit Tests**:
  - Environment variable validation
  - Database operations (SQLite storage)

- **Integration Tests**:
  - Complete OAuth flow (login, callback, logout)
  - API endpoints (`/api/me`, `/api/post`, `/api/csrf`)
  - Security features (CSRF protection, rate limiting, cookie security)
  - Input validation
  - Error handling

### Test Structure

```
tests/
├── setup.js                    # Test environment configuration
├── helpers/
│   ├── mock-oauth.js           # Mock OAuth client for testing
│   ├── mock-keys.js            # Pre-generated test keys
│   └── test-server.js          # Test server setup utilities
├── unit/
│   ├── environment.test.js     # Environment validation tests
│   └── db.test.js              # Database operation tests
└── integration/
    ├── oauth-flow.test.js      # OAuth flow tests
    ├── api-endpoints.test.js   # API endpoint tests
    └── security.test.js        # Security feature tests
```

### Why Tests Matter for AI Agents

Tests are especially valuable when working with AI coding agents (like me!). They:

- **Prevent regressions**: Agents can verify changes don't break existing functionality
- **Enable confident refactoring**: Tests provide a safety net for code improvements
- **Self-verification**: Agents can run tests to validate their own work
- **Documentation**: Tests show how the code is meant to be used

When an agent makes changes, it can simply run `npm test` to verify everything still works correctly.

## Moving to Production

1.  **Database**: Swap `db.js` for a real database (PostgreSQL, Redis). The OAuth client just needs an interface with `set()`, `get()`, and `del()`.
2.  **Deployment**: Deploy this code to a server with a static domain (e.g., `myapp.com`). Update `PUBLIC_URL` in `.env`.
3.  **Keys**: Commit your code, but **DO NOT commit `keys.json`**. Generate new keys on your production server or inject them via environment variables.

## License

MIT
