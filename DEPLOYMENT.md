# PlayChaCha Backend - Render Deployment

## 🚀 One-Click Deployment

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/playchacha/backend)

## 📋 Deployment Steps

### 1. Fork/Clone Repository
```bash
git clone https://github.com/playchacha/backend.git
cd backend
```

### 2. Create PostgreSQL Database

1. Go to [render.com](https://render.com)
2. Click "New" → "PostgreSQL"
3. Configure:
   - **Name**: `playchacha-db`
   - **Plan**: Starter ($7/month) or Free
   - **Region**: Choose closest to your users
4. Copy the "External Database URL"

### 3. Create Redis Instance (Optional)

1. Click "New" → "Redis"
2. Configure:
   - **Name**: `playchacha-redis`
   - **Plan**: Starter ($7/month) or Free
3. Copy the "External Redis URL"

### 4. Deploy Web Service

#### Option A: One-Click Deploy
Click the "Deploy to Render" button above

#### Option B: Manual Deploy
1. Click "New" → "Web Service"
2. Connect GitHub repository
3. Configure:
   - **Name**: `playchacha-backend`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm start`

### 5. Configure Environment Variables

Add these in Render dashboard:

```env
# Database & Cache
DATABASE_URL=<your_postgresql_url>
REDIS_URL=<your_redis_url>

# Server Configuration
NODE_ENV=production
PORT=10000
API_VERSION=v1

# Authentication
JWT_SECRET=<generate_32_character_secret>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<generate_32_character_key>

# Frontend Configuration
FRONTEND_URL=https://playchacha.vercel.app
ALLOWED_ORIGINS=https://playchacha.vercel.app,https://playchacha.net

# Payment Configuration (Optional)
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# Sports Data API (Optional)
SPORTS_API_KEY=your_sports_api_key
SPORTS_API_URL=https://api.sportsdata.io/v3

# Email Configuration (Optional)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@playchacha.net

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Features
ENABLE_LIVE_BETTING=true
ENABLE_CRYPTO_PAYMENTS=true
ENABLE_GEOLOCATION=true
```

### 6. Custom Domain (Optional)

1. Add custom domain in Render: `api.playchacha.net`
2. Configure DNS:
   ```
   Type: CNAME
   Name: api
   Value: playchacha-backend.onrender.com
   ```

## ⚙️ Build Configuration

The project includes optimized Render configuration:

- **Build Command**: `npm run render-build`
- **Start Command**: `npm start`
- **Health Check**: `/health` endpoint
- **Auto-Deploy**: Enabled on main branch
- **Auto-Scaling**: Configured for traffic spikes

## 🌍 Multi-Region Deployment

### Regional Configuration

| Region | Render Location | Target Markets |
|--------|----------------|----------------|
| **North America** | US East (Virginia) | US, Canada, Mexico |
| **Europe** | Europe West (Frankfurt) | EU, UK, Scandinavia |
| **Asia-Pacific** | Asia Southeast (Singapore) | Southeast Asia, Australia |
| **Latin America** | South America (São Paulo) | Brazil, Argentina, Chile |
| **Africa** | Africa South (Cape Town) | South Africa, Nigeria, Kenya |

### Deployment Strategy

1. **Primary Region**: Deploy to closest region to your main user base
2. **Secondary Regions**: Add additional regions as traffic grows
3. **Database Replication**: Use read replicas for global performance
4. **CDN Integration**: Leverage Render's global CDN

## 🔧 Environment Variables Guide

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | JWT signing secret (32+ chars) | `your_super_secure_jwt_secret_here` |
| `FRONTEND_URL` | Frontend application URL | `https://playchacha.vercel.app` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | None (memory cache) |
| `SPORTS_API_KEY` | Sports data API key | Mock data |
| `STRIPE_SECRET_KEY` | Stripe payment key | Disabled |
| `SMTP_PASS` | Email service password | Disabled |

### Security Variables

| Variable | Description | Generation |
|----------|-------------|------------|
| `JWT_SECRET` | JWT token secret | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Data encryption key | `openssl rand -base64 32` |
| `SESSION_SECRET` | Session secret | `openssl rand -base64 32` |

## 📊 Monitoring & Health Checks

### Health Check Endpoint
```bash
curl https://playchacha-backend.onrender.com/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0"
}
```

### Performance Monitoring

Monitor these metrics in Render dashboard:
- **Response Time**: Target <200ms
- **CPU Usage**: Target <70%
- **Memory Usage**: Target <80%
- **Error Rate**: Target <1%

### Logging

View real-time logs:
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Monitor for errors and performance

## 🔒 Security Configuration

### SSL/TLS
- **Automatic SSL**: Enabled by default
- **TLS Version**: 1.3
- **Certificate**: Auto-renewal

### Security Headers
- **Helmet.js**: Comprehensive security headers
- **CORS**: Configured for frontend domains
- **Rate Limiting**: API abuse prevention
- **Input Validation**: All endpoints protected

### Database Security
- **Connection Pooling**: Optimized connections
- **SSL Connections**: Encrypted database traffic
- **Backup**: Automatic daily backups
- **Access Control**: IP-based restrictions

## 🚀 Scaling Configuration

### Auto-Scaling
```yaml
# Render auto-scaling configuration
scaling:
  minInstances: 1
  maxInstances: 10
  targetCPU: 70
  targetMemory: 80
```

### Performance Optimization
- **Connection Pooling**: Database connection optimization
- **Caching**: Redis for session and data caching
- **Compression**: Response compression enabled
- **Keep-Alive**: Persistent HTTP connections

## 🆘 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs in Render dashboard
   # Verify Node.js version (18+)
   # Check package.json dependencies
   ```

2. **Database Connection Issues**
   ```bash
   # Verify DATABASE_URL format
   # Check database status in Render
   # Test connection manually
   ```

3. **Environment Variable Issues**
   ```bash
   # Check all required variables are set
   # Verify variable names (case-sensitive)
   # Redeploy after adding variables
   ```

### Support Resources
- **Render Docs**: [render.com/docs](https://render.com/docs)
- **GitHub Issues**: [github.com/playchacha/backend/issues](https://github.com/playchacha/backend/issues)
- **Email**: support@playchacha.net

## 🎯 Next Steps

1. **Deploy Frontend**: Deploy frontend to Vercel
2. **Connect Services**: Update frontend API URL
3. **Test Integration**: Verify all endpoints work
4. **Monitor Performance**: Set up alerts and monitoring
5. **Scale Globally**: Add additional regions as needed

Your PlayChaCha backend will be live globally in under 10 minutes!

