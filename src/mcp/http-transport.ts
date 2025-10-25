import WebSocket from 'ws';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

// Session state for HTTP MCP connections
export enum SessionState {
  Uninitialized = 'uninitialized',
  Initializing = 'initializing', 
  Ready = 'ready',
  Closed = 'closed'
}

export interface MCPSession {
  id: string;
  state: SessionState;
  capabilities: any;
  clientInfo: any;
  serverInfo: any;
  createdAt: Date;
  lastActivity: Date;
}

export class SessionManager {
  private sessions = new Map<string, MCPSession>();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  createSession(): MCPSession {
    const sessionId = randomUUID();
    const session: MCPSession = {
      id: sessionId,
      state: SessionState.Uninitialized,
      capabilities: {},
      clientInfo: {},
      serverInfo: {},
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): MCPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  updateSession(sessionId: string, updates: Partial<MCPSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
      session.lastActivity = new Date();
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  cleanup(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getActiveSessions(): MCPSession[] {
    return Array.from(this.sessions.values());
  }
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket;
  private messageHandlers: Set<(message: JSONRPCMessage) => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        this.errorHandlers.forEach(handler => 
          handler(new Error(`Failed to parse WebSocket message: ${error}`))
        );
      }
    });

    this.ws.on('close', () => {
      this.closeHandlers.forEach(handler => handler());
    });

    this.ws.on('error', (error: Error) => {
      this.errorHandlers.forEach(handler => handler(error));
    });
  }

  async start(): Promise<void> {
    // WebSocket is already connected when this transport is created
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      throw new Error('WebSocket is not open');
    }
  }

  async close(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }
}

export class HTTPTransport implements Transport {
  private messageHandlers: Set<(message: JSONRPCMessage) => void> = new Set();
  private closeHandlers: Set<() => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private isClosed = false;
  private sessionId: string;
  private pendingResponse: JSONRPCResponse | null = null;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async start(): Promise<void> {
    // HTTP transport doesn't need to start anything
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (this.isClosed) {
      throw new Error('HTTP Transport is closed');
    }
    
    // Store response for HTTP request-response cycle
    if ('result' in message || 'error' in message) {
      this.pendingResponse = message as JSONRPCResponse;
    }
  }

  async close(): Promise<void> {
    this.isClosed = true;
    this.closeHandlers.forEach(handler => handler());
  }

  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  onClose(handler: () => void): void {
    this.closeHandlers.add(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }

  // Method to handle incoming HTTP request
  async handleRequest(message: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve, reject) => {
      // Set up one-time response handler
      const responseHandler = (response: JSONRPCMessage) => {
        if ('result' in response || 'error' in response) {
          resolve(response as JSONRPCResponse);
        }
      };

      this.messageHandlers.add(responseHandler);
      
      // Send the message to MCP server handlers
      this.messageHandlers.forEach(handler => {
        if (handler !== responseHandler) {
          handler(message);
        }
      });

      // Clean up handler after timeout
      setTimeout(() => {
        this.messageHandlers.delete(responseHandler);
        if (this.pendingResponse) {
          resolve(this.pendingResponse);
          this.pendingResponse = null;
        } else {
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }
}