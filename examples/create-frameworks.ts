#!/usr/bin/env node
/**
 * Create sample frameworks to demonstrate the unified structure
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSampleFrameworks() {
  console.log('\n🚀 Creating sample frameworks...\n');
  
  // 1. Mathematical Framework - Financial Model
  const financialFramework = await prisma.framework.create({
    data: {
      name: 'financial-model',
      description: 'A financial model showing relationships between Revenue, Costs, Tax, and Profits',
      type: 'mathematical',
      nodes: [
        {
          id: 'revenue',
          name: 'Revenue',
          type: 'series',
          metadata: { formula: null, values: [100, 110, 121, 133], unit: 'USD' },
          position: { x: -2, y: 2, z: 0 }
        },
        {
          id: 'cogs',
          name: 'Cost of Goods Sold',
          type: 'series',
          metadata: { formula: 'revenue * 0.3', values: [30, 33, 36, 40], unit: 'USD' },
          position: { x: -2, y: -2, z: 0 }
        },
        {
          id: 'gross-profit',
          name: 'Gross Profit',
          type: 'scalar',
          metadata: { formula: 'revenue - cogs', values: [70, 77, 85, 93], unit: 'USD' },
          position: { x: 0, y: 0, z: 0 }
        },
        {
          id: 'tax-rate',
          name: 'Tax Rate',
          type: 'parameter',
          metadata: { formula: null, values: [0.21], unit: '%' },
          position: { x: 2, y: 2, z: 0 }
        },
        {
          id: 'net-profit',
          name: 'Net Profit',
          type: 'scalar',
          metadata: { formula: 'gross-profit * (1 - tax-rate)', values: [55.3, 60.83, 67.15, 73.47], unit: 'USD' },
          position: { x: 2, y: -2, z: 0 }
        }
      ],
      edges: [
        { id: 'e1', source: 'revenue', target: 'gross-profit', type: 'formula' },
        { id: 'e2', source: 'cogs', target: 'gross-profit', type: 'formula' },
        { id: 'e3', source: 'gross-profit', target: 'net-profit', type: 'formula' },
        { id: 'e4', source: 'tax-rate', target: 'net-profit', type: 'parameter' },
        { id: 'e5', source: 'revenue', target: 'cogs', type: 'causal' }
      ],
      nodeCount: 5,
      edgeCount: 5,
      metadata: { industry: 'finance', complexity: 'medium' }
    }
  });
  
  console.log(`✓ Created: ${financialFramework.name} (${financialFramework.nodeCount} nodes, ${financialFramework.edgeCount} edges)`);
  
  // 2. Knowledge Framework - Frontend Development
  const frontendFramework = await prisma.framework.create({
    data: {
      name: 'vibecast/frontend',
      description: '3D Visualization and React expertise for VibeCast',
      type: 'knowledge',
      nodes: [
        {
          id: 'threejs',
          name: 'Three.js Fundamentals',
          type: 'concept',
          metadata: {
            summary: 'Core 3D rendering library',
            content: 'Three.js is a cross-browser JavaScript library used to create 3D graphics in a web browser using WebGL.',
            importance: 1.0,
            confidence: 0.95,
            tags: ['3d', 'webgl', 'rendering']
          },
          position: { x: 0, y: 0, z: 0 }
        },
        {
          id: 'r3f',
          name: 'React Three Fiber',
          type: 'tool',
          metadata: {
            summary: 'React renderer for Three.js',
            content: 'R3F is a React reconciler for Three.js that allows you to build 3D scenes declaratively with reusable components.',
            importance: 0.95,
            confidence: 0.9,
            tags: ['react', 'three.js', 'components']
          },
          position: { x: 2, y: 0, z: 0 }
        },
        {
          id: 'memory-leaks',
          name: 'Memory Leak Prevention',
          type: 'gotcha',
          metadata: {
            summary: 'Critical patterns to avoid memory issues',
            content: 'Always dispose of geometries, materials, and textures. Use useEffect cleanup in React components.',
            importance: 0.99,
            confidence: 0.98,
            tags: ['performance', 'memory', 'cleanup']
          },
          position: { x: -2, y: 2, z: 0 }
        },
        {
          id: 'performance',
          name: 'Performance Optimization',
          type: 'pattern',
          metadata: {
            summary: 'Best practices for 60 FPS',
            content: 'Use instancing for repeated geometries, implement LOD, minimize draw calls, use BufferGeometry.',
            importance: 0.9,
            confidence: 0.92,
            tags: ['performance', 'optimization', 'fps']
          },
          position: { x: 2, y: 2, z: 0 }
        }
      ],
      edges: [
        { id: 'l1', source: 'threejs', target: 'r3f', type: 'leads_to', metadata: { strength: 0.9, reason: 'R3F builds on Three.js' } },
        { id: 'l2', source: 'threejs', target: 'memory-leaks', type: 'related_to', metadata: { strength: 0.95, reason: 'Memory management is critical in 3D' } },
        { id: 'l3', source: 'r3f', target: 'performance', type: 'related_to', metadata: { strength: 0.85, reason: 'Performance considerations in React' } },
        { id: 'l4', source: 'memory-leaks', target: 'performance', type: 'leads_to', metadata: { strength: 0.8, reason: 'Memory leaks degrade performance' } }
      ],
      nodeCount: 4,
      edgeCount: 4,
      metadata: { domain: 'frontend', technology: '3d-visualization' }
    }
  });
  
  console.log(`✓ Created: ${frontendFramework.name} (${frontendFramework.nodeCount} nodes, ${frontendFramework.edgeCount} edges)`);
  
  // 3. Workflow Framework - Development Process
  const workflowFramework = await prisma.framework.create({
    data: {
      name: 'dev-workflow',
      description: 'Standard development workflow from idea to deployment',
      type: 'workflow',
      nodes: [
        { id: 'ideation', name: 'Ideation', type: 'stage', metadata: { duration: '1-2 days' }, position: { x: -3, y: 0, z: 0 } },
        { id: 'design', name: 'Design', type: 'stage', metadata: { duration: '2-3 days' }, position: { x: -1, y: 0, z: 0 } },
        { id: 'development', name: 'Development', type: 'stage', metadata: { duration: '1-2 weeks' }, position: { x: 1, y: 0, z: 0 } },
        { id: 'testing', name: 'Testing', type: 'stage', metadata: { duration: '3-5 days' }, position: { x: 3, y: 0, z: 0 } },
        { id: 'deployment', name: 'Deployment', type: 'stage', metadata: { duration: '1 day' }, position: { x: 5, y: 0, z: 0 } }
      ],
      edges: [
        { id: 'w1', source: 'ideation', target: 'design', type: 'sequence' },
        { id: 'w2', source: 'design', target: 'development', type: 'sequence' },
        { id: 'w3', source: 'development', target: 'testing', type: 'sequence' },
        { id: 'w4', source: 'testing', target: 'deployment', type: 'sequence' },
        { id: 'w5', source: 'testing', target: 'development', type: 'feedback', metadata: { condition: 'bugs found' } }
      ],
      nodeCount: 5,
      edgeCount: 5,
      metadata: { team: 'engineering', iteration: 'agile' }
    }
  });
  
  console.log(`✓ Created: ${workflowFramework.name} (${workflowFramework.nodeCount} nodes, ${workflowFramework.edgeCount} edges)`);
  
  // Summary
  const total = await prisma.framework.count();
  const byType = await prisma.framework.groupBy({
    by: ['type'],
    _count: true
  });
  
  console.log('\n✅ Sample frameworks created!');
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${total} frameworks`);
  byType.forEach(({ type, _count }) => {
    console.log(`   • ${type}: ${_count}`);
  });
  
  console.log('\n🌐 View at:');
  console.log(`   http://localhost:3000/framework/${financialFramework.name}`);
  console.log(`   http://localhost:3000/framework/${frontendFramework.name}`);
  console.log(`   http://localhost:3000/framework/${workflowFramework.name}`);
}

async function main() {
  try {
    await createSampleFrameworks();
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
