# Production Dockerfile for Backend
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S beyondask -u 1001

# Copy production build
COPY dist/ .

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Set ownership
RUN chown -R beyondask:nodejs /app

# Switch to non-root user
USER beyondask

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Expose port
EXPOSE 5000

# Start application
CMD ["node", "start.mjs"]