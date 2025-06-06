#!/bin/bash

# Render Build Script for PlayChaCha Backend
# This script runs during the build phase on Render

set -e

echo "🚀 Starting PlayChaCha Backend Build Process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p temp

# Set proper permissions
echo "🔒 Setting permissions..."
chmod 755 logs
chmod 755 uploads
chmod 755 temp

# Run database migrations if DATABASE_URL is available
if [ ! -z "$DATABASE_URL" ]; then
    echo "🗄️ Running database migrations..."
    npm run migrate || echo "⚠️ Migration failed or no migrations to run"
else
    echo "⚠️ DATABASE_URL not found, skipping migrations"
fi

# Generate any necessary static files
echo "📄 Generating static files..."
# Add any static file generation here if needed

# Verify critical environment variables
echo "🔍 Verifying environment variables..."
if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET is required"
    exit 1
fi

if [ -z "$FRONTEND_URL" ]; then
    echo "❌ FRONTEND_URL is required"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "🎯 Ready for deployment on Render"

