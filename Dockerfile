# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
COPY package*.json ./

# Install server dependencies
WORKDIR /app/server
RUN npm ci --only=production

# Copy source code
WORKDIR /app
COPY . .

# Create data directories
RUN mkdir -p server/data server/data/backups

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Switch to non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S homedash -u 1001
RUN chown -R homedash:nodejs /app
USER homedash

# Start server
WORKDIR /app/server
CMD ["npm", "start"]
