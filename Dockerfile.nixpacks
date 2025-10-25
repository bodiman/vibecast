# Simulate Railway's Nixpacks build process
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and config
COPY src/ ./src/
COPY tsconfig.json ./

# Build the TypeScript project (this is what Railway does)
RUN npm run build

# Start the server
CMD ["node", "dist/http-server.js"]