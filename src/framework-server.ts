#!/usr/bin/env node
/**
 * Framework Server - Entry point
 */

import 'dotenv/config';
import { FrameworkServer } from './server/FrameworkServer.js';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

const server = new FrameworkServer({ port: PORT, host: HOST });

// Start server
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n👋 Shutting down gracefully...');
  await server.stop();
  process.exit(0);
});
