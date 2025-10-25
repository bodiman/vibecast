#!/usr/bin/env node

import { ModelitHTTPServer } from './mcp/http-server.js';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  console.log('🚀 Starting Context Marketplace Web Server...');
  
  const defaultStorageDir = join(homedir(), '.modelit', 'models');
  const storageDirectory = process.env.MODELIT_STORAGE_DIR || defaultStorageDir;
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const databaseUrl = process.env.DATABASE_URL;

  console.log(`📁 Storage directory: ${storageDirectory}`);
  console.log(`🗄️  Database URL: ${databaseUrl ? databaseUrl.split('@')[1] : 'None (using file storage)'}`);
  console.log(`🌐 Starting server on ${host}:${port}`);

  const server = new ModelitHTTPServer({
    host,
    port,
    storageDirectory,
    databaseUrl
  });

  await server.start();
  
  console.log('✅ Context Marketplace is ready!');
  console.log(`📊 3D Graph Viewer: http://${host}:${port}/graph`);
  console.log(`🔧 API Documentation: http://${host}:${port}/api`);
  console.log(`💚 Health Check: http://${host}:${port}/api/health`);
}

main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});