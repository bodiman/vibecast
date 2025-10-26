#!/usr/bin/env node
import { ModelitMCPServer } from './mcp/server.js';
import { ModelitHTTPServer } from './mcp/http-server.js';
async function main() {
    // Get configuration from environment variables
    const transport = process.env.MODELIT_TRANSPORT || 'stdio';
    const port = parseInt(process.env.PORT || process.env.MODELIT_HTTP_PORT || '3000', 10);
    const host = process.env.MODELIT_HTTP_HOST || '0.0.0.0';
    const databaseUrl = process.env.DATABASE_URL;
    // Require database URL
    if (!databaseUrl) {
        console.error('❌ DATABASE_URL environment variable is required');
        console.error('Please set DATABASE_URL to your PostgreSQL connection string');
        process.exit(1);
    }
    try {
        if (transport === 'http') {
            // Start HTTP server
            const httpServer = new ModelitHTTPServer({
                port,
                host,
                databaseUrl
            });
            console.log(`Starting Modelit MCP Server in HTTP mode...`);
            console.log(`Database: ${databaseUrl.split('@')[1]}`);
            console.log(`Server capabilities: Variable management, Model evaluation, Dependency analysis, 3D Graph Visualization`);
            console.log('');
            await httpServer.start();
        }
        else {
            // Start stdio server (default)
            const server = new ModelitMCPServer(databaseUrl);
            // Initialize database connection
            await server.initialize();
            // Log startup info to stderr (won't interfere with MCP protocol on stdout/stdin)
            console.error(`Modelit MCP Server starting in stdio mode...`);
            console.error(`Database: ${databaseUrl.split('@')[1]}`);
            console.error(`Server capabilities: Variable management, Model evaluation, Dependency analysis, 3D Graph Visualization`);
            await server.run();
        }
    }
    catch (error) {
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
