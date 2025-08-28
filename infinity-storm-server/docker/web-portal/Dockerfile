# Web Portal Dockerfile
# This serves the authentication frontend and game launcher
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S portal -u 1001

# Copy package files first for better caching
COPY web-portal/package*.json ./web-portal/
WORKDIR /app/web-portal
RUN npm ci --only=production

# Copy web portal source code
COPY web-portal/ .

# Set ownership and permissions
RUN chown -R portal:nodejs /app
USER portal

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the web portal
CMD ["npm", "start"]