# Render Deployment Configuration

## Build Settings
- **Build Command**: `npm run render-build`
- **Start Command**: `npm start`
- **Node Version**: 18.x
- **Environment**: Node.js

## Auto-Deploy
- **Branch**: main
- **Auto-Deploy**: Yes

## Health Check
- **Health Check Path**: /health
- **Health Check Timeout**: 30 seconds

## Scaling
- **Instance Type**: Standard
- **Auto-Scaling**: Enabled
- **Min Instances**: 1
- **Max Instances**: 10

## Environment Variables
Copy from .env.example and configure:

### Required Variables
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- STRIPE_SECRET_KEY
- FRONTEND_URL

### Optional Variables
- SPORTS_API_KEY
- SMTP_PASS
- GOOGLE_MAPS_API_KEY

## Database Setup
1. Create PostgreSQL database in Render
2. Copy DATABASE_URL to environment variables
3. Run migrations automatically on deploy

## Redis Setup
1. Create Redis instance in Render
2. Copy REDIS_URL to environment variables
3. Configure for session storage and caching

## Custom Domain
1. Add custom domain in Render dashboard
2. Configure DNS records:
   - CNAME: api.playchacha.net -> your-app.onrender.com
3. SSL certificate will be automatically provisioned

