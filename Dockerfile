# Fly.io Node.js deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code and config
COPY src/ ./src/
COPY tsconfig.json ./

# Install dev dependencies for build
RUN npm ci --silent

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port (Fly.io handles the mapping)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]