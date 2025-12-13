# Docker Development Guide

This guide shows you how to use Docker and Docker Compose for local development with Redis, providing a production-like environment on your machine.

## Why Use Docker for Development?

- **Consistency**: Same environment as production (Railway uses Docker)
- **Redis included**: Test with Redis without installing it locally
- **Isolation**: Dependencies don't pollute your system
- **Easy cleanup**: `docker-compose down` removes everything
- **Learn Docker**: Industry-standard containerization

## Prerequisites

Install Docker Desktop:
- **macOS**: https://docs.docker.com/desktop/install/mac-install/
- **Windows**: https://docs.docker.com/desktop/install/windows-install/
- **Linux**: https://docs.docker.com/engine/install/

Verify installation:
```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Generate Keys

First time only, generate cryptographic keys:

```bash
npm run generate-keys
```

This creates `keys.json` in your project root.

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update these values:

```env
PORT=3000
PUBLIC_URL=http://localhost:3000  # For local dev without ngrok
COOKIE_SECRET=your-secure-random-secret-at-least-32-characters-long
REDIS_URL=redis://redis:6379  # Points to Redis container
```

**Generate COOKIE_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start Services

Start both the app and Redis:

```bash
docker-compose up
```

You should see:
```
atproto-redis  | Ready to accept connections
atproto-app    | ⚡️ Using Redis for storage
atproto-app    | ✅ Redis connected successfully
atproto-app    | Server running at http://localhost:3000
```

**First-time build takes longer** (~2-5 minutes) as Docker:
- Downloads Node.js base image
- Installs system dependencies
- Installs npm packages
- Compiles native modules (better-sqlite3)

Subsequent starts are much faster (5-10 seconds).

### 4. Access Your App

- **App**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Redis**: `localhost:6379` (from your host machine)

### 5. Stop Services

**Stop but keep data**:
```bash
docker-compose stop
```

**Stop and remove containers** (keeps data volumes):
```bash
docker-compose down
```

**Nuclear option** (removes everything including Redis data):
```bash
docker-compose down -v
```

## Development Workflows

### Making Code Changes

The `docker-compose.yml` is configured for **bind mounts** - your local code is synced to the container.

**Option 1: Auto-restart on changes** (recommended)

Edit `docker-compose.yml` to add `--watch` flag:
```yaml
app:
  command: ["npm", "run", "dev"]  # Uses node --watch
```

Then rebuild:
```bash
docker-compose up --build
```

**Option 2: Manual restart**

After making changes, restart the app service:
```bash
docker-compose restart app
```

### Viewing Logs

**All services**:
```bash
docker-compose logs -f
```

**Specific service**:
```bash
docker-compose logs -f app
docker-compose logs -f redis
```

**Last N lines**:
```bash
docker-compose logs --tail=50 app
```

### Running Commands in Containers

**Execute command in running container**:
```bash
# Open shell
docker-compose exec app sh

# Run npm commands
docker-compose exec app npm test
docker-compose exec app npm run test:coverage

# Check Redis
docker-compose exec redis redis-cli ping
```

### Inspecting Redis Data

Access Redis CLI:
```bash
docker-compose exec redis redis-cli
```

Useful Redis commands:
```redis
# List all keys
KEYS *

# Get a specific session
GET "session:did:plc:abc123..."

# Check Redis info
INFO

# Clear all data (destructive!)
FLUSHALL
```

## Using with ngrok for OAuth Testing

Since Bluesky OAuth requires HTTPS and a public URL, you'll need to expose your local app:

### 1. Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 2. Start ngrok

In a separate terminal:
```bash
ngrok http 3000
```

You'll see:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

### 3. Update PUBLIC_URL

Edit `.env`:
```env
PUBLIC_URL=https://abc123.ngrok-free.app
```

### 4. Restart App

```bash
docker-compose restart app
```

Now you can test OAuth with your ngrok URL!

**Note**: Free ngrok URLs change each time. Consider ngrok paid plan for static domains.

## Troubleshooting

### Port Already in Use

Error: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution**:
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change PORT in .env to 3001
```

### Redis Connection Failed

Error: `Redis Client Error` or health check shows `"database": "disconnected"`

**Solutions**:
1. Ensure Redis container is running:
   ```bash
   docker-compose ps
   ```

2. Check Redis logs:
   ```bash
   docker-compose logs redis
   ```

