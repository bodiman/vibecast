import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { WebSocketTransport, SessionManager, SessionState } from './http-transport.js';
import { ModelitMCPServer } from './server.js';
export class ModelitHTTPServer {
    constructor(config) {
        this.config = config;
        this.app = express();
        this.sessionManager = new SessionManager();
        this.mcpServer = new ModelitMCPServer(config.storageDirectory, config.databaseUrl);
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
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Mcp-Session-Id');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
        // Parse JSON bodies
        this.app.use(express.json({ limit: '50mb' }));
        // Log requests with more detail
        this.app.use((req, _res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            if (req.path === '/mcp') {
                console.log('Headers:', JSON.stringify(req.headers, null, 2));
                console.log('Body:', JSON.stringify(req.body, null, 2));
            }
            next();
        });
    }
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (_, res) => res.send('OK'));
        // MCP endpoint for complete protocol support
        this.app.post('/mcp', async (req, res) => {
            try {
                const message = req.body;
                const sessionId = req.headers['mcp-session-id'];
                console.log(`MCP Request: ${message.method} (Session: ${sessionId || 'new'})`);
                const response = await this.handleMCPRequest(message, sessionId, !!sessionId);
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
        // Session management endpoint
        this.app.get('/sessions', (_req, res) => {
            res.json({
                activeSessions: this.sessionManager.getActiveSessions().map(s => ({
                    id: s.id,
                    state: s.state,
                    createdAt: s.createdAt,
                    lastActivity: s.lastActivity
                }))
            });
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
                    websocket: '/ws',
                    sessions: '/sessions',
                    api: '/api',
                    graph: '/graph'
                },
                capabilities: [
                    'Variable management',
                    'Model evaluation',
                    'Dependency analysis',
                    'Time-series modeling',
                    '3D Graph visualization',
                    'Database storage'
                ]
            });
        });
        // ChatGPT Action endpoints
        this.app.get('/.well-known/ai-plugin.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.json({
                schema_version: "v1",
                name_for_human: "Modelit Mathematical Models",
                name_for_model: "modelit",
                description_for_human: "Create, manage, and evaluate mathematical models with automatic dependency tracking and 3D visualization.",
                description_for_model: "A tool for creating and managing mathematical models. You can create models, add variables with formulas, evaluate them, and visualize the dependency graphs. Variables can reference other variables in their formulas, and the system automatically creates dependency edges.",
                auth: {
                    type: "none"
                },
                api: {
                    type: "openapi",
                    url: `https://${req.get('host')}/openapi-simple.json`,
                    has_user_authentication: false
                },
                logo_url: `https://${req.get('host')}/logo.png`,
                contact_email: "support@modelit.com",
                legal_info_url: `https://${req.get('host')}/legal`
            });
        });
        // Simplified OpenAPI spec for ChatGPT Actions
        this.app.get('/openapi-simple.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.json({
                openapi: "3.0.1",
                info: {
                    title: "Modelit Mathematical Models API",
                    version: "1.0.0",
                    description: "API for creating, managing, and evaluating mathematical models"
                },
                servers: [
                    {
                        url: `https://${req.get('host')}`
                    }
                ],
                paths: {
                    "/mcp": {
                        post: {
                            summary: "Execute MCP command",
                            description: "Execute a Model Context Protocol command",
                            requestBody: {
                                required: true,
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                jsonrpc: { type: "string", enum: ["2.0"] },
                                                id: { type: ["string", "number"] },
                                                method: { type: "string" },
                                                params: { type: "object" }
                                            },
                                            required: ["jsonrpc", "id", "method"]
                                        }
                                    }
                                }
                            },
                            responses: {
                                "200": {
                                    description: "MCP response",
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object",
                                                properties: {
                                                    jsonrpc: { type: "string" },
                                                    id: { type: ["string", "number"] },
                                                    result: { type: "object" },
                                                    error: { type: "object" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
        this.app.get('/openapi.json', (req, res) => {
            res.json({
                openapi: "3.0.1",
                info: {
                    title: "Modelit Mathematical Models API",
                    version: "1.0.0",
                    description: "API for creating, managing, and evaluating mathematical models with automatic dependency tracking"
                },
                servers: [
                    {
                        url: `https://${req.get('host')}`
                    }
                ],
                paths: {
                    "/mcp": {
                        post: {
                            summary: "MCP Protocol Endpoint",
                            description: "Main endpoint for Model Context Protocol communication. Use this for all model operations.",
                            requestBody: {
                                required: true,
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                            properties: {
                                                jsonrpc: { type: "string", enum: ["2.0"] },
                                                id: { type: ["string", "number"] },
                                                method: { type: "string" },
                                                params: { type: "object" }
                                            },
                                            required: ["jsonrpc", "id", "method"]
                                        }
                                    }
                                }
                            },
                            responses: {
                                "200": {
                                    description: "MCP response",
                                    content: {
                                        "application/json": {
                                            schema: {
                                                type: "object",
                                                properties: {
                                                    jsonrpc: { type: "string" },
                                                    id: { type: ["string", "number"] },
                                                    result: { type: "object" },
                                                    error: { type: "object" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        });
        // REST API endpoints for graph data
        this.setupAPIRoutes();
        // Serve React app for 3D graph visualization
        this.setupGraphViewer();
    }
    async handleMCPRequest(message, sessionId, hadSessionId) {
        try {
            // Handle initialize method specially
            if (message.method === 'initialize') {
                return await this.handleInitialize(message);
            }
            // For other methods, create a session if none exists
            let session;
            if (!sessionId) {
                // Create a temporary session for stateless operation
                session = this.sessionManager.createSession();
                session.state = SessionState.Ready;
                session.clientInfo = { name: 'stateless-client', version: '1.0.0' };
                sessionId = session.id;
            }
            else {
                session = this.sessionManager.getSession(sessionId);
                if (!session) {
                    return {
                        message: {
                            jsonrpc: '2.0',
                            error: {
                                code: -32602,
                                message: 'Invalid session',
                                data: 'Session not found or expired'
                            },
                            id: message.id
                        }
                    };
                }
                if (session.state !== SessionState.Ready) {
                    return {
                        message: {
                            jsonrpc: '2.0',
                            error: {
                                code: -32602,
                                message: 'Session not ready',
                                data: 'Session must be initialized before making requests'
                            },
                            id: message.id
                        }
                    };
                }
            }
            // Route the request based on method
            const result = await this.routeMCPMethod(message, sessionId);
            // If we created a new session, include it in the response
            if (!hadSessionId) {
                result.sessionId = sessionId;
            }
            return result;
        }
        catch (error) {
            console.error('MCP request handling error:', error);
            return {
                message: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal error',
                        data: error instanceof Error ? error.message : String(error)
                    },
                    id: message.id
                }
            };
        }
    }
    async routeMCPMethod(message, sessionId) {
        switch (message.method) {
            case 'list_tools':
                return {
                    message: {
                        jsonrpc: '2.0',
                        result: {
                            tools: [
                                {
                                    name: 'create_model',
                                    description: 'Create a new mathematical model',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Model name' },
                                            description: { type: 'string', description: 'Model description' }
                                        },
                                        required: ['name']
                                    }
                                },
                                {
                                    name: 'load_model',
                                    description: 'Load an existing model from storage',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Model name to load' }
                                        },
                                        required: ['name']
                                    }
                                },
                                {
                                    name: 'save_model',
                                    description: 'Save the current model to storage',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Model name (optional)' }
                                        }
                                    }
                                },
                                {
                                    name: 'list_models',
                                    description: 'List all available models in storage',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {}
                                    }
                                },
                                {
                                    name: 'create_variable',
                                    description: 'Add a new variable to the current model',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Variable name' },
                                            formula: { type: 'string', description: 'Mathematical formula (optional)' },
                                            type: { type: 'string', enum: ['scalar', 'series', 'parameter'], description: 'Variable type' },
                                            values: { type: 'array', items: { type: 'number' }, description: 'Initial values (optional)' }
                                        },
                                        required: ['name']
                                    }
                                },
                                {
                                    name: 'evaluate_model',
                                    description: 'Evaluate the current model for specified time steps',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {
                                            timeSteps: { type: 'number', description: 'Number of time steps to evaluate', minimum: 1 }
                                        },
                                        required: ['timeSteps']
                                    }
                                },
                                {
                                    name: 'list_variables',
                                    description: 'List all variables in the current model',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {}
                                    }
                                },
                                {
                                    name: 'validate_model',
                                    description: 'Validate the current model for errors and circular dependencies',
                                    inputSchema: {
                                        type: 'object',
                                        properties: {}
                                    }
                                }
                            ]
                        },
                        id: message.id
                    },
                    sessionId
                };
            case 'call_tool':
                const params = message.params;
                const { name, arguments: args } = params;
                // Route to the actual MCP server tool handlers
                try {
                    let result;
                    switch (name) {
                        case 'create_model':
                            result = await this.mcpServer['handleCreateModel'](args);
                            break;
                        case 'load_model':
                            result = await this.mcpServer['handleLoadModel'](args);
                            break;
                        case 'save_model':
                            result = await this.mcpServer['handleSaveModel'](args);
                            break;
                        case 'list_models':
                            result = await this.mcpServer['handleListModels']();
                            break;
                        case 'create_variable':
                            result = await this.mcpServer['handleCreateVariable'](args);
                            break;
                        case 'update_variable':
                            result = await this.mcpServer['handleUpdateVariable'](args);
                            break;
                        case 'list_variables':
                            result = await this.mcpServer['handleListVariables']();
                            break;
                        case 'get_variable':
                            result = await this.mcpServer['handleGetVariable'](args);
                            break;
                        case 'evaluate_model':
                            result = await this.mcpServer['handleEvaluateModel'](args);
                            break;
                        case 'evaluate_variable':
                            result = await this.mcpServer['handleEvaluateVariable'](args);
                            break;
                        case 'get_dependencies':
                            result = await this.mcpServer['handleGetDependencies'](args);
                            break;
                        case 'get_graph':
                            result = await this.mcpServer['handleGetGraph']();
                            break;
                        case 'validate_model':
                            result = await this.mcpServer['handleValidateModel']();
                            break;
                        case 'create_edge':
                            result = await this.mcpServer['handleCreateEdge'](args);
                            break;
                        case 'search_marketplace':
                            result = await this.mcpServer['handleSearchMarketplace'](args);
                            break;
                        case 'publish_model':
                            result = await this.mcpServer['handlePublishModel'](args);
                            break;
                        case 'import_model':
                            result = await this.mcpServer['handleImportModel'](args);
                            break;
                        case 'get_graph_stats':
                            result = await this.mcpServer['handleGetGraphStats']();
                            break;
                        case 'get_graph_data':
                            result = await this.mcpServer['handleGetGraphData'](args);
                            break;
                        case 'save_graph_layout':
                            result = await this.mcpServer['handleSaveGraphLayout'](args);
                            break;
                        case 'query_models':
                            result = await this.mcpServer['handleQueryModels'](args);
                            break;
                        case 'create_model_version':
                            result = await this.mcpServer['handleCreateModelVersion'](args);
                            break;
                        default:
                            return {
                                message: {
                                    jsonrpc: '2.0',
                                    error: {
                                        code: -32601,
                                        message: 'Method not found',
                                        data: `Unknown tool: ${name}`
                                    },
                                    id: message.id
                                },
                                sessionId
                            };
                    }
                    return {
                        message: {
                            jsonrpc: '2.0',
                            result,
                            id: message.id
                        },
                        sessionId
                    };
                }
                catch (error) {
                    return {
                        message: {
                            jsonrpc: '2.0',
                            error: {
                                code: -32603,
                                message: 'Internal error',
                                data: error instanceof Error ? error.message : String(error)
                            },
                            id: message.id
                        },
                        sessionId
                    };
                }
            default:
                return {
                    message: {
                        jsonrpc: '2.0',
                        error: {
                            code: -32601,
                            message: 'Method not found',
                            data: `Unknown method: ${message.method}`
                        },
                        id: message.id
                    },
                    sessionId
                };
        }
    }
    async handleInitialize(message) {
        const params = message.params || {};
        // Create new session
        const session = this.sessionManager.createSession();
        session.state = SessionState.Initializing;
        session.clientInfo = params.clientInfo || {};
        // Validate protocol version
        const clientProtocolVersion = params.protocolVersion || '2024-05-01';
        const supportedVersion = '2024-05-01';
        if (clientProtocolVersion !== supportedVersion) {
            this.sessionManager.deleteSession(session.id);
            return {
                message: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32602,
                        message: 'Unsupported protocol version',
                        data: `Server supports ${supportedVersion}, client requested ${clientProtocolVersion}`
                    },
                    id: message.id
                },
                sessionId: session.id
            };
        }
        // Set session as ready
        const serverInfo = {
            name: 'Modelit MCP Server',
            version: '0.1.0'
        };
        const capabilities = {
            tools: {
                listChanged: true
            },
            resources: {},
            prompts: {},
            logging: {}
        };
        session.state = SessionState.Ready;
        session.serverInfo = serverInfo;
        session.capabilities = capabilities;
        this.sessionManager.updateSession(session.id, session);
        console.log(`Session ${session.id} initialized successfully`);
        return {
            message: {
                jsonrpc: '2.0',
                result: {
                    protocolVersion: supportedVersion,
                    capabilities,
                    serverInfo
                },
                id: message.id
            },
            sessionId: session.id
        };
    }
    setupWebSocket() {
        this.wss = new WebSocketServer({ server: this.server });
        this.wss.on('connection', (ws) => {
            console.log('WebSocket connection established');
            const transport = new WebSocketTransport(ws);
            // Create a new MCP server instance for this WebSocket connection
            const server = new ModelitMCPServer();
            server.connect(transport);
        });
    }
    setupAPIRoutes() {
        // API routes for graph data
        this.app.get('/api/models', async (req, res) => {
            try {
                const models = await this.mcpServer['getStorage']().listModels();
                res.json({ models });
            }
            catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        this.app.get('/api/models/:modelName/graph', async (req, res) => {
            try {
                const { modelName } = req.params;
                // Use database storage if available, otherwise fall back to file storage
                if (this.mcpServer['useDatabase']) {
                    const graphData = await this.mcpServer['dbStorage'].getGraphData(modelName);
                    res.json(graphData);
                }
                else {
                    // Load model and convert to graph format
                    const model = await this.mcpServer['getStorage']().loadModel(modelName);
                    const nodes = model.listVariables().map(v => ({
                        id: v.name,
                        name: v.name,
                        type: v.type,
                        values: v.values,
                        metadata: v.metadata
                    }));
                    const edges = model.listEdges().map(e => ({
                        id: `${e.source}-${e.target}`,
                        source: e.source,
                        target: e.target,
                        type: e.type,
                        metadata: e.metadata
                    }));
                    res.json({ nodes, edges });
                }
            }
            catch (error) {
                res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        this.app.post('/api/models/:modelName/layout', async (req, res) => {
            try {
                const { modelName } = req.params;
                const { nodePositions } = req.body;
                if (this.mcpServer['useDatabase']) {
                    await this.mcpServer['dbStorage'].saveGraphLayout(modelName, nodePositions);
                    res.json({ success: true });
                }
                else {
                    res.status(501).json({ error: 'Layout saving requires database storage' });
                }
            }
            catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
        // Advanced queries
        this.app.post('/api/query', async (req, res) => {
            try {
                if (this.mcpServer['useDatabase']) {
                    const marketplace = this.mcpServer['marketplace'];
                    const results = await marketplace.searchModels(req.body);
                    res.json(results);
                }
                else {
                    const models = await this.mcpServer['getStorage']().listModels();
                    res.json({ models, total: models.length, hasMore: false });
                }
            }
            catch (error) {
                res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
            }
        });
    }
    setupGraphViewer() {
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const frontendDistPath = path.join(__dirname, '../../frontend/dist');
        const isDevelopment = process.env.NODE_ENV === 'development' || process.env.FRONTEND_DEV === 'true';
        if (isDevelopment) {
            console.log('🔧 Development mode: Frontend will be served from Vite dev server');
            console.log('📱 Make sure to run: npm run dev:frontend');
            console.log('🌐 Frontend URL: http://localhost:5173');
            // In development, just show a redirect page
            this.app.get('/graph', (req, res) => {
                res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Marketplace - Development</title>
    <style>
        body {
            margin: 0;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: white;
            text-align: center;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        .card {
            background: #1a1a1a;
            border-radius: 8px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .button {
            display: inline-block;
            background: #007acc;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            margin: 10px;
            transition: background 0.2s;
        }
        .button:hover {
            background: #005a9e;
        }
        .dev-info {
            background: #1e3a8a;
            border: 1px solid #3b82f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 Context Marketplace</h1>
        <h2>Development Mode</h2>
        
        <div class="dev-info">
            <h3>🚀 Frontend Development Server</h3>
            <p>For the best development experience with hot reloading:</p>
            <a href="http://localhost:5173" class="button">Open Frontend (localhost:5173)</a>
        </div>
        
        <div class="card">
            <h3>Backend API Ready</h3>
            <p>The MCP server is running and ready to serve data.</p>
            <div>
                <a href="${req.protocol}://${req.get('host')}/api/models" class="button">View API</a>
                <a href="${req.protocol}://${req.get('host')}/health" class="button">Health Check</a>
            </div>
        </div>
        
        <div class="card">
            <h3>🛠️ Development Commands</h3>
            <div style="text-align: left; background: #2a2a2a; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 14px;">
                # Start backend server<br>
                npm run dev:http<br><br>
                # Start frontend (in another terminal)<br>
                npm run dev:frontend<br><br>
                # Or start both with concurrently<br>
                npm run dev:full
            </div>
        </div>
    </div>
</body>
</html>
        `);
            });
        }
        else {
            // Production mode - serve built files  
            this.app.use('/static', express.static(path.join(frontendDistPath, 'assets')));
            this.app.use('/assets', express.static(path.join(frontendDistPath, 'assets')));
            // Serve the React app
            this.app.get('/graph', (req, res) => {
                const indexPath = path.join(frontendDistPath, 'index.html');
                try {
                    if (require('fs').existsSync(indexPath)) {
                        res.sendFile(indexPath);
                    }
                    else {
                        this.serveFallbackPage(req, res);
                    }
                }
                catch (error) {
                    console.warn('Frontend not built, serving fallback page');
                    this.serveFallbackPage(req, res);
                }
            });
            // Catch all for React Router
            this.app.get('/graph/*', (req, res) => {
                const indexPath = path.join(frontendDistPath, 'index.html');
                try {
                    if (require('fs').existsSync(indexPath)) {
                        res.sendFile(indexPath);
                    }
                    else {
                        this.serveFallbackPage(req, res);
                    }
                }
                catch (error) {
                    this.serveFallbackPage(req, res);
                }
            });
        }
    }
    serveFallbackPage(req, res) {
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Marketplace - 3D Graph Viewer</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: white;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .card {
            background: #1a1a1a;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .endpoint {
            background: #2a2a2a;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            margin: 10px 0;
        }
        .info {
            background: #1e3a8a;
            border: 1px solid #3b82f6;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌐 Context Marketplace - 3D Graph Viewer</h1>
        
        <div class="info">
            <h3>🚀 3D Graph Visualization Ready!</h3>
            <p>The backend is ready with database storage and REST API endpoints. To complete the setup:</p>
            <ol>
                <li>Build the React frontend with a bundler (Vite/Webpack)</li>
                <li>Serve the built files from this endpoint</li>
                <li>Or use the API endpoints directly with your preferred frontend</li>
            </ol>
        </div>

        <div class="card">
            <h2>📊 Available API Endpoints</h2>
            
            <h3>Models</h3>
            <div class="endpoint">GET /api/models</div>
            <p>List all available models</p>
            
            <h3>Graph Data</h3>
            <div class="endpoint">GET /api/models/:modelName/graph</div>
            <p>Get 3D graph data for a specific model (nodes and edges)</p>
            
            <h3>Layout Persistence</h3>
            <div class="endpoint">POST /api/models/:modelName/layout</div>
            <p>Save 3D node positions (requires database storage)</p>
            
            <h3>Advanced Queries</h3>
            <div class="endpoint">POST /api/query</div>
            <p>Query models with filters (text, tags, author, etc.)</p>
        </div>

        <div class="card">
            <h2>🔗 Integration URLs</h2>
            <div class="endpoint">MCP Protocol: ${req.protocol}://${req.get('host')}/mcp</div>
            <div class="endpoint">WebSocket: ws://${req.get('host')}/ws</div>
            <div class="endpoint">Health Check: ${req.protocol}://${req.get('host')}/health</div>
        </div>

        <div class="card">
            <h2>🛠️ Next Steps</h2>
            <p>The Context Marketplace now includes:</p>
            <ul>
                <li>✅ PostgreSQL database storage with Prisma ORM</li>
                <li>✅ Enhanced MCP tools (17 total) with graph operations</li>
                <li>✅ 3D visualization components with React Three Fiber</li>
                <li>✅ REST API for graph data and layout persistence</li>
                <li>✅ Force-directed layout with interactive controls</li>
                <li>✅ Version control and marketplace features</li>
            </ul>
            
            <p>Ready for deployment with:</p>
            <ul>
                <li>🚀 Fly.io PostgreSQL addon</li>
                <li>📱 Production React build</li>
                <li>🔍 Real-time collaborative editing</li>
            </ul>
        </div>
    </div>
</body>
</html>
      `);
    }
    async start() {
        // Initialize the MCP server database connection
        await this.mcpServer.initialize();
        return new Promise((resolve) => {
            this.server.listen(this.config.port, this.config.host, () => {
                console.log(`Modelit MCP HTTP Server running on http://${this.config.host}:${this.config.port}`);
                console.log(`WebSocket endpoint: ws://${this.config.host}:${this.config.port}/ws`);
                console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
                console.log(`MCP endpoint: http://${this.config.host}:${this.config.port}/mcp`);
                console.log(`3D Graph Viewer: http://${this.config.host}:${this.config.port}/graph`);
                console.log(`REST API: http://${this.config.host}:${this.config.port}/api`);
                console.log('');
                console.log('🎯 For ChatGPT integration, use:');
                console.log(`   URL: http://${this.config.host}:${this.config.port}/mcp`);
                console.log('');
                console.log('🌐 For 3D Graph Visualization:');
                console.log(`   Visit: http://${this.config.host}:${this.config.port}/graph`);
                resolve();
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Modelit MCP HTTP Server stopped');
                resolve();
            });
        });
    }
}
