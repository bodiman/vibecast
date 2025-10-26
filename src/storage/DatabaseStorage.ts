import { PrismaClient } from '@prisma/client';
import { GraphDiffResult, ApplyDiffResult } from '../services/GraphDiffService.js';

export interface BackupInfo {
  id: string;
  frameworkId: string;
  timestamp: Date;
  snapshot: any;
}

export class DatabaseStorage {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async loadModel(frameworkName: string) {
    const framework = await this.prisma.framework.findUnique({
      where: { name: frameworkName },
      include: {
        nodes: true,
        edges: {
          include: {
            source: true,
            target: true
          }
        }
      }
    });

    if (!framework) {
      throw new Error(`Framework ${frameworkName} not found`);
    }

    // Convert to legacy Model format for compatibility with GraphDiffService
    return {
      name: framework.name,
      description: framework.description,
      metadata: framework.metadata,
      listVariables: () => framework.nodes.map(node => ({
        name: node.name,
        type: node.type,
        values: node.values,
        metadata: node.metadata,
        toJSON: () => ({
          id: node.nodeId,
          name: node.name,
          type: node.type,
          values: node.values,
          content: node.content,
          position3D: node.position3D,
          position2D: node.position2D,
          metadata: node.metadata
        })
      })),
      listEdges: () => framework.edges.map(edge => ({
        id: edge.edgeId,
        source: edge.source.nodeId,
        target: edge.target.nodeId,
        type: edge.type,
        metadata: edge.metadata,
        toJSON: () => ({
          id: edge.edgeId,
          source: edge.source.nodeId,
          target: edge.target.nodeId,
          type: edge.type,
          strength: edge.strength,
          weight: edge.weight,
          lag: edge.lag,
          confidence: edge.confidence,
          description: edge.description,
          metadata: edge.metadata
        })
      }))
    };
  }

