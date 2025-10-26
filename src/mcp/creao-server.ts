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

const prisma = new PrismaClient();

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

const AddNodeSchema = z.object({
  frameworkName: z.string(),
  node: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    metadata: z.record(z.any()).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number().optional(),
    }).optional(),
  }),
});

const AddEdgeSchema = z.object({
  frameworkName: z.string(),
  edge: z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    metadata: z.record(z.any()).optional(),
  }),
});

const QueryGraphSchema = z.object({
  frameworkName: z.string(),
  query: z.object({
    nodeType: z.string().optional(),
    searchTerm: z.string().optional(),
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
          name: 'add_node',
          description: 'Add a new node to an existing framework',
          inputSchema: {
            type: 'object',
            properties: {
              frameworkName: { type: 'string' },
              node: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  type: { type: 'string' },
                  metadata: { type: 'object' },
                  position: { type: 'object' },
                },
                required: ['id', 'name', 'type'],
              },
            },
            required: ['frameworkName', 'node'],
          },
        },
        {
          name: 'add_edge',
          description: 'Add a new edge to an existing framework',
          inputSchema: {
            type: 'object',
            properties: {
              frameworkName: { type: 'string' },
              edge: {
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
            required: ['frameworkName', 'edge'],
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
          const framework = await prisma.framework.create({
            data: {
              name: params.name,
              description: params.description,
              type: params.type,
              nodes: params.nodes as any,
              edges: params.edges as any,
              visibility: params.visibility || 'private',
              metadata: {},
            },
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

        case 'add_node': {
          const params = AddNodeSchema.parse(args);
          const framework = await prisma.framework.findUnique({
            where: { name: params.frameworkName },
          });

          if (!framework) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Framework not found' }) }],
              isError: true,
            };
          }

          const nodes = framework.nodes as any[];
          nodes.push(params.node);

          await prisma.framework.update({
            where: { name: params.frameworkName },
            data: { nodes: nodes as any },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Node added' }),
              },
            ],
          };
        }

        case 'add_edge': {
          const params = AddEdgeSchema.parse(args);
          const framework = await prisma.framework.findUnique({
            where: { name: params.frameworkName },
          });

          if (!framework) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Framework not found' }) }],
              isError: true,
            };
          }

          const edges = framework.edges as any[];
          edges.push(params.edge);

          await prisma.framework.update({
            where: { name: params.frameworkName },
            data: { edges: edges as any },
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, message: 'Edge added' }),
              },
            ],
          };
        }

        case 'query_graph': {
          const params = QueryGraphSchema.parse(args);
          const framework = await prisma.framework.findUnique({
            where: { name: params.frameworkName },
          });

          if (!framework) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ error: 'Framework not found' }) }],
              isError: true,
            };
          }

          let nodes = framework.nodes as any[];
          
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
