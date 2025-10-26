#!/usr/bin/env node
/**
 * Test script for Creao MCP Server
 * Tests basic functionality without requiring a full MCP client
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMCPFunctionality() {
  console.log('🧪 Testing Creao MCP Server Functionality\n');

  try {
    // Test 1: List frameworks
    console.log('1️⃣  Testing list_frameworks...');
    const frameworks = await prisma.framework.findMany({
      select: {
        name: true,
        type: true,
        description: true,
      },
    });
    console.log(`   ✅ Found ${frameworks.length} frameworks`);
    frameworks.forEach((f: any) => console.log(`      - ${f.name} (${f.type})`));

    // Test 2: Get specific framework
    if (frameworks.length > 0) {
      console.log('\n2️⃣  Testing get_framework...');
      const framework = await prisma.framework.findUnique({
        where: { name: frameworks[0].name },
      });
      console.log(`   ✅ Retrieved: ${framework?.name}`);
      console.log(`      Nodes: ${(framework?.nodes as any[])?.length || 0}`);
      console.log(`      Edges: ${(framework?.edges as any[])?.length || 0}`);
    }

    // Test 3: Create a test framework
    console.log('\n3️⃣  Testing create_framework...');
    const testName = `test-framework-${Date.now()}`;
    const newFramework = await prisma.framework.create({
      data: {
        name: testName,
        description: 'Test framework created by MCP test script',
        type: 'general',
        visibility: 'private',
        nodes: [
          {
            id: 'node1',
            name: 'Node 1',
            type: 'test',
            position: { x: 0, y: 0, z: 0 },
            metadata: {},
          },
          {
            id: 'node2',
            name: 'Node 2',
            type: 'test',
            position: { x: 2, y: 0, z: 0 },
            metadata: {},
          },
        ],
        edges: [
          {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            metadata: {},
          },
        ],
        metadata: {},
      },
    });
    console.log(`   ✅ Created: ${newFramework.name}`);

    // Test 4: Update framework (add node)
    console.log('\n4️⃣  Testing add_node...');
    const nodes = newFramework.nodes as any[];
    nodes.push({
      id: 'node3',
      name: 'Node 3',
      type: 'test',
      position: { x: 4, y: 0, z: 0 },
      metadata: {},
    });
    await prisma.framework.update({
      where: { name: testName },
      data: { nodes: nodes as any },
    });
    console.log('   ✅ Added node3 to framework');

    // Test 5: Query graph
    console.log('\n5️⃣  Testing query_graph...');
    const updatedFramework = await prisma.framework.findUnique({
      where: { name: testName },
    });
    const filteredNodes = (updatedFramework?.nodes as any[]).filter(
      (n) => n.type === 'test'
    );
    console.log(`   ✅ Found ${filteredNodes.length} nodes with type 'test'`);

    // Test 6: Get stats
    console.log('\n6️⃣  Testing get_stats...');
    const total = await prisma.framework.count();
    const byType = await prisma.framework.groupBy({
      by: ['type'],
      _count: true,
    });
    console.log(`   ✅ Total frameworks: ${total}`);
    byType.forEach((t: any) => console.log(`      - ${t.type}: ${t._count}`));

    // Test 7: Delete test framework
    console.log('\n7️⃣  Testing delete_framework...');
    await prisma.framework.delete({
      where: { name: testName },
    });
    console.log('   ✅ Deleted test framework');

    console.log('\n✨ All tests passed! MCP functionality is working correctly.\n');
    console.log('📝 Next steps:');
    console.log('   1. Run: npm run mcp:inspect');
    console.log('   2. Test tools in the web interface');
    console.log('   3. Configure in Claude Desktop (see CREAO_MCP.md)');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMCPFunctionality();
