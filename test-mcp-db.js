#!/usr/bin/env node

import { ModelitMCPServer } from './dist/mcp/server.js';
import { join } from 'path';
import { homedir } from 'os';

const defaultStorageDir = join(homedir(), '.modelit', 'models');
const storageDirectory = process.env.MODELIT_STORAGE_DIR || defaultStorageDir;
const databaseUrl = process.env.DATABASE_URL;

console.log('Testing MCP Server with database...');
console.log('Database URL:', databaseUrl ? 'configured' : 'not configured');
console.log('Storage directory:', storageDirectory);

const server = new ModelitMCPServer(storageDirectory, databaseUrl);

async function testDatabase() {
  try {
    // Initialize the server
    await server.initialize();
    console.log('✅ Server initialized');
    
    // Test creating a model
    const createResult = await server.handleCreateModel({
      name: 'mcp_db_test',
      description: 'Testing MCP server database functionality'
    });
    console.log('✅ Model created:', createResult.content[0].text);
    
    // Test adding variables (create dependencies first)
    const unitsResult = await server.handleCreateVariable({
      name: 'units',
      type: 'parameter',
      metadata: { description: 'Number of units sold' }
    });
    console.log('✅ Variable created:', unitsResult.content[0].text);
    
    const priceResult = await server.handleCreateVariable({
      name: 'price',
      type: 'parameter',
      metadata: { description: 'Price per unit' }
    });
    console.log('✅ Variable created:', priceResult.content[0].text);
    
    const salesResult = await server.handleCreateVariable({
      name: 'sales',
      formula: 'units * price',
      type: 'series',
      metadata: { description: 'Total sales revenue' }
    });
    console.log('✅ Variable created:', salesResult.content[0].text);
    
    // Test saving the model
    const saveResult = await server.handleSaveModel({});
    console.log('✅ Model saved:', saveResult.content[0].text);
    
    // Test listing models
    const listResult = await server.handleListModels();
    console.log('✅ Models listed:', listResult.content[0].text);
    
    // Test loading the model
    const loadResult = await server.handleLoadModel({ name: 'mcp_db_test' });
    console.log('✅ Model loaded:', loadResult.content[0].text);
    
    // Test listing variables
    const variablesResult = await server.handleListVariables();
    console.log('✅ Variables listed:', variablesResult.content[0].text);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await server.cleanup();
  }
}

testDatabase();
