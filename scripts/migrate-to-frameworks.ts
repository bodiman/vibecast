#!/usr/bin/env node
/**
 * Migration script: Convert Models and TribalKnowledge to unified Frameworks
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Node {
  id: string;
  name: string;
  type: string;
  metadata: any;
  position?: { x: number; y: number; z: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  metadata?: any;
}

async function migrateModelsToFrameworks() {
  console.log('\n📊 Migrating Models to Frameworks...\n');
  
  const models = await prisma.model.findMany({
    include: {
      variables: {
        include: {
          sourceEdges: true,
          targetEdges: true
        }
      },
      edges: true
    }
  });
  
  console.log(`Found ${models.length} models to migrate`);
  
  for (const model of models) {
    console.log(`  • Migrating: ${model.name}`);
    
    // Convert Variables to Nodes
    const nodes: Node[] = model.variables.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type, // parameter, series, scalar
      metadata: {
        formula: v.formula,
        values: v.values,
        ...((v.metadata as any) || {})
      },
      position: v.position3D as any
    }));
    
    // Convert Edges
    const edges: Edge[] = model.edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: e.type,
      metadata: e.metadata as any
    }));
    
    // Create Framework
    await prisma.$executeRaw`
      INSERT INTO frameworks (id, name, description, type, nodes, edges, metadata, 
                             "nodeCount", "edgeCount", version, owner, visibility, 
                             published, "createdAt", "updatedAt")
      VALUES (${model.id}, ${model.name}, ${model.description}, 'mathematical',
              ${JSON.stringify(nodes)}::jsonb, ${JSON.stringify(edges)}::jsonb,
              ${JSON.stringify(model.metadata)}::jsonb,
              ${nodes.length}, ${edges.length}, ${model.version}, NULL, 'private',
              false, ${model.createdAt}, ${model.updatedAt})
    `;
    
    console.log(`    ✓ Created framework with ${nodes.length} nodes, ${edges.length} edges`);
  }
}

async function migrateTribalKnowledgeToFrameworks() {
  console.log('\n🧠 Migrating TribalKnowledge to Frameworks...\n');
  
  const knowledge = await prisma.tribalKnowledge.findMany();
  
  console.log(`Found ${knowledge.length} knowledge bases to migrate`);
  
  for (const kb of knowledge) {
    const name = `${kb.codespace}/${kb.domain}`;
    console.log(`  • Migrating: ${name}`);
    
    // TribalKnowledge already has nodes and links in the right format
    const nodes = kb.nodes as any[];
    const edges = (kb.links as any[]).map(link => ({
      id: link.id,
      source: link.source,
      target: link.target,
      type: link.type,
      metadata: {
        strength: link.strength,
        reason: link.reason
      }
    }));
    
    // Create Framework
    await prisma.$executeRaw`
      INSERT INTO frameworks (id, name, description, type, nodes, edges, metadata,
                             "nodeCount", "edgeCount", version, owner, visibility,
                             published, stars, forks, downloads, "publishedAt",
                             "createdAt", "updatedAt")
      VALUES (${kb.id}, ${name}, ${kb.description}, 'knowledge',
              ${JSON.stringify(nodes)}::jsonb, ${JSON.stringify(edges)}::jsonb,
              ${JSON.stringify(kb.metadata)}::jsonb,
              ${kb.nodeCount}, ${kb.linkCount}, ${kb.version}, ${kb.owner}, ${kb.visibility},
              ${kb.published}, ${kb.stars}, ${kb.forks}, ${kb.downloads}, ${kb.publishedAt},
              ${kb.createdAt}, ${kb.updatedAt})
    `;
    
    console.log(`    ✓ Created framework with ${kb.nodeCount} nodes, ${kb.linkCount} edges`);
  }
}

async function migrateActivities() {
  console.log('\n📝 Migrating Activities...\n');
  
  const activities = await prisma.knowledgeActivity.findMany();
  
  console.log(`Found ${activities.length} activities to migrate`);
  
  for (const activity of activities) {
    await prisma.$executeRaw`
      INSERT INTO framework_activities (id, "frameworkId", type, actor, description, metadata, "createdAt")
      VALUES (${activity.id}, ${activity.knowledgeId}, ${activity.type}, ${activity.actor},
              ${activity.description}, ${JSON.stringify(activity.metadata)}::jsonb, ${activity.createdAt})
    `;
  }
  
  console.log(`  ✓ Migrated ${activities.length} activities`);
}

async function main() {
  console.log('🚀 Starting migration to unified Framework structure...');
  console.log('━'.repeat(60));
  
  try {
    // Check if frameworks table exists
    await prisma.$executeRaw`SELECT 1 FROM frameworks LIMIT 1`;
  } catch (error) {
    console.error('\n❌ Error: frameworks table does not exist!');
    console.error('   Please run: npx prisma db push --schema=./prisma/schema-new.prisma');
    process.exit(1);
  }
  
  try {
    await migrateModelsToFrameworks();
    await migrateTribalKnowledgeToFrameworks();
    await migrateActivities();
    
    console.log('\n' + '━'.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    
    const frameworkCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM frameworks`;
    console.log(`   • Total frameworks: ${(frameworkCount as any)[0].count}`);
    
    const typeBreakdown = await prisma.$queryRaw`
      SELECT type, COUNT(*) as count FROM frameworks GROUP BY type
    `;
    (typeBreakdown as any[]).forEach(row => {
      console.log(`     - ${row.type}: ${row.count}`);
    });
    
    console.log('\n⚠️  Next steps:');
    console.log('   1. Verify the migrated data');
    console.log('   2. Update application code to use frameworks');
    console.log('   3. Drop old tables: models, variables, edges, tribal_knowledge');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
