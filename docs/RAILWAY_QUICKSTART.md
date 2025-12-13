# Railway Quickstart (5 minutes)

This is the TL;DR version. See [DEPLOYMENT_RAILWAY.md](./DEPLOYMENT_RAILWAY.md) for the full guide.

## Prerequisites

- [ ] Code pushed to GitHub
- [ ] Railway.app account (free): https://railway.app/login
- [ ] Your `keys.json` file contents ready to copy

## Step-by-Step Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "Add Docker deployment configuration"
git push origin main
```

### 2. Create Railway Project

1. Go to https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Authorize Railway to access GitHub
4. Select your `atproto-oauth-starter-kit` repository
5. Railway auto-detects Dockerfile and starts building

### 3. Add Redis Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Redis"**
3. Railway auto-creates `REDIS_URL` environment variable

### 4. Configure Environment Variables

Click your app service → **"Variables"** tab

Add these variables:

| Variable | Value |
|----------|-------|
| `PUBLIC_URL` | (Leave blank for now, we'll add this after step 5) |
| `COOKIE_SECRET` | Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `KEYS_JSON` | Copy your entire `keys.json` file as a single-line JSON string |

**KEYS_JSON example:**
```json
{"privateJwk":{"kty":"EC","crv":"P-256",...},"publicJwk":{"kty":"EC",...}}
```

**Note**: `REDIS_URL` is automatically set by Railway when you add Redis - don't modify it!

### 5. Get Your Railway Domain

1. Go to **"Settings"** tab in your app service
2. Under **"Networking"** → **"Public Networking"**, click **"Generate Domain"**
3. Railway gives you a domain like: `your-app-name.up.railway.app`
4. Copy this domain

### 6. Set PUBLIC_URL

1. Go back to **"Variables"** tab
2. Set `PUBLIC_URL` to your Railway domain (include `https://`):
   ```
   PUBLIC_URL=https://your-app-name.up.railway.app
   ```
3. This triggers a redeploy

### 7. Verify Deployment

Wait for deployment to finish (check **"Deployments"** tab for green checkmark)

Then test:

```bash
# Health check
curl https://your-app-name.up.railway.app/api/health

# Should return:
# {"status":"healthy","timestamp":"...","uptime":123,"database":"connected"}
```

### 8. Test OAuth Flow

1. Open `https://your-app-name.up.railway.app` in browser
2. Enter your Bluesky handle
3. Complete OAuth login
4. Try creating a post!

## Troubleshooting

**Deployment fails:**
- Check **"Deployments"** tab → Click deployment → View logs
- Common issue: Missing environment variables

**Health check returns "degraded":**
- Redis not connected
- Check Redis service is running (green dot)
- Verify `REDIS_URL` is set automatically

**OAuth callback fails:**
- Verify `PUBLIC_URL` exactly matches your Railway domain
- Must use `https://` (not `http://`)
- No trailing slash

## Cost

Railway free tier: **$5/month credit**

Your app usage: **~$2.50-3.50/month** (within free tier)

Includes:
- App service
- Redis database
- Automatic HTTPS
- Unlimited deployments

## Next Steps

- Set up custom domain (optional): **Settings** → **"Networking"** → **"Custom Domain"**
- Monitor logs: **Deployments** tab → Click deployment
- Update code: Just `git push` - Railway auto-deploys
- Add CI/CD: Create `.github/workflows/deploy.yml` for automated testing before deployment

---

**Full documentation:** See [DEPLOYMENT_RAILWAY.md](./DEPLOYMENT_RAILWAY.md) for detailed explanations, monitoring setup, and advanced configuration.
