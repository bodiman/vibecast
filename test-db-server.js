#!/usr/bin/env node

import { ModelitHTTPServer } from './dist/mcp/http-server.js';
import { join } from 'path';
import { homedir } from 'os';

const defaultStorageDir = join(homedir(), '.modelit', 'models');
const storageDirectory = process.env.MODELIT_STORAGE_DIR || defaultStorageDir;
const databaseUrl = process.env.DATABASE_URL;

console.log('Starting Modelit MCP HTTP Server with database support...');
console.log('Database URL:', databaseUrl ? 'configured' : 'not configured');
console.log('DATABASE_URL env var:', process.env.DATABASE_URL ? 'set' : 'not set');
console.log('Storage directory:', storageDirectory);

const server = new ModelitHTTPServer({
  port: 3000,
  host: '0.0.0.0',
  storageDirectory,
  databaseUrl
});

server.start().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await server.stop();
  process.exit(0);
});
