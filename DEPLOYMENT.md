# Railway Deployment Guide

## Quick Deploy to Railway

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Deploy from your project directory**:
   ```bash
   railway deploy
   ```

## Manual Deployment via Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Railway will automatically detect the `Procfile` and deploy

## Environment Variables

The following environment variables can be configured in Railway:

- `PORT` - Server port (Railway sets this automatically)
- `MODELIT_STORAGE_DIR` - Storage directory for models (defaults to `./models`)

## API Endpoints

Once deployed, your server will be available at:

- `GET /api/health` - Health check
- `GET /api/tools` - List available tools
- `POST /api/tools/:toolName` - Execute a tool

## Example Usage

```bash
# Health check
curl https://your-app.railway.app/api/health

# List available tools
curl https://your-app.railway.app/api/tools

# Create a model
curl -X POST https://your-app.railway.app/api/tools/create_model \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Model", "description": "A test model"}'

# List models
curl -X POST https://your-app.railway.app/api/tools/list_models \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Local Development

```bash
# Install dependencies
npm install

# Run HTTP server locally
npm run dev:http

# Build and run
npm run build
npm run start:http
```

## Troubleshooting

- Check Railway logs: `railway logs`
- Verify health endpoint: `curl https://your-app.railway.app/api/health`
- Ensure all dependencies are in `package.json`
