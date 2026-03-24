# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for signal handling and su-exec for privilege dropping
RUN apk add --no-cache dumb-init su-exec

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S homedash -u 1001

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js ./

# Create data directories (including icons cache) with proper permissions.
# The entrypoint script re-applies ownership at runtime to handle cases where
# the named volume was created before these chown rules existed.
RUN mkdir -p data/uploads data/backups data/icons && \
    chown -R homedash:nodejs /app

# Copy entrypoint script that fixes volume/bind-mount permissions at startup
# then drops privileges to the homedash user.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# NOTE: USER is intentionally omitted here — the entrypoint runs as root
# only long enough to fix directory ownership, then exec's as homedash.

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/config/check || exit 1

# Entrypoint fixes permissions and drops to homedash via su-exec.
ENTRYPOINT ["/entrypoint.sh"]

# Start the server (passed as "$@" to entrypoint).
CMD ["node", "server.js"]
