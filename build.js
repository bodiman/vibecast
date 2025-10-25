import { build } from 'esbuild';

// Build the main MCP server bundle
await build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.bundle.js',
  format: 'esm',
  external: ['@modelcontextprotocol/sdk']
});

// Build the HTTP server bundle
await build({
  entryPoints: ['dist/http-server.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/http-server.bundle.js',
  format: 'esm',
  external: [
    '@modelcontextprotocol/sdk',
    'path',
    'os',
    'fs',
    'crypto',
    'util',
    'events',
    'stream',
    'http',
    'url',
    'querystring'
  ]
});