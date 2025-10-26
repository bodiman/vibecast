#!/usr/bin/env node
/**
 * Clear Database Script
 * Removes all data from all tables in the database
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Clearing database...');
  
  try {
    // Clear tables in dependency order (children first)
    console.log('  - Clearing framework activities...');
    await prisma.frameworkActivity.deleteMany();
    
    console.log('  - Clearing framework versions...');
    await prisma.frameworkVersion.deleteMany();
    
    console.log('  - Clearing framework edges...');
    await prisma.frameworkEdge.deleteMany();
    
    console.log('  - Clearing framework nodes...');
    await prisma.frameworkNode.deleteMany();
    
    console.log('  - Clearing frameworks...');
    await prisma.framework.deleteMany();
    
    console.log('  - Clearing sessions...');
    await prisma.session.deleteMany();
    
    console.log('  - Clearing agent states...');
    await prisma.agentState.deleteMany();
    
    console.log('  - Clearing context cache...');
    await prisma.contextCache.deleteMany();
    
    console.log('✅ Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearDatabase();