  async applyGraphDiff(diff: GraphDiffResult): Promise<{
    appliedChanges: {
      nodesAdded: number;
      nodesModified: number;
      nodesDeleted: number;
      edgesAdded: number;
      edgesModified: number;
      edgesDeleted: number;
    };
    transactionId: string;
  }> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return await this.prisma.$transaction(async (tx) => {
      // Get framework
      const framework = await tx.framework.findUnique({
        where: { name: diff.modelName }
      });

      if (!framework) {
        throw new Error(`Framework ${diff.modelName} not found`);
      }

      let nodesAdded = 0;
      let nodesModified = 0;
      let nodesDeleted = 0;
      let edgesAdded = 0;
      let edgesModified = 0;
      let edgesDeleted = 0;

      // Delete edges first (due to foreign key constraints)
      if (diff.changes.edges.deleted.length > 0) {
        const edgeIds = diff.changes.edges.deleted.map((edge: any) => edge.id);
        await tx.frameworkEdge.deleteMany({
          where: {
            frameworkId: framework.id,
            edgeId: { in: edgeIds }
          }
        });
        edgesDeleted = diff.changes.edges.deleted.length;
      }

      // Delete nodes
      if (diff.changes.nodes.deleted.length > 0) {
        const nodeIds = diff.changes.nodes.deleted.map((node: any) => node.id);
        await tx.frameworkNode.deleteMany({
          where: {
            frameworkId: framework.id,
            nodeId: { in: nodeIds }
          }
        });
        nodesDeleted = diff.changes.nodes.deleted.length;
      }

      // Add new nodes
      if (diff.changes.nodes.added.length > 0) {
        await tx.frameworkNode.createMany({
          data: diff.changes.nodes.added.map((node: any) => ({
            frameworkId: framework.id,
            nodeId: node.id,
            name: node.name,
            type: node.type || 'scalar',
            values: node.values,
            content: node.content,
            position3D: node.position3D,
            position2D: node.position2D,
            metadata: node.metadata
          }))
        });
        nodesAdded = diff.changes.nodes.added.length;
      }

      // Update modified nodes
      for (const modifiedNode of diff.changes.nodes.modified) {
        const nodeData = modifiedNode.new;
        await tx.frameworkNode.updateMany({
          where: {
            frameworkId: framework.id,
            nodeId: nodeData.id
          },
          data: {
            name: nodeData.name,
            type: nodeData.type,
            values: nodeData.values,
            content: nodeData.content,
            position3D: nodeData.position3D,
            position2D: nodeData.position2D,
            metadata: nodeData.metadata
          }
        });
        nodesModified++;
      }

      // Get node ID mappings for edges
      const allNodes = await tx.frameworkNode.findMany({
        where: { frameworkId: framework.id },
        select: { id: true, nodeId: true }
      });

      const nodeIdToDbId = new Map();
      allNodes.forEach(node => {
        nodeIdToDbId.set(node.nodeId, node.id);
      });

      // Add new edges
      if (diff.changes.edges.added.length > 0) {
        await tx.frameworkEdge.createMany({
          data: diff.changes.edges.added.map((edge: any) => ({
            frameworkId: framework.id,
            edgeId: edge.id,
            type: edge.type || 'dependency',
            strength: edge.strength,
            weight: edge.weight,
            lag: edge.lag,
            confidence: edge.confidence,
            description: edge.description,
            metadata: edge.metadata,
            sourceId: nodeIdToDbId.get(edge.source),
            targetId: nodeIdToDbId.get(edge.target)
          }))
        });
        edgesAdded = diff.changes.edges.added.length;
      }

      // Update modified edges
      for (const modifiedEdge of diff.changes.edges.modified) {
        const edgeData = modifiedEdge.new;
        await tx.frameworkEdge.updateMany({
          where: {
            frameworkId: framework.id,
            edgeId: edgeData.id
          },
          data: {
            type: edgeData.type,
            strength: edgeData.strength,
            weight: edgeData.weight,
            lag: edgeData.lag,
            confidence: edgeData.confidence,
            description: edgeData.description,
            metadata: edgeData.metadata,
            sourceId: nodeIdToDbId.get(edgeData.source),
            targetId: nodeIdToDbId.get(edgeData.target)
          }
        });
        edgesModified++;
      }

      // Update framework counts
      const totalNodes = await tx.frameworkNode.count({
        where: { frameworkId: framework.id }
      });
      const totalEdges = await tx.frameworkEdge.count({
        where: { frameworkId: framework.id }
      });

      await tx.framework.update({
        where: { id: framework.id },
        data: {
          nodeCount: totalNodes,
          edgeCount: totalEdges
        }
      });

      // Log activity
      await tx.frameworkActivity.create({
        data: {
          frameworkId: framework.id,
          type: 'bulk_update',
          description: `Applied graph diff: +${nodesAdded} nodes, ~${nodesModified} modified, -${nodesDeleted} deleted; +${edgesAdded} edges, ~${edgesModified} modified, -${edgesDeleted} deleted`,
          metadata: { transactionId, diffStats: { nodesAdded, nodesModified, nodesDeleted, edgesAdded, edgesModified, edgesDeleted } }
        }
      });

      return {
        appliedChanges: {
          nodesAdded,
          nodesModified,
          nodesDeleted,
          edgesAdded,
          edgesModified,
          edgesDeleted
        },
        transactionId
      };
    });
  }

  async saveBackup(frameworkName: string): Promise<BackupInfo> {
    const framework = await this.prisma.framework.findUnique({
      where: { name: frameworkName },
      include: {
        nodes: true,
        edges: true
      }
    });

    if (!framework) {
      throw new Error(`Framework ${frameworkName} not found`);
    }

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const snapshot = {
      framework: {
        name: framework.name,
        description: framework.description,
        type: framework.type,
        metadata: framework.metadata
      },
      nodes: framework.nodes,
      edges: framework.edges
    };

    // Store backup in context cache table (reusing existing table)
    await this.prisma.contextCache.create({
      data: {
        frameworkId: framework.id,
        contextType: 'backup',
        content: JSON.stringify(snapshot),
        version: backupId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    });

    return {
      id: backupId,
      frameworkId: framework.id,
      timestamp: new Date(),
      snapshot
    };
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = await this.prisma.contextCache.findFirst({
      where: {
        version: backupId,
        contextType: 'backup'
      }
    });

    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const snapshot = JSON.parse(backup.content);

    await this.prisma.$transaction(async (tx) => {
      // Delete existing data
      await tx.frameworkEdge.deleteMany({
        where: { frameworkId: backup.frameworkId }
      });
      await tx.frameworkNode.deleteMany({
        where: { frameworkId: backup.frameworkId }
      });

      // Restore nodes
      if (snapshot.nodes.length > 0) {
        await tx.frameworkNode.createMany({
          data: snapshot.nodes.map((node: any) => ({
            ...node,
            frameworkId: backup.frameworkId
          }))
        });
      }

      // Restore edges
      if (snapshot.edges.length > 0) {
        await tx.frameworkEdge.createMany({
          data: snapshot.edges.map((edge: any) => ({
            ...edge,
            frameworkId: backup.frameworkId
          }))
        });
      }

      // Update framework metadata
      await tx.framework.update({
        where: { id: backup.frameworkId },
        data: {
          description: snapshot.framework.description,
          metadata: snapshot.framework.metadata,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length
        }
      });

      // Log activity
      await tx.frameworkActivity.create({
        data: {
          frameworkId: backup.frameworkId,
          type: 'restored',
          description: `Restored from backup ${backupId}`,
          metadata: { backupId }
        }
      });
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}