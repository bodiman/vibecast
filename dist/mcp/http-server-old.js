import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketTransport, SessionManager } from './http-transport.js';
import { ModelitMCPServer } from './server.js';
export class ModelitHTTPServer {
    constructor(config) {
        this.mcpServerInstances = new Map();
        this.config = config;
        this.app = express();
        this.mcpServer = new ModelitMCPServer(config.storageDirectory);
        this.sessionManager = new SessionManager();
        this.setupMiddleware();
        this.setupRoutes();
        this.server = createServer(this.app);
        this.setupWebSocket();
        // Start session cleanup interval
        setInterval(() => this.sessionManager.cleanup(), 5 * 60 * 1000); // Every 5 minutes
    }
    setupMiddleware() {
        // Enable CORS for all routes
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
        // Parse JSON bodies
        this.app.use(express.json({ limit: '50mb' }));
        // Log requests
        this.app.use((req, _res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                server: 'Modelit MCP Server',
                version: '0.1.0',
                activeSessions: this.sessionManager.getActiveSessions().length
            });
        });
        // MCP endpoint for complete protocol support
        this.app.post('/mcp', async (req, res) => {
            try {
                const message = req.body;
                const sessionId = req.headers['mcp-session-id'];
                console.log(`MCP Request: ${message.method} (Session: ${sessionId || 'new'})`);
                const response = await this.handleMCPRequest(message, sessionId);
                // Add session ID to response headers if available
                if (response.sessionId) {
                    res.setHeader('Mcp-Session-Id', response.sessionId);
                }
                res.json(response.message);
            }
            catch (error) {
                console.error('MCP request error:', error);
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error instanceof Error ? error.message : String(error)
                    },
                    id: req.body?.id || null
                });
            }
        });
        // Server info endpoint
        this.app.get('/info', (_req, res) => {
            res.json({
                name: 'Modelit MCP Server',
                version: '0.1.0',
                description: 'MCP server for transparent, traceable mathematical models',
                protocols: ['http', 'websocket'],
                endpoints: {
                    health: '/health',
                    mcp: '/mcp',
                    websocket: '/ws'
                },
                capabilities: [
                    'Variable management',
                    'Model evaluation',
                    'Dependency analysis',
                    'Time-series modeling'
                ]
            });
        });
        // Serve static documentation
        this.app.get('/', (_req, res) => {
            res.json({
                message: 'Modelit MCP Server is running',
                endpoints: {
                    health: `http://${this.config.host}:${this.config.port}/health`,
                    info: `http://${this.config.host}:${this.config.port}/info`,
                    mcp: `http://${this.config.host}:${this.config.port}/mcp`,
                    websocket: `ws://${this.config.host}:${this.config.port}/ws`
                },
                usage: {
                    'ChatGPT URL': `http://${this.config.host}:${this.config.port}/mcp`,
                    'WebSocket URL': `ws://${this.config.host}:${this.config.port}/ws`
                }
            });
        });
    }
    setupWebSocket() {
        this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
        this.wss.on('connection', async (ws) => {
            console.log('WebSocket client connected');
            try {
                const transport = new WebSocketTransport(ws);
                await this.mcpServer.connect(transport);
                ws.on('close', () => {
                    console.log('WebSocket client disconnected');
                });
            }
            catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close();
            }
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.host, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    console.log(`Modelit MCP HTTP Server running on http://${this.config.host}:${this.config.port}`);
                    console.log(`WebSocket endpoint: ws://${this.config.host}:${this.config.port}/ws`);
                    console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
                    console.log(`MCP endpoint: http://${this.config.host}:${this.config.port}/mcp`);
                    console.log('');
                    console.log('🎯 For ChatGPT integration, use:');
                    console.log(`   URL: http://${this.config.host}:${this.config.port}/mcp`);
                    resolve();
                }
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            this.wss.close(() => {
                this.server.close(() => {
                    console.log('Modelit MCP HTTP Server stopped');
                    resolve();
                });
            });
        });
    }
}
