# ATProtocol OAuth Starter Kit

A production-ready "Confidential Client" implementation for ATProtocol (Bluesky) OAuth authentication in Node.js.

This project serves as a blueprint for building Bluesky apps that:
- ✅ Authenticate with real Bluesky accounts (bsky.social) or self-hosted PDS.
- ✅ Use **Confidential Client** auth (Private Key JWT) for better security and 90-day sessions.
- ✅ Handle the full OAuth lifecycle: Login, Callback, Token Refresh, and Revocation.
- ✅ Store sessions persistently (SQLite for development, Redis for production).
- ✅ Modular feature-based architecture for easy extension.
- ✅ Docker support for containerized deployment.
- ✅ Production deployment configurations (Railway, etc.).

## Why this exists?

Most ATProto examples use "App Passwords", which are limited. The official OAuth flow lets users log in securely without sharing their main password, but it requires hosting a public "Client Metadata" file and handling cryptographic keys. This starter kit wires all that up for you with a clean, maintainable architecture.

## Getting Started

### 1. Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/your-username/atproto-oauth-starter-kit.git
cd atproto-oauth-starter-kit
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

The project uses a modular, feature-based architecture for maintainability:

```
├── config/                     # Configuration modules
│   ├── environment.js          # Environment variable management
│   ├── oauth-client.js         # OAuth client configuration
│   └── security.js             # Security middleware setup
├── features/                   # Feature modules
│   ├── auth/                   # Authentication feature
│   │   ├── auth.routes.js      # Auth endpoints (login, callback, logout)
│   │   └── auth.service.js     # Auth business logic
│   ├── metadata/               # Client metadata feature
│   │   └── metadata.routes.js  # Client metadata endpoint
│   ├── posts/                  # Posts feature
│   │   ├── posts.routes.js     # Post creation endpoints
│   │   └── posts.service.js    # Post business logic
│   └── profile/                # User profile feature
│       ├── profile.routes.js   # Profile endpoints
│       └── profile.service.js  # Profile business logic
├── utils/                      # Utility modules
│   └── agent.js                # AT Protocol agent utilities
├── public/                     # Frontend assets
│   └── index.html              # Single-page application
├── scripts/                    # Utility scripts
│   ├── generate-keys.js        # JWK key pair generator
│   └── check-redis.js          # Redis connection checker
├── tests/                      # Comprehensive test suite
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
├── server.js                   # Main Express application
├── db.js                       # Database abstraction layer (SQLite/Redis)
├── Dockerfile                  # Docker container configuration
└── docker-compose.yml          # Docker Compose setup
```

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

## Deployment

### Local Development with Docker

Use Docker Compose for a production-like environment locally:

```bash
docker-compose up
```

This will start both the application and Redis cache.

### Production Deployment

#### Option 1: Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Railway will automatically detect the Dockerfile and build your app
3. Set the required environment variables in Railway:
   - `PUBLIC_URL`: Your Railway app URL (e.g., `https://your-app.up.railway.app`)
   - `COOKIE_SECRET`: A secure random string
   - `KEYS_JSON`: Your `keys.json` content (single-line format)
   - `REDIS_URL`: (Optional) Railway Redis connection string

Railway will automatically redeploy when you push to your GitHub repository.

#### Option 2: Any Docker-Compatible Platform

The included Dockerfile works with any container platform (Render, Fly.io, AWS, GCP, etc.):

1. Build: `docker build -t atproto-oauth-app .`
2. Deploy the container to your platform
3. Set environment variables as needed
4. Ensure your `PUBLIC_URL` matches your production domain

### Production Checklist

- [ ] **Database**: The app uses SQLite by default. For production, configure Redis via `REDIS_URL` environment variable.
- [ ] **Keys**: Never commit `keys.json`. Use the `KEYS_JSON` environment variable or mount it as a secret.
- [ ] **Domain**: Update `PUBLIC_URL` to your production domain.
- [ ] **Security**: Use a strong `COOKIE_SECRET` and enable HTTPS.

## License

MIT
