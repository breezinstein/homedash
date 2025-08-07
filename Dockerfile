# Multi-stage build for smaller final image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY package*.json ./

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S homedash -u 1001

# Set working directory
WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder --chown=homedash:nodejs /app/server/node_modules ./server/node_modules

# Copy source code
COPY --chown=homedash:nodejs . .

# Create data directories with proper permissions
RUN mkdir -p server/data server/data/backups && \
    chown -R homedash:nodejs server/data

# Switch to non-root user for security
USER homedash

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start server with dumb-init
WORKDIR /app/server
CMD ["dumb-init", "npm", "start"]
