/**
 * Framework API - Unified graph management
 */

import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'express';

const prisma = new PrismaClient();

export class FrameworkAPI {
  // List all frameworks
  async listFrameworks(req: Request, res: Response) {
    try {
      const { type, visibility } = req.query;
      
      const frameworks = await prisma.framework.findMany({
        where: {
          ...(type && { type: type as string }),
          ...(visibility && { visibility: visibility as string })
        },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          nodeCount: true,
          edgeCount: true,
          visibility: true,
          published: true,
          stars: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      });
      
      res.json(frameworks);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Get specific framework with full graph data
  async getFramework(req: Request, res: Response) {
    try {
      const { name } = req.params;
      
      const framework = await prisma.framework.findUnique({
        where: { name },
        include: {
          activities: {
            take: 10,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      
      if (!framework) {
        return res.status(404).json({ error: 'Framework not found' });
      }
      
      res.json(framework);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Get framework graph data (nodes + edges only, for visualization)
  async getFrameworkGraph(req: Request, res: Response) {
    try {
      const { name } = req.params;
      
      const framework = await prisma.framework.findUnique({
        where: { name },
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
        return res.status(404).json({ error: 'Framework not found' });
      }
      
      // Transform nodes: map nodeId to id for frontend compatibility
      const transformedNodes = framework.nodes.map(node => ({
        id: node.nodeId,  // Frontend expects 'id', database has 'nodeId'
        name: node.name,
        type: node.type,
        values: node.values,
        content: node.content,
        position: node.position3D || node.position2D || null, // Let frontend handle positioning for nodes without stored positions
        position3D: node.position3D,
        position2D: node.position2D,
        metadata: node.metadata
      }));

      // Transform edges: extract source.nodeId and target.nodeId as simple string references
      const transformedEdges = framework.edges.map(edge => ({
        id: edge.edgeId,
        source: edge.source.nodeId,  // Frontend expects string, not object
        target: edge.target.nodeId,  // Frontend expects string, not object
        type: edge.type,
        strength: edge.strength,
        weight: edge.weight,
        lag: edge.lag,
        confidence: edge.confidence,
        description: edge.description,
        metadata: edge.metadata
      }));

      res.json({
        id: framework.id,
        name: framework.name,
        description: framework.description,
        type: framework.type,
        nodes: transformedNodes,
        edges: transformedEdges,
        nodeCount: framework.nodeCount,
        edgeCount: framework.edgeCount
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Create new framework
  async createFramework(req: Request, res: Response) {
    try {
      const { name, description, type, nodes, edges, metadata } = req.body;
      
      const framework = await prisma.framework.create({
        data: {
          name,
          description,
          type: type || 'general',
          nodeCount: (nodes || []).length,
          edgeCount: (edges || []).length,
          metadata: metadata || {}
        }
      });
      
      // Create nodes if provided
      if (nodes && nodes.length > 0) {
        await prisma.frameworkNode.createMany({
          data: nodes.map((node: any) => ({
            frameworkId: framework.id,
            nodeId: node.id || node.nodeId,
            name: node.name,
            type: node.type || 'scalar',
            formula: node.formula,
            values: node.values,
            content: node.content,
            position3D: node.position3D,
            position2D: node.position2D,
            metadata: node.metadata
          }))
        });
      }
      
      // Create edges if provided
      if (edges && edges.length > 0) {
        // Get created nodes to map IDs
        const createdNodes = await prisma.frameworkNode.findMany({
          where: { frameworkId: framework.id },
          select: { id: true, nodeId: true }
        });
        
        const nodeIdToDbId = new Map();
        createdNodes.forEach(node => {
          nodeIdToDbId.set(node.nodeId, node.id);
        });
        
        await prisma.frameworkEdge.createMany({
          data: edges.map((edge: any) => ({
            frameworkId: framework.id,
            edgeId: edge.id || edge.edgeId,
            type: edge.type || 'dependency',
            strength: edge.strength,
            weight: edge.weight,
            lag: edge.lag,
            confidence: edge.confidence,
            formula: edge.formula,
            description: edge.description,
            metadata: edge.metadata,
            sourceId: nodeIdToDbId.get(edge.source),
            targetId: nodeIdToDbId.get(edge.target)
          }))
        });
      }
      
      // Log activity
      await prisma.frameworkActivity.create({
        data: {
          frameworkId: framework.id,
          type: 'created',
          description: `Framework ${name} created`
        }
      });
      
      res.status(201).json(framework);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Update framework
  async updateFramework(req: Request, res: Response) {
    try {
      const { name } = req.params;
      const { description, metadata } = req.body;
      
      const framework = await prisma.framework.update({
        where: { name },
        data: {
          ...(description !== undefined && { description }),
          ...(metadata !== undefined && { metadata })
        }
      });
      
      // Note: For bulk node/edge updates, use the GraphDiffService instead
      
      // Log activity
      await prisma.frameworkActivity.create({
        data: {
          frameworkId: framework.id,
          type: 'updated',
          description: `Framework ${name} updated`
        }
      });
      
      res.json(framework);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Delete framework
  async deleteFramework(req: Request, res: Response) {
    try {
      const { name } = req.params;
      
      await prisma.framework.delete({
        where: { name }
      });
      
      res.json({ success: true, message: `Framework ${name} deleted` });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
  
  // Get framework statistics
  async getStats(req: Request, res: Response) {
    try {
      const total = await prisma.framework.count();
      const byType = await prisma.framework.groupBy({
        by: ['type'],
        _count: true
      });
      
      const published = await prisma.framework.count({
        where: { published: true }
      });
      
      res.json({
        total,
        byType: byType.reduce((acc, { type, _count }) => {
          acc[type] = _count;
          return acc;
        }, {} as Record<string, number>),
        published
      });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

export const frameworkAPI = new FrameworkAPI();
