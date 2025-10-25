import WebSocket from 'ws';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

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

  async start(): Promise<void> {
    // HTTP transport doesn't need to start anything
  }

  async send(_message: JSONRPCMessage): Promise<void> {
    // For HTTP transport, we don't send messages back to client
    // The response will be handled by the HTTP response mechanism
    if (this.isClosed) {
      throw new Error('HTTP Transport is closed');
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

  // Method to simulate receiving a message (for HTTP requests)
  receiveMessage(message: JSONRPCMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }
}