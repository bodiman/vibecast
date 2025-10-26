/**
 * Framework HTTP Server - Unified graph visualization and management
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { frameworkAPI } from '../api/FrameworkAPI.js';

export interface ServerConfig {
  port: number;
  host: string;
}

export class FrameworkServer {
  private app: express.Application;
  private server: any;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.server = createServer(this.app);
  }

  private setupMiddleware(): void {
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    
    // Static files
    const publicPath = path.join(process.cwd(), 'public');
    this.app.use('/public', express.static(publicPath));
    
    // Logging
    this.app.use((req, _res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

    // Framework API Routes
    this.app.get('/api/frameworks', frameworkAPI.listFrameworks.bind(frameworkAPI));
    this.app.get('/api/frameworks/:name', frameworkAPI.getFramework.bind(frameworkAPI));
    this.app.get('/api/frameworks/:name/graph', frameworkAPI.getFrameworkGraph.bind(frameworkAPI));
    this.app.post('/api/frameworks', frameworkAPI.createFramework.bind(frameworkAPI));
    this.app.put('/api/frameworks/:name', frameworkAPI.updateFramework.bind(frameworkAPI));
    this.app.delete('/api/frameworks/:name', frameworkAPI.deleteFramework.bind(frameworkAPI));
    this.app.get('/api/stats', frameworkAPI.getStats.bind(frameworkAPI));

    // Serve framework viewer
    this.app.get('/framework/:name(*)', (req, res) => {
      const viewerPath = path.join(process.cwd(), 'public', 'framework-viewer.html');
      res.sendFile(viewerPath);
    });
    
    // Serve Lava chat interface
    this.app.get('/lava', (req, res) => {
      const lavaPath = path.join(process.cwd(), 'public', 'lava-chat.html');
      res.sendFile(lavaPath);
    });
    
    // Alias for AI chat
    this.app.get('/chat', (req, res) => {
      res.redirect('/lava');
    });
    
    // Serve dashboard
    this.app.get('/dashboard', (req, res) => {
      const dashboardPath = path.join(process.cwd(), 'public', 'framework-dashboard.html');
      res.sendFile(dashboardPath);
    });
    
    // Redirect root to dashboard
    this.app.get('/', (req, res) => {
      res.redirect('/dashboard');
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found', path: req.path });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        console.log('\n🚀 Framework Server Started');
        console.log('━'.repeat(60));
        console.log(`📍 Address: http://${this.config.host}:${this.config.port}`);
        console.log(`📊 Dashboard: http://${this.config.host}:${this.config.port}/dashboard`);
        console.log(`💬 AI Chat: http://${this.config.host}:${this.config.port}/lava`);
        console.log(`🔍 Health: http://${this.config.host}:${this.config.port}/health`);
        console.log(`📖 API: http://${this.config.host}:${this.config.port}/api/frameworks`);
        console.log('━'.repeat(60));
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
