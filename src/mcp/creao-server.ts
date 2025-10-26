#!/usr/bin/env node
/**
 * Creao MCP Server
 * Exposes VibeCast Framework System to AI models via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { GraphDiffService } from '../services/GraphDiffService.js';
import { DatabaseStorage } from '../storage/DatabaseStorage.js';

const prisma = new PrismaClient();
const dbStorage = new DatabaseStorage();
const graphDiffService = new GraphDiffService(dbStorage);

// Tool schemas
const ListFrameworksSchema = z.object({
  type: z.enum(['mathematical', 'knowledge', 'workflow', 'general']).optional(),
  visibility: z.enum(['public', 'private']).optional(),
});

const GetFrameworkSchema = z.object({
  name: z.string().describe('The name/ID of the framework'),
});

const CreateFrameworkSchema = z.object({
  name: z.string().describe('Unique name for the framework'),
  description: z.string().describe('Description of the framework'),
  type: z.enum(['mathematical', 'knowledge', 'workflow', 'general']),
  nodes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    metadata: z.record(z.any()).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number().optional(),
    }).optional(),
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    metadata: z.record(z.any()).optional(),
  })),
  visibility: z.enum(['public', 'private']).optional(),
});

const UpdateFrameworkSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const DeleteFrameworkSchema = z.object({
  name: z.string(),
});


const QueryGraphSchema = z.object({
  frameworkName: z.string(),
  query: z.object({
    nodeType: z.string().optional(),
    searchTerm: z.string().optional(),
  }).optional(),
});

const GenerateGraphDiffSchema = z.object({
  frameworkName: z.string().describe('The name of the framework to update'),
  graphData: z.object({
    model: z.object({
      name: z.string(),
      description: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    }).optional(),
    nodes: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string().optional(),
      formula: z.string().optional(),
      values: z.array(z.number()).optional(),
      content: z.string().optional(),
      position3D: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
      position2D: z.object({ x: z.number(), y: z.number() }).optional(),
      metadata: z.record(z.any()).optional(),
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      type: z.string().optional(),
      strength: z.number().optional(),
      weight: z.number().optional(),
      lag: z.number().optional(),
      confidence: z.number().optional(),
      formula: z.string().optional(),
      description: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })),
  }),
  options: z.object({
    validateOnly: z.boolean().optional(),
    includeWarnings: z.boolean().optional(),
    skipCycleDetection: z.boolean().optional(),
    compareMode: z.enum(['strict', 'lenient']).optional(),
  }).optional(),
});

const ApplyGraphDiffSchema = z.object({
  diff: z.any().describe('The diff object returned by generate_graph_diff'),
  options: z.object({
    dryRun: z.boolean().optional(),
    createBackup: z.boolean().optional(),
    continueOnError: z.boolean().optional(),
    batchSize: z.number().optional(),
  }).optional(),
});

/**
 * Create and configure the MCP server
 */
