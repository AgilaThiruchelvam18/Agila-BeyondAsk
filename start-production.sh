#!/bin/bash

echo "===== BEYONDASK PRODUCTION STARTUP ====="
echo "Starting BeyondAsk in production mode..."
echo "Date/Time: $(date)"
echo "========================================"

# Set environment variables
export PORT=5000
export NODE_ENV=production
# Remove FORCE_VITE to allow proper production static serving

# Build if needed
if [ ! -d "dist" ] || [ ! -f "dist/public/index.html" ]; then
  echo "Build directory not found. Running build process..."
  node build.js
else
  echo "Build directory exists. Skipping build step."
fi

# Start server directly
echo "Starting server..."
if [ -f "dist/index.js" ]; then
  echo "Using built server..."
  NODE_ENV=production PORT=5000 node dist/index.js
else
  echo "Using TypeScript server..."
  NODE_ENV=production PORT=5000 npx tsx server/index.ts
fi