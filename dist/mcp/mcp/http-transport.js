import WebSocket from 'ws';
import { randomUUID } from 'crypto';
// Session state for HTTP MCP connections
export var SessionState;
(function (SessionState) {
    SessionState["Uninitialized"] = "uninitialized";
    SessionState["Initializing"] = "initializing";
    SessionState["Ready"] = "ready";
    SessionState["Closed"] = "closed";
})(SessionState || (SessionState = {}));
export class SessionManager {
    sessions = new Map();
    SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    createSession() {
        const sessionId = randomUUID();
        const session = {
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
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
        return session;
    }
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (session) {
            Object.assign(session, updates);
            session.lastActivity = new Date();
        }
    }
    deleteSession(sessionId) {
        this.sessions.delete(sessionId);
    }
    cleanup() {
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
                this.sessions.delete(sessionId);
            }
        }
    }
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }
}
export class WebSocketTransport {
    ws;
    messageHandlers = new Set();
    closeHandlers = new Set();
    errorHandlers = new Set();
    constructor(ws) {
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
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        else {
            throw new Error('WebSocket is not open');
        }
    }
    async close() {
        if (this.ws.readyState === WebSocket.OPEN) {
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
export class HTTPTransport {
    messageHandlers = new Set();
    closeHandlers = new Set();
    errorHandlers = new Set();
    isClosed = false;
    sessionId;
    pendingResponse = null;
    constructor(sessionId) {
        this.sessionId = sessionId;
    }
    async start() {
        // HTTP transport doesn't need to start anything
    }
    async send(message) {
        if (this.isClosed) {
            throw new Error('HTTP Transport is closed');
        }
        // Store response for HTTP request-response cycle
        if ('result' in message || 'error' in message) {
            this.pendingResponse = message;
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
    // Method to handle incoming HTTP request
    async handleRequest(message) {
        return new Promise((resolve, reject) => {
            // Set up one-time response handler
            const responseHandler = (response) => {
                if ('result' in response || 'error' in response) {
                    resolve(response);
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
                }
                else {
                    reject(new Error('Request timeout'));
                }
            }, 30000); // 30 second timeout
        });
    }
    getSessionId() {
        return this.sessionId;
    }
}
