#!/usr/bin/env node
import { ModelitHTTPServer } from './mcp/http-server.js';
async function main() {
    console.log('🚀 Starting Context Marketplace Web Server...');
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        console.error('Please set DATABASE_URL to your PostgreSQL connection string');
        process.exit(1);
    }
    console.log(`🗄️  Database: ${databaseUrl.split('@')[1]}`);
    console.log(`🌐 Starting server on ${host}:${port}`);
    const server = new ModelitHTTPServer({
        host,
        port,
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