3. Restart Redis:
   ```bash
   docker-compose restart redis
   ```

4. Verify `REDIS_URL=redis://redis:6379` in `.env`

### Build Fails (better-sqlite3)

Error during `npm ci` related to `better-sqlite3`

**Solution**: The Dockerfile installs required build tools (`python3`, `make`, `g++`). If build still fails:

```bash
# Rebuild from scratch
docker-compose build --no-cache app
```

### Changes Not Reflected

Code changes not showing up?

**Solutions**:
1. Ensure you're not editing files inside the container
2. Verify bind mount is working:
   ```bash
   docker-compose exec app ls -la /app
   ```
3. Restart the service:
   ```bash
   docker-compose restart app
   ```

### Container Keeps Restarting

Check logs for errors:
```bash
docker-compose logs app
```

Common causes:
- Missing environment variables
- Invalid `KEYS_JSON` format
- Port conflict
- Application crash on startup

## Switching Between SQLite and Redis

### Use Redis (default in docker-compose.yml)

`.env`:
```env
REDIS_URL=redis://redis:6379
```

### Use SQLite Instead

Comment out `REDIS_URL` in `.env`:
```env
# REDIS_URL=redis://redis:6379
```

Uncomment SQLite volume in `docker-compose.yml`:
```yaml
volumes:
  - ./keys.json:/app/keys.json:ro
  - ./db.sqlite:/app/db.sqlite  # Uncomment this line
```

Restart:
```bash
docker-compose up
```

## Production Parity

This Docker setup mirrors production (Railway) as closely as possible:

| Aspect | Local Docker | Railway Production |
|--------|-------------|-------------------|
| Container | ✅ Docker | ✅ Docker (from same Dockerfile) |
| Storage | ✅ Redis | ✅ Railway Redis |
| HTTPS | ❌ (use ngrok) | ✅ Automatic |
| Environment | ✅ .env file | ✅ Railway env vars |
| Health Checks | ✅ /api/health | ✅ Same endpoint |

## Performance Notes

### Resource Usage

Docker Desktop limits:
- **Default**: 2 CPU cores, 2GB RAM
- **This app**: ~100-200MB RAM

If your machine is slow, adjust Docker Desktop settings:
1. Open Docker Desktop
2. Settings > Resources
3. Increase CPU/Memory allocation

### Build Time

- **First build**: 2-5 minutes (downloads images, installs dependencies)
- **Subsequent builds**: 10-30 seconds (cached layers)
- **Rebuild after package.json change**: 1-2 minutes

## Advanced: Multi-Stage Builds

The current Dockerfile uses a single-stage build. For production optimization, consider multi-stage builds:

```dockerfile
FROM node:20-slim AS builder
# ... build steps

FROM node:20-slim AS production
COPY --from=builder /app/node_modules ./node_modules
# ... production setup
```

This reduces final image size by excluding build tools.

## Cleanup

### Remove Containers

```bash
docker-compose down
```

### Remove Containers + Volumes (Redis data)

```bash
docker-compose down -v
```

### Remove Images

```bash
# List images
docker images | grep atproto

# Remove specific image
docker rmi atproto-oauth-starter-kit-app

# Remove all unused images
docker image prune -a
```

### Full Cleanup

```bash
# Stop and remove everything
docker-compose down -v

# Remove all unused Docker resources
docker system prune -a --volumes
```

## Next Steps

- Deploy to Railway using the [Railway Deployment Guide](./DEPLOYMENT_RAILWAY.md)
- Set up CI/CD with GitHub Actions
- Add integration tests that run in Docker
- Explore Docker Compose profiles for different environments

## Useful Commands Cheat Sheet

```bash
# Start services (build if needed)
docker-compose up --build

# Start in background (detached mode)
docker-compose up -d

# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# View logs (follow mode)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f app

# Execute command in running container
docker-compose exec app sh

# Rebuild specific service
docker-compose build app

# Rebuild without cache
docker-compose build --no-cache

# List running containers
docker-compose ps

# Restart specific service
docker-compose restart app

# Run tests in container
docker-compose exec app npm test

# Access Redis CLI
docker-compose exec redis redis-cli
```

## Support

- Docker Docs: https://docs.docker.com
- Docker Compose Docs: https://docs.docker.com/compose/
- Redis Docs: https://redis.io/docs/
