#!/usr/bin/env node
import { ModelitMCPServer } from './mcp/server.js';
import { ModelitHTTPServer } from './mcp/http-server.js';
async function main() {
    // Default storage directory in user's home directory
    // Get configuration from environment variables
    const transport = process.env.MODELIT_TRANSPORT || 'stdio';
    const port = parseInt(process.env.PORT || process.env.MODELIT_HTTP_PORT || '3000', 10);
    const host = process.env.MODELIT_HTTP_HOST || '0.0.0.0';
    const databaseUrl = process.env.DATABASE_URL;
    try {
        if (transport === 'http') {
            // Start HTTP server
            const httpServer = new ModelitHTTPServer({
                port,
                host,
                databaseUrl
            });
            console.error(`Starting Modelit MCP Server in HTTP mode...`);
            console.error(`Database: ${databaseUrl ? 'PostgreSQL' : 'File Storage'}`);
            console.error(`Server capabilities: Variable management, Model evaluation, Dependency analysis, 3D Graph Visualization`);
            console.error('');
            await httpServer.start();
        }
        else {
            // Start stdio server (default)
            const server = new ModelitMCPServer(databaseUrl);
            // Initialize database connection if available
            await server.initialize();
            // Log startup info to stderr (won't interfere with MCP protocol on stdout/stdin)
            console.error(`Modelit MCP Server starting in stdio mode...`);
            console.error(`Database: ${databaseUrl ? 'PostgreSQL' : 'File Storage'}`);
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