async function createServer() {
  const server = new Server(
    {
      name: 'creao-vibecast',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  /**
   * Tool: list_frameworks
   * List all available frameworks with optional filtering
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_frameworks',
          description: 'List all available frameworks with optional filtering by type or visibility',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['mathematical', 'knowledge', 'workflow', 'general'],
                description: 'Filter by framework type',
              },
              visibility: {
                type: 'string',
                enum: ['public', 'private'],
                description: 'Filter by visibility',
              },
            },
          },
        },
        {
          name: 'get_framework',
          description: 'Get detailed information about a specific framework including all nodes and edges',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'The name/ID of the framework',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'create_framework',
          description: 'Create a new framework with nodes and edges',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Unique name for the framework',
              },
              description: {
                type: 'string',
                description: 'Description of the framework',
              },
              type: {
                type: 'string',
                enum: ['mathematical', 'knowledge', 'workflow', 'general'],
                description: 'Type of framework',
              },
              nodes: {
                type: 'array',
                description: 'Array of nodes in the framework',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    type: { type: 'string' },
                    metadata: { type: 'object' },
                    position: {
                      type: 'object',
                      properties: {
                        x: { type: 'number' },
                        y: { type: 'number' },
                        z: { type: 'number' },
                      },
                    },
                  },
                  required: ['id', 'name', 'type'],
                },
              },
              edges: {
                type: 'array',
                description: 'Array of edges connecting nodes',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    source: { type: 'string' },
                    target: { type: 'string' },
                    metadata: { type: 'object' },
                  },
                  required: ['id', 'source', 'target'],
                },
              },
              visibility: {
                type: 'string',
                enum: ['public', 'private'],
                description: 'Visibility setting',
              },
            },
            required: ['name', 'description', 'type', 'nodes', 'edges'],
          },
        },
        {
          name: 'update_framework',
          description: 'Update an existing framework',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Framework name' },
              description: { type: 'string' },
              nodes: { type: 'array' },
              edges: { type: 'array' },
              metadata: { type: 'object' },
            },
            required: ['name'],
          },
        },
        {
          name: 'delete_framework',
          description: 'Delete a framework',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Framework name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'query_graph',
          description: 'Query a framework graph with filters (search nodes by type or term)',
          inputSchema: {
            type: 'object',
            properties: {
              frameworkName: { type: 'string' },
              query: {
                type: 'object',
                properties: {
                  nodeType: { type: 'string', description: 'Filter by node type' },
                  searchTerm: { type: 'string', description: 'Search in node names/metadata' },
                },
              },
            },
            required: ['frameworkName'],
          },
        },
        {
          name: 'get_stats',
          description: 'Get statistics about all frameworks',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'generate_graph_diff',
          description: 'Generate a diff between current framework and new graph data for bulk operations. This validates changes and returns a diff object.',
          inputSchema: {
            type: 'object',
            properties: {
              frameworkName: {
                type: 'string',
                description: 'The name of the framework to update',
              },
              graphData: {
                type: 'object',
                description: 'Complete graph data with nodes and edges',
                properties: {
                  model: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      metadata: { type: 'object' },
                    },
                  },
                  nodes: {
                    type: 'array',
                    description: 'Array of all nodes in the framework',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        values: { type: 'array', items: { type: 'number' } },
                        content: { type: 'string' },
                        position3D: { type: 'object' },
                        position2D: { type: 'object' },
                        metadata: { type: 'object' },
                      },
                      required: ['id', 'name'],
                    },
                  },
                  edges: {
                    type: 'array',
                    description: 'Array of all edges in the framework',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        source: { type: 'string' },
                        target: { type: 'string' },
                        type: { type: 'string' },
                        strength: { type: 'number' },
                        weight: { type: 'number' },
                        lag: { type: 'number' },
                        confidence: { type: 'number' },
                        description: { type: 'string' },
                        metadata: { type: 'object' },
                      },
                      required: ['id', 'source', 'target'],
                    },
                  },
                },
                required: ['nodes', 'edges'],
              },
              options: {
                type: 'object',
                description: 'Diff generation options',
                properties: {
                  validateOnly: { type: 'boolean' },
                  includeWarnings: { type: 'boolean' },
                  skipCycleDetection: { type: 'boolean' },
                  compareMode: { type: 'string', enum: ['strict', 'lenient'] },
                },
              },
            },
            required: ['frameworkName', 'graphData'],
          },
        },
        {
          name: 'apply_graph_diff',
          description: 'Apply a previously generated diff to update the framework with bulk operations. Use the diff object from generate_graph_diff.',
          inputSchema: {
            type: 'object',
            properties: {
              diff: {
                type: 'object',
                description: 'The diff object returned by generate_graph_diff',
              },
              options: {
                type: 'object',
                description: 'Apply options',
                properties: {
                  dryRun: { type: 'boolean', description: 'Only simulate the changes' },
                  createBackup: { type: 'boolean', description: 'Create a backup before applying' },
                  continueOnError: { type: 'boolean' },
                  batchSize: { type: 'number' },
                },
              },
            },
            required: ['diff'],
          },
        },
      ],
    };
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_frameworks': {
          const params = ListFrameworksSchema.parse(args || {});
          const where: any = {};
          if (params.type) where.type = params.type;
          if (params.visibility) where.visibility = params.visibility;

          const frameworks = await prisma.framework.findMany({
            where,
            select: {
              id: true,
              name: true,
              description: true,
              type: true,
              visibility: true,
              createdAt: true,
              updatedAt: true,
              metadata: true,
            },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(frameworks, null, 2),
              },
            ],
          };
        }

        case 'get_framework': {
          const params = GetFrameworkSchema.parse(args);
          const framework = await prisma.framework.findUnique({
            where: { name: params.name },
            include: {
              nodes: true,
              edges: {
                include: {
                  source: true,
                  target: true
                }
              },
              activities: {
                take: 10,
                orderBy: { createdAt: 'desc' }
              }
            }
          });

          if (!framework) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ error: 'Framework not found' }),
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(framework, null, 2),
              },
            ],
          };
        }

        case 'create_framework': {
          const params = CreateFrameworkSchema.parse(args);
          
          // Create framework first
          const framework = await prisma.framework.create({
            data: {
              name: params.name,
              description: params.description,
              type: params.type,
              visibility: params.visibility || 'private',
              nodeCount: params.nodes.length,
              edgeCount: params.edges.length,
              metadata: {},
            },
          });

          // Create nodes
          if (params.nodes.length > 0) {
            await prisma.frameworkNode.createMany({
              data: params.nodes.map((node: any) => ({
                frameworkId: framework.id,
                nodeId: node.id,
                name: node.name,
                type: node.type || 'scalar',
                metadata: node.metadata,
                position3D: node.position,
                position2D: node.position ? { x: node.position.x, y: node.position.y } : null,
              }))
            });
          }

          // Create edges
          if (params.edges.length > 0) {
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
              data: params.edges.map((edge: any) => ({
                frameworkId: framework.id,
                edgeId: edge.id,
                type: edge.type || 'dependency',
                metadata: edge.metadata,
                sourceId: nodeIdToDbId.get(edge.source),
                targetId: nodeIdToDbId.get(edge.target),
              }))
            });
          }

          // Log activity
          await prisma.frameworkActivity.create({
            data: {
              frameworkId: framework.id,
              type: 'created',
              description: `Framework ${params.name} created with ${params.nodes.length} nodes and ${params.edges.length} edges`
            }
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  framework: {
                    id: framework.id,
                    name: framework.name,
                    description: framework.description,
                    nodeCount: params.nodes.length,
                    edgeCount: params.edges.length,
                  },
                }),
              },
            ],
          };
        }

        case 'update_framework': {
          const params = UpdateFrameworkSchema.parse(args);
          const updateData: any = {};
          if (params.description) updateData.description = params.description;
          if (params.nodes) updateData.nodes = params.nodes;
          if (params.edges) updateData.edges = params.edges;
          if (params.metadata) updateData.metadata = params.metadata;

          const framework = await prisma.framework.update({
            where: { name: params.name },
            data: updateData,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, framework }),
              },
            ],
          };
        }

        case 'delete_framework': {
          const params = DeleteFrameworkSchema.parse(args);
          await prisma.framework.delete({
            where: { name: params.name },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Framework deleted' }),
              },
            ],
          };
        }



        case 'query_graph': {
          const params = QueryGraphSchema.parse(args);
          const framework = await prisma.framework.findUnique({
            where: { name: params.frameworkName },
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
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Framework not found' }) }],
              isError: true,
            };
          }

          let nodes = framework.nodes;
          
          if (params.query?.nodeType) {
            nodes = nodes.filter((n) => n.type === params.query!.nodeType);
          }

          if (params.query?.searchTerm) {
            const term = params.query.searchTerm.toLowerCase();
            nodes = nodes.filter(
              (n) =>
                n.name.toLowerCase().includes(term) ||
                JSON.stringify(n.metadata || {}).toLowerCase().includes(term)
            );
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ nodes, edges: framework.edges }, null, 2),
              },
            ],
          };
        }

        case 'get_stats': {
          const total = await prisma.framework.count();
          const byType = await prisma.framework.groupBy({
            by: ['type'],
            _count: true,
          });
          const byVisibility = await prisma.framework.groupBy({
            by: ['visibility'],
            _count: true,
          });

          const stats = {
            total,
            byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
            byVisibility: Object.fromEntries(byVisibility.map((v) => [v.visibility, v._count])),
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        }

        case 'generate_graph_diff': {
          const params = GenerateGraphDiffSchema.parse(args);
          
          const diff = await graphDiffService.generateDiff(
            params.frameworkName,
            params.graphData,
            params.options || {}
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(diff, null, 2),
              },
            ],
          };
        }

        case 'apply_graph_diff': {
          const params = ApplyGraphDiffSchema.parse(args);
          
          const result = await graphDiffService.applyDiff(
            params.diff,
            params.options || {}
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: `Unknown tool: ${name}` }),
              },
            ],
            isError: true,
          };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              details: error.toString(),
            }),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * List resources (frameworks as resources)
   */
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const frameworks = await prisma.framework.findMany({
      select: {
        name: true,
        description: true,
        type: true,
      },
    });

    return {
      resources: frameworks.map((f) => ({
        uri: `framework://${f.name}`,
        name: f.name,
        description: f.description,
        mimeType: 'application/json',
      })),
    };
  });

  /**
   * Read a specific resource
   */
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const match = uri.match(/^framework:\/\/(.+)$/);

    if (!match) {
      throw new Error('Invalid resource URI');
    }

    const frameworkName = match[1];
    const framework = await prisma.framework.findUnique({
      where: { name: frameworkName },
    });

    if (!framework) {
      throw new Error('Framework not found');
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(framework, null, 2),
        },
      ],
    };
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🤖 Creao MCP Server running on stdio');
  console.error('📊 VibeCast Framework System connected');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
