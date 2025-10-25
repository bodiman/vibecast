"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPTransport = exports.WebSocketTransport = void 0;
const ws_1 = __importDefault(require("ws"));
class WebSocketTransport {
    constructor(ws) {
        this.messageHandlers = new Set();
        this.closeHandlers = new Set();
        this.errorHandlers = new Set();
        this.ws = ws;
        this.setupWebSocket();
    }
    setupWebSocket() {
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.messageHandlers.forEach(handler => handler(message));
            }
            catch (error) {
                this.errorHandlers.forEach(handler => handler(new Error(`Failed to parse WebSocket message: ${error}`)));
            }
        });
        this.ws.on('close', () => {
            this.closeHandlers.forEach(handler => handler());
        });
        this.ws.on('error', (error) => {
            this.errorHandlers.forEach(handler => handler(error));
        });
    }
    async start() {
        // WebSocket is already connected when this transport is created
    }
    async send(message) {
        if (this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        else {
            throw new Error('WebSocket is not open');
        }
    }
    async close() {
        if (this.ws.readyState === ws_1.default.OPEN) {
            this.ws.close();
        }
    }
    onMessage(handler) {
        this.messageHandlers.add(handler);
    }
    onClose(handler) {
        this.closeHandlers.add(handler);
    }
    onError(handler) {
        this.errorHandlers.add(handler);
    }
}
exports.WebSocketTransport = WebSocketTransport;
class HTTPTransport {
    constructor() {
        this.messageHandlers = new Set();
        this.closeHandlers = new Set();
        this.errorHandlers = new Set();
        this.isClosed = false;
    }
    async start() {
        // HTTP transport doesn't need to start anything
    }
    async send(_message) {
        // For HTTP transport, we don't send messages back to client
        // The response will be handled by the HTTP response mechanism
        if (this.isClosed) {
            throw new Error('HTTP Transport is closed');
        }
    }
    async close() {
        this.isClosed = true;
        this.closeHandlers.forEach(handler => handler());
    }
    onMessage(handler) {
        this.messageHandlers.add(handler);
    }
    onClose(handler) {
        this.closeHandlers.add(handler);
    }
    onError(handler) {
        this.errorHandlers.add(handler);
    }
    // Method to simulate receiving a message (for HTTP requests)
    receiveMessage(message) {
        this.messageHandlers.forEach(handler => handler(message));
    }
}
exports.HTTPTransport = HTTPTransport;
