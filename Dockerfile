# Use Node.js 18 LTS as base image
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S playchacha -u 1001

# Copy application code
COPY --chown=playchacha:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown playchacha:nodejs logs

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER playchacha

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "src/server.js"]

# Multi-stage build for smaller production image
FROM node:18-alpine AS final

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S playchacha -u 1001

# Copy built application from production stage
COPY --from=production --chown=playchacha:nodejs /app .

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER playchacha

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/server.js"]

