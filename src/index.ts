#!/usr/bin/env node

import { ModelitMCPServer } from './mcp/server.js';
import { ModelitHTTPServer } from './mcp/http-server.js';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  // Default storage directory in user's home directory
  const defaultStorageDir = join(homedir(), '.modelit', 'models');
  
  // Get configuration from environment variables
  const storageDirectory = process.env.MODELIT_STORAGE_DIR || defaultStorageDir;
  const transport = process.env.MODELIT_TRANSPORT || 'stdio';
  const port = parseInt(process.env.MODELIT_HTTP_PORT || '3000', 10);
  const host = process.env.MODELIT_HTTP_HOST || 'localhost';
  
  try {
    if (transport === 'http') {
      // Start HTTP server
      const httpServer = new ModelitHTTPServer({
        port,
        host,
        storageDirectory
      });
      
      console.log(`Starting Modelit MCP Server in HTTP mode...`);
      console.log(`Storage directory: ${storageDirectory}`);
      console.log(`Server capabilities: Variable management, Model evaluation, Dependency analysis`);
      console.log('');
      
      await httpServer.start();
    } else {
      // Start stdio server (default)
      const server = new ModelitMCPServer(storageDirectory);
      
      // Log startup info to stderr (won't interfere with MCP protocol on stdout/stdin)
      console.error(`Modelit MCP Server starting in stdio mode...`);
      console.error(`Storage directory: ${storageDirectory}`);
      console.error(`Server capabilities: Variable management, Model evaluation, Dependency analysis`);
      
      await server.run();
    }
  } catch (error) {
    console.error('Failed to start Modelit MCP Server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});