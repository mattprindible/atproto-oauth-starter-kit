# Railway.app Deployment Guide

This guide walks you through deploying the ATProto OAuth Starter Kit to Railway.app, a modern Platform-as-a-Service (PaaS) with automatic HTTPS, GitHub integration, and built-in add-ons like Redis.

## Why Railway?

- **Free tier**: $5/month credit (sufficient for small apps)
- **Automatic HTTPS**: No nginx/Certbot configuration needed
- **GitHub integration**: Push to deploy
- **Built-in Redis**: One-click Redis add-on
- **Environment variables**: Easy secrets management
- **Modern PaaS**: Industry-relevant deployment experience

## Prerequisites

1. GitHub account with your code pushed to a repository
2. Railway.app account (sign up at https://railway.app)
3. A custom domain (optional but recommended for production)
   - Alternatively, use Railway's provided domain (e.g., `your-app.up.railway.app`)

## Step 1: Prepare Your Repository

Ensure you have these files committed to your repository:

- ✅ `Dockerfile` - Container configuration
- ✅ `.dockerignore` - Excludes unnecessary files from build
- ✅ `.env.example` - Environment variable template
- ✅ `package.json` - Dependencies and scripts

**Do NOT commit:**
- ❌ `.env` - Contains secrets
- ❌ `keys.json` - Cryptographic keys
- ❌ `db.sqlite` - Local database file

## Step 2: Generate Cryptographic Keys

You'll need to generate keys and inject them as an environment variable.

Run locally:
```bash
npm run generate-keys
```

This creates a `keys.json` file. Copy its contents:

```bash
# macOS/Linux
cat keys.json

# Windows
type keys.json
```

You'll paste this JSON into Railway as the `KEYS_JSON` environment variable later.

**Keep this safe!** If you lose these keys, all users will be logged out.

## Step 3: Create New Project on Railway

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account
4. Select your repository
5. Railway will automatically detect the `Dockerfile` and begin building

## Step 4: Add Redis Database

1. In your Railway project dashboard, click **"+ New"**
2. Select **"Database"**
3. Choose **"Redis"**
4. Railway will automatically:
   - Provision a Redis instance
   - Create a `REDIS_URL` environment variable
   - Link it to your app service

## Step 5: Configure Environment Variables

Click on your app service, then go to the **"Variables"** tab.

Add the following environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `PORT` | `3000` | Railway auto-detects this from Dockerfile |
| `PUBLIC_URL` | `https://your-app.up.railway.app` | Use your Railway domain or custom domain |
| `COOKIE_SECRET` | Generate secure random string | See command below |
| `REDIS_URL` | Auto-set by Railway | Don't modify - Railway manages this |
| `KEYS_JSON` | Paste your `keys.json` contents | Entire JSON object as a string |

### Generate COOKIE_SECRET

Run this locally and copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the result as the `COOKIE_SECRET` value.

### Set KEYS_JSON

Copy the entire contents of your `keys.json` file and paste it as a single-line JSON string:

```json
{"privateJwk":{"kty":"EC","crv":"P-256",...},"publicJwk":{"kty":"EC",...}}
```

**Important**: This must be valid JSON on a single line.

## Step 6: Configure Domain

### Option A: Use Railway Domain (Easiest)

1. Go to **"Settings"** tab in your app service
2. Under **"Domains"**, click **"Generate Domain"**
3. Railway provides a domain like `your-app.up.railway.app`
4. Update `PUBLIC_URL` environment variable to this domain
5. Railway automatically provisions SSL certificate

### Option B: Use Custom Domain

1. Go to **"Settings"** > **"Domains"**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `auth.yourdomain.com`)
4. Railway will show DNS records to add:
   - Add CNAME record pointing to Railway
5. Wait for DNS propagation (5-60 minutes)
6. Railway automatically provisions SSL certificate
7. Update `PUBLIC_URL` environment variable to your custom domain

## Step 7: Deploy

Railway automatically deploys on:
- Initial project creation
- Every git push to your main/master branch
- Environment variable changes (triggers redeploy)

Monitor deployment in the **"Deployments"** tab. You'll see:
- Build logs (Docker build process)
- Deploy logs (container startup)
- Runtime logs (application output)

## Step 8: Verify Deployment

Once deployed, test your application:

1. **Health Check**:
   ```bash
   curl https://your-app.up.railway.app/api/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-01-15T10:30:00.000Z",
     "uptime": 123.45,
     "database": "connected"
   }
   ```

2. **OAuth Metadata**:
   ```bash
   curl https://your-app.up.railway.app/client-metadata.json
   ```

