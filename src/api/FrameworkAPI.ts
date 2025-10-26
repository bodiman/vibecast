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
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          nodes: true,
          edges: true,
          nodeCount: true,
          edgeCount: true
        }
      });
      
      if (!framework) {
        return res.status(404).json({ error: 'Framework not found' });
      }
      
      res.json({
        id: framework.id,
        name: framework.name,
        description: framework.description,
        type: framework.type,
        nodes: framework.nodes,
        edges: framework.edges,
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
          nodes: nodes || [],
          edges: edges || [],
          nodeCount: (nodes || []).length,
          edgeCount: (edges || []).length,
          metadata: metadata || {}
        }
      });
      
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
      const { description, nodes, edges, metadata } = req.body;
      
      const framework = await prisma.framework.update({
        where: { name },
        data: {
          ...(description !== undefined && { description }),
          ...(nodes !== undefined && { 
            nodes,
            nodeCount: (nodes as any[]).length 
          }),
          ...(edges !== undefined && { 
            edges,
            edgeCount: (edges as any[]).length 
          }),
          ...(metadata !== undefined && { metadata })
        }
      });
      
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
