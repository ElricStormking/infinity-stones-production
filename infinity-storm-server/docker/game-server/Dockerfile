# Game Server Dockerfile  
# This serves the game client and handles all game logic APIs
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gameserver -u 1001

# Copy package files first for better caching
COPY infinity-storm-server/package*.json ./
RUN npm ci --only=production

# Copy game server source code and client assets
COPY infinity-storm-server/ .
COPY src/ ./client/src/
COPY assets/ ./client/assets/
COPY index.html ./client/
COPY *.js ./client/

# Set ownership and permissions
RUN chown -R gameserver:nodejs /app
USER gameserver

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the game server
CMD ["npm", "start"]