import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketTransport } from './http-transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { ModelitMCPServer } from './server.js';

export interface HTTPServerConfig {
  port: number;
  host: string;
  storageDirectory: string;
}

export class ModelitHTTPServer {
  private app: express.Application;
  private server: any;
  private wss!: WebSocketServer;
  private mcpServer: ModelitMCPServer;
  private config: HTTPServerConfig;

  constructor(config: HTTPServerConfig) {
    this.config = config;
    this.app = express();
    this.mcpServer = new ModelitMCPServer(config.storageDirectory);
    this.setupMiddleware();
    this.setupRoutes();
    this.server = createServer(this.app);
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // Enable CORS for all routes
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
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

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'Modelit MCP Server',
        version: '0.1.0'
      });
    });

    // MCP endpoint for direct HTTP requests
    this.app.post('/mcp', async (req, res) => {
      try {
        const message = req.body as JSONRPCMessage;
        
        // For now, just handle tools/list as a demonstration
        if ('method' in message && message.method === 'tools/list') {
          const response = {
            jsonrpc: '2.0',
            id: 'id' in message ? message.id : null,
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
                  name: 'evaluate_model',
                  description: 'Evaluate a model for specified time steps',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      modelName: { type: 'string', description: 'Model name' },
                      timeSteps: { type: 'number', description: 'Number of time steps' }
                    },
                    required: ['modelName', 'timeSteps']
                  }
                }
              ]
            }
          };
          res.json(response);
        } else {
          res.status(501).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not implemented in HTTP mode yet',
              data: `Method '${'method' in message ? message.method : 'unknown'}' is not yet supported via HTTP`
            },
            id: 'id' in message ? message.id : null
          });
        }
      } catch (error) {
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

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

    this.wss.on('connection', async (ws) => {
      console.log('WebSocket client connected');
      
      try {
        const transport = new WebSocketTransport(ws);
        await this.mcpServer.connect(transport);
        
        ws.on('close', () => {
          console.log('WebSocket client disconnected');
        });
      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close();
      }
    });
  }


  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
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

  async stop(): Promise<void> {
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