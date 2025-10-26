import { PrismaClient } from '@prisma/client';
import { Model, ModelData } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge } from '../models/Edge.js';
import { MarketplaceAPI, MarketplaceModel, SearchQuery, SearchResult } from '../marketplace/MarketplaceAPI.js';

export interface DatabaseConfig {
  databaseUrl?: string;
  maxConnections?: number;
  timeout?: number;
}

export class DatabaseStorage {
  private prisma: PrismaClient;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig = {}) {
    this.config = config;
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    
    // Only create PrismaClient if we have a valid database URL
    if (databaseUrl) {
      this.prisma = new PrismaClient({
        datasourceUrl: databaseUrl
      });
    } else {
      // Create a dummy PrismaClient that will fail on use
      this.prisma = null as any;
    }
  }

  async initialize(): Promise<void> {
    if (!this.prisma) {
      console.log('📁 Using file storage (no database configured)');
      return;
    }
    
    try {
      await this.prisma.$connect();
      console.error('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  // Model CRUD operations
  async saveModel(model: Model): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Upsert the model
        const dbModel = await tx.model.upsert({
          where: { name: model.name },
          update: {
            description: model.description,
            metadata: model.metadata as any,
            version: model.metadata?.version || '1.0.0',
            updatedAt: new Date()
          },
          create: {
            name: model.name,
            description: model.description,
            metadata: model.metadata as any,
            version: model.metadata?.version || '1.0.0'
          }
        });

        // Delete existing variables and edges (will be recreated)
        await tx.edge.deleteMany({ where: { modelId: dbModel.id } });
        await tx.variable.deleteMany({ where: { modelId: dbModel.id } });

        // Create variables
        const variableIds = new Map<string, string>();
        for (const variable of model.listVariables()) {
          const dbVariable = await tx.variable.create({
            data: {
              name: variable.name,
              type: variable.type,
              formula: variable.formula,
              values: variable.values as any,
              metadata: variable.metadata as any,
              modelId: dbModel.id
            }
          });
          variableIds.set(variable.name, dbVariable.id);
        }

        // Create edges
        for (const edge of model.listEdges()) {
          const sourceId = variableIds.get(edge.source);
          const targetId = variableIds.get(edge.target);
          
          if (sourceId && targetId) {
            await tx.edge.create({
              data: {
                type: edge.type,
                metadata: edge.metadata as any,
                modelId: dbModel.id,
                sourceId,
                targetId
              }
            });
          }
        }

        // Update marketplace data if model is published
        if (model.metadata?.published) {
          await tx.marketplaceModel.upsert({
            where: { modelId: dbModel.id },
            update: {
              author: model.metadata?.author || 'unknown',
              tags: model.metadata?.tags || [],
              category: model.metadata?.category || 'general',
              license: model.metadata?.license || 'MIT',
              dependencies: model.metadata?.dependencies || []
            },
            create: {
              modelId: dbModel.id,
              author: model.metadata?.author || 'unknown',
              tags: model.metadata?.tags || [],
              category: model.metadata?.category || 'general',
              license: model.metadata?.license || 'MIT',
              dependencies: model.metadata?.dependencies || []
            }
          });
        }
      });
    } catch (error) {
      throw new Error(`Failed to save model '${model.name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadModel(name: string): Promise<Model> {
    try {
      const dbModel = await this.prisma.model.findUnique({
        where: { name },
        include: {
          variables: true,
          edges: {
            include: {
              source: true,
              target: true
            }
          },
          marketplace: true
        }
      });

      if (!dbModel) {
        throw new Error(`Model '${name}' not found`);
      }

      // Convert database model to our Model class
      const variables = dbModel.variables.map(v => {
        return new Variable({
          name: v.name,
          type: v.type as any,
          formula: v.formula || undefined,
          values: v.values as number[] || undefined,
          metadata: v.metadata as any || undefined
        });
      });

      const edges = dbModel.edges.map(e => {
        return new Edge({
          id: e.id,
          source: e.source.name,
          target: e.target.name,
          type: e.type as any,
          metadata: e.metadata as any
        });
      });

      // Merge marketplace metadata
      let metadata = dbModel.metadata as any || {};
      if (dbModel.marketplace) {
        metadata = {
          ...metadata,
          marketplaceId: dbModel.marketplace.id,
          published: dbModel.marketplace.published,
          author: dbModel.marketplace.author,
          tags: dbModel.marketplace.tags,
          category: dbModel.marketplace.category,
          license: dbModel.marketplace.license,
          stars: dbModel.marketplace.stars,
          forks: dbModel.marketplace.forks,
          downloads: dbModel.marketplace.downloads,
          dependencies: dbModel.marketplace.dependencies
        };
      }

      const modelData: ModelData = {
        name: dbModel.name,
        description: dbModel.description || undefined,
        variables: variables.map(v => v.toJSON()),
        edges: edges.map(e => e.toJSON()),
        metadata
      };

      return Model.fromJSON(modelData);
    } catch (error) {
      throw new Error(`Failed to load model '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteModel(name: string): Promise<void> {
    try {
      const result = await this.prisma.model.delete({
        where: { name }
      });
    } catch (error) {
      if ((error as any)?.code === 'P2025') {
        throw new Error(`Model '${name}' not found`);
      }
      throw new Error(`Failed to delete model '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.prisma.model.findMany({
        select: { name: true },
        orderBy: { updatedAt: 'desc' }
      });
      return models.map(m => m.name);
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async modelExists(name: string): Promise<boolean> {
    try {
      const count = await this.prisma.model.count({
        where: { name }
      });
      return count > 0;
    } catch (error) {
      return false;
    }
  }

  async getModelInfo(name: string): Promise<{
    name: string;
    size: number;
    lastModified: Date;
    variableCount: number;
    edgeCount: number;
  }> {
    try {
      const model = await this.prisma.model.findUnique({
        where: { name },
        include: {
          _count: {
            select: {
              variables: true,
              edges: true
            }
          }
        }
      });

      if (!model) {
        throw new Error(`Model '${name}' not found`);
      }

      return {
        name: model.name,
        size: JSON.stringify(model).length, // Approximate size
        lastModified: model.updatedAt,
        variableCount: model._count.variables,
        edgeCount: model._count.edges
      };
    } catch (error) {
      throw new Error(`Failed to get model info for '${name}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Graph queries for 3D visualization
  async getGraphData(modelName: string): Promise<{
    nodes: Array<{
      id: string;
      name: string;
      type: string;
      values?: any;
      metadata?: any;
      position3D?: { x: number; y: number; z: number };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      formula?: string;
      metadata?: any;
    }>;
  }> {
    try {
      const model = await this.prisma.model.findUnique({
        where: { name: modelName },
        include: {
          variables: true,
          edges: {
            include: {
              source: true,
              target: true
            }
          }
        }
      });

      if (!model) {
        throw new Error(`Model '${modelName}' not found`);
      }

      const nodes = model.variables.map(v => ({
        id: v.id,
        name: v.name,
        type: v.type,
        values: v.values,
        metadata: v.metadata,
        position3D: v.position3D ? v.position3D as { x: number; y: number; z: number } : undefined
      }));

      const edges = model.edges.map(e => ({
        id: e.id,
        source: e.source.name,
        target: e.target.name,
        type: e.type,
        metadata: e.metadata
      }));

      return { nodes, edges };
    } catch (error) {
      throw new Error(`Failed to get graph data for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveGraphLayout(modelName: string, nodePositions: Record<string, { x: number; y: number; z: number }>): Promise<void> {
    try {
      const model = await this.prisma.model.findUnique({
        where: { name: modelName }
      });

      if (!model) {
        throw new Error(`Model '${modelName}' not found`);
      }

      await this.prisma.graphLayout.upsert({
        where: { modelId: model.id },
        update: {
          nodePositions: nodePositions as any,
          updatedAt: new Date()
        },
        create: {
          modelId: model.id,
          nodePositions: nodePositions as any
        }
      });

      // Also update individual variable positions
      for (const [variableName, position] of Object.entries(nodePositions)) {
        await this.prisma.variable.updateMany({
          where: {
            modelId: model.id,
            name: variableName
          },
          data: {
            position3D: position as any
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to save graph layout for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Version control
  async createVersion(modelName: string, changelog?: string): Promise<string> {
    try {
      const model = await this.loadModel(modelName);
      const dbModel = await this.prisma.model.findUnique({
        where: { name: modelName }
      });

      if (!dbModel) {
        throw new Error(`Model '${modelName}' not found`);
      }

      // Generate next version number
      const latestVersion = await this.prisma.modelVersion.findFirst({
        where: { modelId: dbModel.id },
        orderBy: { createdAt: 'desc' }
      });

      const nextVersion = this.incrementVersion(latestVersion?.version || '1.0.0');

      await this.prisma.modelVersion.create({
        data: {
          modelId: dbModel.id,
          version: nextVersion,
          snapshot: model.toJSON() as any,
          changelog
        }
      });

      return nextVersion;
    } catch (error) {
      throw new Error(`Failed to create version for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }

  // Health check for monitoring
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        details: {
          connected: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// Enhanced MarketplaceAPI that uses database storage
export class DatabaseMarketplaceAPI extends MarketplaceAPI {
  private db: DatabaseStorage;

  constructor(db: DatabaseStorage) {
    super();
    this.db = db;
  }

  async searchModels(query: SearchQuery): Promise<SearchResult> {
    try {
      const where: any = {};
      const include = {
        model: {
          include: {
            variables: true,
            edges: true
          }
        }
      };

      // Build search filters
      if (query.text) {
        where.OR = [
          { model: { name: { contains: query.text, mode: 'insensitive' } } },
          { model: { description: { contains: query.text, mode: 'insensitive' } } },
          { tags: { hasSome: [query.text] } }
        ];
      }

      if (query.tags && query.tags.length > 0) {
        where.tags = { hasSome: query.tags };
      }

      if (query.category) {
        where.category = query.category;
      }

      if (query.author) {
        where.author = query.author;
      }

      if (query.minStars !== undefined) {
        where.stars = { gte: query.minStars };
      }

      if (query.license) {
        where.license = query.license;
      }

      // Execute query with pagination
      const [results, total] = await Promise.all([
        this.db['prisma'].marketplaceModel.findMany({
          where,
          include,
          orderBy: [
            { stars: 'desc' },
            { downloads: 'desc' },
            { publishedAt: 'desc' }
          ],
          skip: query.offset || 0,
          take: query.limit || 20
        }),
        this.db['prisma'].marketplaceModel.count({ where })
      ]);

      const models: MarketplaceModel[] = results.map(result => ({
        id: result.id,
        name: result.model.name,
        description: result.model.description,
        author: result.author,
        version: result.model.version,
        tags: result.tags,
        category: result.category,
        license: result.license,
        stars: result.stars,
        forks: result.forks,
        downloads: result.downloads,
        created: result.publishedAt,
        updated: result.model.updatedAt,
        model: Model.fromJSON({
          name: result.model.name,
          description: result.model.description,
          variables: result.model.variables.map(v => ({
            name: v.name,
            type: v.type as any,
            values: v.values as number[],
            metadata: v.metadata as any
          })),
          edges: result.model.edges.map(e => ({
            source: '', // Will be resolved by model loading
            target: '',
            type: e.type as any,
            metadata: e.metadata as any
          })),
          metadata: result.model.metadata as any
        }),
        dependencies: result.dependencies
      }));

      return {
        models,
        total,
        hasMore: (query.offset || 0) + (query.limit || 20) < total
      };
    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Bulk operations for GraphDiff support
  async applyGraphDiff(diff: any): Promise<any> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      return await this.prisma.$transaction(async (tx) => {
        const appliedChanges = {
          nodesAdded: 0,
          nodesModified: 0,
          nodesDeleted: 0,
          edgesAdded: 0,
          edgesModified: 0,
          edgesDeleted: 0,
        };

        // Get or create model
        let model = await tx.model.findUnique({
          where: { name: diff.modelName },
          include: { variables: true, edges: true }
        });

        if (!model) {
          model = await tx.model.create({
            data: {
              name: diff.modelName,
              description: `Model created from graph diff`,
              metadata: {},
            },
            include: { variables: true, edges: true }
          });
        }

        // Apply node changes
        // Delete nodes first
        for (const deletedNode of diff.changes.nodes.deleted) {
          await tx.variable.deleteMany({
            where: {
              modelId: model.id,
              name: deletedNode.name,
            }
          });
          appliedChanges.nodesDeleted++;
        }

        // Add new nodes
        for (const addedNode of diff.changes.nodes.added) {
          await tx.variable.create({
            data: {
              name: addedNode.name,
              type: addedNode.type,
              formula: addedNode.formula,
              values: addedNode.values || [],
              metadata: addedNode.metadata || {},
              position3D: addedNode.position3D,
              modelId: model.id,
            }
          });
          appliedChanges.nodesAdded++;
        }

        // Modify existing nodes
        for (const modifiedNode of diff.changes.nodes.modified) {
          await tx.variable.updateMany({
            where: {
              modelId: model.id,
              name: modifiedNode.old.name,
            },
            data: {
              name: modifiedNode.new.name,
              type: modifiedNode.new.type,
              formula: modifiedNode.new.formula,
              values: modifiedNode.new.values || [],
              metadata: modifiedNode.new.metadata || {},
              position3D: modifiedNode.new.position3D,
            }
          });
          appliedChanges.nodesModified++;
        }

        // Apply edge changes
        // Delete edges first
        for (const deletedEdge of diff.changes.edges.deleted) {
          await tx.edge.deleteMany({
            where: {
              modelId: model.id,
              OR: [
                { id: deletedEdge.id },
                { 
                  AND: [
                    { source: { name: deletedEdge.source } },
                    { target: { name: deletedEdge.target } },
                    { type: deletedEdge.type }
                  ]
                }
              ]
            }
          });
          appliedChanges.edgesDeleted++;
        }

        // Add new edges
        for (const addedEdge of diff.changes.edges.added) {
          // Find source and target variables
          const sourceVar = await tx.variable.findFirst({
            where: { modelId: model.id, name: addedEdge.source }
          });
          const targetVar = await tx.variable.findFirst({
            where: { modelId: model.id, name: addedEdge.target }
          });

          if (sourceVar && targetVar) {
            await tx.edge.create({
              data: {
                type: addedEdge.type,
                metadata: addedEdge.metadata || {},
                modelId: model.id,
                sourceId: sourceVar.id,
                targetId: targetVar.id,
              }
            });
            appliedChanges.edgesAdded++;
          }
        }

        // Modify existing edges
        for (const modifiedEdge of diff.changes.edges.modified) {
          const sourceVar = await tx.variable.findFirst({
            where: { modelId: model.id, name: modifiedEdge.new.source }
          });
          const targetVar = await tx.variable.findFirst({
            where: { modelId: model.id, name: modifiedEdge.new.target }
          });

          if (sourceVar && targetVar) {
            await tx.edge.updateMany({
              where: {
                modelId: model.id,
                source: { name: modifiedEdge.old.source },
                target: { name: modifiedEdge.old.target },
              },
              data: {
                type: modifiedEdge.new.type,
                metadata: modifiedEdge.new.metadata || {},
                sourceId: sourceVar.id,
                targetId: targetVar.id,
              }
            });
            appliedChanges.edgesModified++;
          }
        }

        return {
          appliedChanges,
          transactionId,
        };
      });
    } catch (error) {
      throw new Error(`Failed to apply graph diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async saveBackup(backupId: string, graphData: any): Promise<void> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      // Store backup in a simple JSON format in the database
      // In a real implementation, you might use a dedicated backup table
      await this.prisma.session.create({
        data: {
          id: backupId,
          userId: 'system',
          data: {
            type: 'backup',
            graphData,
            timestamp: new Date().toISOString(),
          },
        }
      });
    } catch (error) {
      throw new Error(`Failed to save backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async restoreBackup(backupId: string): Promise<any> {
    if (!this.prisma) {
      throw new Error('Database not initialized');
    }

    try {
      const backup = await this.prisma.session.findUnique({
        where: { id: backupId }
      });

      if (!backup || !backup.data || (backup.data as any).type !== 'backup') {
        throw new Error(`Backup ${backupId} not found`);
      }

      return (backup.data as any).graphData;
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}