3. **Test Login Flow**:
   - Visit `https://your-app.up.railway.app`
   - Enter your Bluesky handle
   - Complete OAuth flow
   - Verify you can create a post

## Step 9: Backup Your Keys

**Critical**: Store your `KEYS_JSON` value somewhere safe:
- Password manager (1Password, Bitwarden, etc.)
- Encrypted notes
- Secure backup location

If you lose these keys:
- All users will be logged out
- You'll need to generate new keys
- Users will need to re-authenticate

## Monitoring and Logs

### View Logs

In Railway dashboard:
1. Click on your app service
2. Go to **"Deployments"** tab
3. Click on latest deployment
4. View real-time logs

Useful log commands:
```bash
# Health check logs
# Look for "Health check failed" errors

# Redis connection
# Look for "✅ Redis connected successfully"

# OAuth errors
# Look for OAuth-related errors
```

### Monitor Health

Set up external monitoring (optional):
- UptimeRobot (https://uptimerobot.com)
- Ping your `/api/health` endpoint every 5 minutes
- Get alerts if service goes down

## Scaling and Performance

### Current Setup (Free Tier)

- **CPU**: Shared
- **Memory**: 512MB (sufficient for this app)
- **Disk**: Ephemeral (don't store files on disk)
- **Redis**: 25MB storage

### If You Need More Resources

Railway offers paid plans with:
- More CPU/memory
- Larger Redis instances
- Multiple environments (staging/production)

For a single-user learning app, free tier is sufficient.

## Troubleshooting

### Deployment Fails

**Build errors**:
1. Check **"Deployments"** tab > Build logs
2. Common issues:
   - Missing dependencies in `package.json`
   - `better-sqlite3` compilation errors (ensure `python3`, `make`, `g++` in Dockerfile)

**Runtime errors**:
1. Check **"Deployments"** tab > Deploy logs
2. Common issues:
   - Missing environment variables
   - Invalid `KEYS_JSON` format
   - Redis connection issues

### Redis Connection Fails

1. Verify Redis service is running (should show green dot)
2. Check `REDIS_URL` is set correctly
3. Ensure Redis and app are in the same Railway project
4. Restart both services

### OAuth Callback Fails

1. Verify `PUBLIC_URL` matches your actual domain
2. Ensure HTTPS is enabled (Railway auto-provides this)
3. Check domain is accessible from internet
4. Test `/client-metadata.json` endpoint

### Health Check Fails

Visit `/api/health` and check response:

```json
{
  "status": "degraded",
  "database": "disconnected"
}
```

This indicates Redis connection issue. Check logs for Redis errors.

## Updating Your Deployment

### Deploy New Code

```bash
git add .
git commit -m "Add new feature"
git push origin main
```

Railway automatically detects the push and deploys.

### Update Environment Variables

1. Go to **"Variables"** tab
2. Modify variables
3. Railway automatically redeploys

### Rotate Keys (Advanced)

If you need to rotate cryptographic keys:

1. Generate new keys locally: `npm run generate-keys`
2. Update `KEYS_JSON` in Railway
3. Railway redeploys
4. **All users will be logged out**
5. Users must re-authenticate

## Cost Breakdown

Railway free tier includes:
- $5/month credit
- Estimated usage for this app:
  - App service: ~$2-3/month
  - Redis: ~$0.50/month
  - **Total**: ~$2.50-3.50/month (within free tier)

Usage depends on:
- Number of requests
- Redis data size
- Uptime (apps sleep after inactivity on free tier)

## Next Steps

- Set up monitoring (UptimeRobot)
- Configure custom domain
- Test OAuth flow thoroughly
- Set up staging environment (create second Railway project)
- Add logging/error tracking (Sentry, LogRocket)

## Alternative PaaS Options

If Railway doesn't meet your needs, consider:

- **Render.com**: Free tier with automatic sleep
- **Fly.io**: 3 free VMs, Dockerfile-based
- **Heroku**: Classic PaaS (more expensive)
- **Google Cloud Run**: Pay-per-use serverless containers

## Support Resources

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app
- This repo's issues: Create an issue if you encounter problems

---

**Deployment checklist:**
- [ ] Code pushed to GitHub
- [ ] `keys.json` generated and saved securely
- [ ] Railway project created from GitHub repo
- [ ] Redis database added
- [ ] Environment variables configured (PUBLIC_URL, COOKIE_SECRET, KEYS_JSON)
- [ ] Domain configured (Railway or custom)
- [ ] Deployment successful (green checkmark)
- [ ] Health check passing (`/api/health` returns 200)
- [ ] OAuth flow tested end-to-end
- [ ] Keys backed up securely
