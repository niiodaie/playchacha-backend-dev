FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache python3 make g++ curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (works with or without package-lock.json)
RUN npm install --production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S playchacha -u 1001 && \
    chown -R playchacha:nodejs /app

# Switch to non-root user
USER playchacha

# Expose port
EXPOSE 10000

# Start application
CMD ["node", "src/server.js"]
