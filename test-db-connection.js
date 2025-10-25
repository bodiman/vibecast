#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test creating a model
    const model = await prisma.model.create({
      data: {
        name: 'test_model_' + Date.now(),
        description: 'Test model for database verification',
        metadata: { test: true }
      }
    });
    console.log('✅ Model created:', model.name);
    
    // Test reading models
    const models = await prisma.model.findMany();
    console.log('✅ Models in database:', models.length);
    console.log('Models:', models.map(m => ({ name: m.name, description: m.description })));
    
    // Clean up
    await prisma.model.deleteMany({
      where: { name: { startsWith: 'test_model_' } }
    });
    console.log('✅ Test models cleaned up');
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
