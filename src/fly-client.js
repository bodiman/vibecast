#!/usr/bin/env node

const https = require('https');
const http = require('http');

class FlyClient {
  constructor(flyUrl) {
    this.flyUrl = flyUrl;
    this.sessionId = null;
  }

  async makeRequest(method, params = {}) {
    const url = new URL(`${this.flyUrl}/mcp`);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestData = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId })
      }
    };

    return new Promise((resolve, reject) => {
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.headers['mcp-session-id']) {
              this.sessionId = res.headers['mcp-session-id'];
            }
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  async initialize() {
    const response = await this.makeRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'claude-desktop',
        version: '1.0.0'
      }
    });
    return response;
  }

  async listTools() {
    const response = await this.makeRequest('tools/list', {});
    return response;
  }

  async callTool(name, args) {
    const response = await this.makeRequest('tools/call', {
      name,
      arguments: args
    });
    return response;
  }
}

// Simple CLI interface
async function main() {
  const flyUrl = process.env.MODELIT_FLY_URL || 'https://your-app-name.fly.dev';
  const client = new FlyClient(flyUrl);

  try {
    console.log(`Connecting to ${flyUrl}...`);
    await client.initialize();
    console.log('Connected successfully!');
    
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools?.map(t => t.name).join(', '));
    
    // Example usage
    // const result = await client.callTool('create_model', { name: 'test', description: 'test model' });
    // console.log('Result:', result);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = FlyClient;
