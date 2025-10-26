import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge, EdgeType } from '../models/Edge.js';
import { ModelGraph } from '../models/ModelGraph.js';
import { EvaluationEngine } from '../engine/EvaluationEngine.js';
import { DatabaseStorage, DatabaseMarketplaceAPI } from '../storage/DatabaseStorage.js';
import { DependencyGraph } from '../graph/DependencyGraph.js';
import { MarketplaceAPI } from '../marketplace/MarketplaceAPI.js';

export class ModelitMCPServer {
  private server: Server;
  private currentModel: Model | null = null;
  private engine: EvaluationEngine;
  private dbStorage: DatabaseStorage;
  private graph: DependencyGraph;
  private marketplace: MarketplaceAPI;
  private currentModelGraph: ModelGraph | null = null;

  constructor(databaseUrl: string) {
    this.server = new Server(
      {
        name: 'modelit-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.engine = new EvaluationEngine();
    
    this.dbStorage = new DatabaseStorage({ databaseUrl });
    
    this.graph = new DependencyGraph();
    this.marketplace = new DatabaseMarketplaceAPI(this.dbStorage);

    this.setupHandlers();
  }

  // Initialize database connection
  async initialize(): Promise<void> {
    await this.dbStorage.initialize();
  }

  // Get database storage
  private getStorage(): DatabaseStorage {
    return this.dbStorage;
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.dbStorage.disconnect();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_model',
          description: 'Create a new mathematical model',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Model name' },
              description: { type: 'string', description: 'Model description' },
            },
            required: ['name'],
          },
        },
        {
          name: 'load_model',
          description: 'Load an existing model from storage',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Model name to load' },
            },
            required: ['name'],
          },
        },
        {
          name: 'save_model',
          description: 'Save the current model to storage',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Model name (optional, uses current model name if not provided)' },
            },
          },
        },
        {
          name: 'list_models',
          description: 'List all available models in storage',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_variable',
          description: 'Add a new variable to the current model (formulas automatically create edges to referenced variables)',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name' },
              type: { type: 'string', description: 'Variable type (scalar, series, parameter)' },
              formula: { type: 'string', description: 'Mathematical formula referencing other variables (optional for parameters)' },
              metadata: {
                type: 'object',
                properties: {
                  units: { type: 'string', description: 'Units of measurement' },
                  description: { type: 'string', description: 'Description of what this variable represents' },
                  source: { type: 'string', description: 'Data source or origin' },
                },
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'update_variable',
          description: 'Update an existing variable in the current model',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name to update' },
              formula: { type: 'string', description: 'New formula' },
              values: { type: 'array', items: { type: 'number' }, description: 'New values' },
              metadata: { type: 'object', description: 'New metadata' },
            },
            required: ['name'],
          },
        },
        {
          name: 'list_variables',
          description: 'List all variables in the current model',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_variable',
          description: 'Get detailed information about a specific variable',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name' },
            },
            required: ['name'],
          },
        },
        {
          name: 'evaluate_model',
          description: 'Evaluate the current model for specified time steps',
          inputSchema: {
            type: 'object',
            properties: {
              timeSteps: { type: 'number', description: 'Number of time steps to evaluate' },
            },
            required: ['timeSteps'],
          },
        },
        {
          name: 'evaluate_variable',
          description: 'Evaluate a specific variable and its dependencies',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name to evaluate' },
              timeSteps: { type: 'number', description: 'Number of time steps' },
            },
            required: ['name', 'timeSteps'],
          },
        },
        {
          name: 'get_dependencies',
          description: 'Get dependency information for variables',
          inputSchema: {
            type: 'object',
            properties: {
              variable: { type: 'string', description: 'Specific variable name (optional)' },
            },
          },
        },
        {
          name: 'get_graph',
          description: 'Get the complete dependency graph structure',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'validate_model',
          description: 'Validate the current model for errors and circular dependencies',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'create_edge',
          description: 'Create a dependency relationship between variables',
          inputSchema: {
            type: 'object',
            properties: {
              source: { type: 'string', description: 'Source variable name' },
              target: { type: 'string', description: 'Target variable name' },
              type: { type: 'string', description: 'Edge type (dependency, temporal, causal, derived, constraint)' },
              strength: { type: 'number', description: 'Relationship strength 0-1 (optional)' },
              lag: { type: 'number', description: 'Time lag for temporal relationships (optional)' }
            },
            required: ['source', 'target', 'type'],
          },
        },
        {
          name: 'search_marketplace',
          description: 'Search for models in the Context Marketplace',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Search text' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
              category: { type: 'string', description: 'Filter by category' },
              author: { type: 'string', description: 'Filter by author' },
              limit: { type: 'number', description: 'Maximum results (default: 10)' }
            },
          },
        },
        {
          name: 'publish_model',
          description: 'Publish current model to the Context Marketplace',
          inputSchema: {
            type: 'object',
            properties: {
              tags: { type: 'array', items: { type: 'string' }, description: 'Model tags' },
              category: { type: 'string', description: 'Model category' },
              license: { type: 'string', description: 'License (default: MIT)' }
            },
          },
        },
        {
          name: 'import_model',
          description: 'Import a model from the Context Marketplace',
          inputSchema: {
            type: 'object',
            properties: {
              modelId: { type: 'string', description: 'Marketplace model ID' },
              prefix: { type: 'string', description: 'Prefix for imported variables (optional)' }
            },
            required: ['modelId'],
          },
        },
        {
          name: 'get_graph_stats',
          description: 'Get advanced graph statistics for the current model',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_graph_data',
          description: 'Get 3D graph data for visualization with node positions and edge connections',
          inputSchema: {
            type: 'object',
            properties: {
              modelName: { type: 'string', description: 'Model name (optional, uses current model if not provided)' }
            },
          },
        },
        {
          name: 'save_graph_layout',
          description: 'Save 3D node positions for the current model',
          inputSchema: {
            type: 'object',
            properties: {
              nodePositions: { 
                type: 'object', 
                description: 'Map of variable names to {x, y, z} positions' 
              },
              modelName: { type: 'string', description: 'Model name (optional, uses current model if not provided)' }
            },
            required: ['nodePositions'],
          },
        },
        {
          name: 'query_models',
          description: 'Advanced database query for models with filters and pagination',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Text search query' },
              author: { type: 'string', description: 'Filter by author' },
              category: { type: 'string', description: 'Filter by category' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
              minStars: { type: 'number', description: 'Minimum star count' },
              limit: { type: 'number', description: 'Number of results to return', default: 20 },
              offset: { type: 'number', description: 'Offset for pagination', default: 0 }
            },
          },
        },
        {
          name: 'create_model_version',
          description: 'Create a new version of the current model for version control',
          inputSchema: {
            type: 'object',
            properties: {
              changelog: { type: 'string', description: 'Description of changes in this version' },
              modelName: { type: 'string', description: 'Model name (optional, uses current model if not provided)' }
            },
          },
        },
        {
          name: 'load_graph_json',
          description: 'Load complete graph structure in JSON format for LLM processing',
          inputSchema: {
            type: 'object',
            properties: {
              modelName: { type: 'string', description: 'Model name (optional, uses current model if not provided)' },
              includeValues: { type: 'boolean', description: 'Include variable values in output (default: true)' },
              includeMetadata: { type: 'boolean', description: 'Include metadata in output (default: true)' }
            },
          },
        },
        {
          name: 'update_graph_json',
          description: 'Update graph structure from JSON data provided by LLM',
          inputSchema: {
            type: 'object',
            properties: {
              graphData: { 
                type: 'object', 
                description: 'Complete graph structure with variables and edges',
                properties: {
                  variables: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string', description: 'Variable type (scalar, series, parameter)' },
                        formula: { type: 'string' },
                        values: { type: 'array', items: { type: 'number' } },
                        metadata: { type: 'object' }
                      },
                      required: ['name']
                    }
                  },
                  edges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        source: { type: 'string' },
                        target: { type: 'string' },
                        type: { type: 'string', description: 'Edge type (dependency, temporal, causal, derived, constraint)' },
                        metadata: { type: 'object' }
                      },
                      required: ['id', 'source', 'target', 'type']
                    }
                  }
                }
              },
              modelName: { type: 'string', description: 'Model name (optional, uses current model if not provided)' },
              validateOnly: { type: 'boolean', description: 'Only validate the JSON without applying changes (default: false)' }
            },
            required: ['graphData']
          },
        },
        {
          name: 'validate_graph_json',
          description: 'Validate graph JSON data structure and dependencies',
          inputSchema: {
            type: 'object',
            properties: {
              graphData: { 
                type: 'object', 
                description: 'Graph structure to validate',
                properties: {
                  variables: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string', description: 'Variable type (scalar, series, parameter)' },
                        formula: { type: 'string' },
                        values: { type: 'array', items: { type: 'number' } },
                        metadata: { type: 'object' }
                      },
                      required: ['name']
                    }
                  },
                  edges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        source: { type: 'string' },
                        target: { type: 'string' },
                        type: { type: 'string', description: 'Edge type (dependency, temporal, causal, derived, constraint)' },
                        metadata: { type: 'object' }
                      },
                      required: ['id', 'source', 'target', 'type']
                    }
                  }
                }
              }
            },
            required: ['graphData']
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_model':
            return await this.handleCreateModel(args);
          case 'load_model':
            return await this.handleLoadModel(args);
          case 'save_model':
            return await this.handleSaveModel(args);
          case 'list_models':
            return await this.handleListModels();
          case 'create_variable':
            return await this.handleCreateVariable(args);
          case 'update_variable':
            return await this.handleUpdateVariable(args);
          case 'list_variables':
            return await this.handleListVariables();
          case 'get_variable':
            return await this.handleGetVariable(args);
          case 'evaluate_model':
            return await this.handleEvaluateModel(args);
          case 'evaluate_variable':
            return await this.handleEvaluateVariable(args);
          case 'get_dependencies':
            return await this.handleGetDependencies(args);
          case 'get_graph':
            return await this.handleGetGraph();
          case 'validate_model':
            return await this.handleValidateModel();
          case 'create_edge':
            return await this.handleCreateEdge(args);
          case 'search_marketplace':
            return await this.handleSearchMarketplace(args);
          case 'publish_model':
            return await this.handlePublishModel(args);
          case 'import_model':
            return await this.handleImportModel(args);
          case 'get_graph_stats':
            return await this.handleGetGraphStats();
          case 'get_graph_data':
            return await this.handleGetGraphData(args);
          case 'save_graph_layout':
            return await this.handleSaveGraphLayout(args);
          case 'query_models':
            return await this.handleQueryModels(args);
          case 'create_model_version':
            return await this.handleCreateModelVersion(args);
          case 'load_graph_json':
            return await this.handleLoadGraphJson(args);
          case 'update_graph_json':
            return await this.handleUpdateGraphJson(args);
          case 'validate_graph_json':
            return await this.handleValidateGraphJson(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleCreateModel(args: any) {
    const { name, description } = args;
    
    this.currentModel = new Model({
      name,
      description,
      metadata: {
        created: new Date(),
        version: '1.0.0',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created new model: ${name}${description ? ` - ${description}` : ''}`,
        },
      ],
    };
  }

  private async handleLoadModel(args: any) {
    const { name } = args;
    
    this.currentModel = await this.getStorage().loadModel(name);
    
    return {
      content: [
        {
          type: 'text',
          text: `Loaded model: ${this.currentModel.name} (${this.currentModel.listVariables().length} variables)`,
        },
      ],
    };
  }

  private async handleSaveModel(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model to save');
    }

    const modelName = args.name || this.currentModel.name;
    const modelToSave = args.name ? 
      new Model({ ...this.currentModel.toJSON(), name: modelName }) : 
      this.currentModel;

    await this.getStorage().saveModel(modelToSave);
    
    return {
      content: [
        {
          type: 'text',
          text: `Saved model: ${modelName}`,
        },
      ],
    };
  }

  private async handleListModels() {
    const models = await this.getStorage().listModels();
    
    return {
      content: [
        {
          type: 'text',
          text: models.length > 0 ? 
            `Available models:\n${models.map(name => `- ${name}`).join('\n')}` :
            'No models found in storage',
        },
      ],
    };
  }

  private async handleCreateVariable(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    // Remove values from args - values should be applied during evaluation, not stored with model
    const { values, ...variableArgs } = args;
    
    if (values) {
      throw new Error('Variables cannot have values. Values are applied during model evaluation, not stored with the model structure.');
    }

    // If the variable has a formula, extract dependencies and set them
    if (variableArgs.formula) {
      const referencedVars = this.extractVariableReferences(variableArgs.formula);
      console.error(`Creating variable ${variableArgs.name} with formula: ${variableArgs.formula}`);
      console.error(`Referenced variables: ${referencedVars.join(', ')}`);
      
      // Set the dependencies on the variable
      variableArgs.dependencies = referencedVars;
    }

    const variable = new Variable(variableArgs);
    this.currentModel.addVariable(variable);
    
    // If the variable has a formula, automatically create edges to referenced variables
    if (variable.formula) {
      for (const refVar of variable.dependencies) {
        // Check if the referenced variable exists in the model
        if (this.currentModel.getVariable(refVar)) {
          console.error(`Creating edge from ${refVar} to ${variable.name}`);
          // Create an edge from the referenced variable to this variable
          const edge = new Edge({
            id: `${refVar}_to_${variable.name}`,
            source: refVar,
            target: variable.name,
            type: 'dependency',
            metadata: {
              description: `Dependency: ${variable.name} depends on ${refVar}`,
              strength: 1.0,
              confidence: 1.0
            }
          });
          this.currentModel.addEdge(edge);
        } else {
          console.error(`Referenced variable ${refVar} not found in model`);
        }
      }
      
      // Refresh the model graph after adding edges
      this.refreshModelGraph();
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Created variable: ${variable.name} (${variable.type})${variable.formula ? ` = ${variable.formula}` : ''}${variable.metadata?.description ? ` - ${variable.metadata.description}` : ''}`,
        },
      ],
    };
  }

  private async handleUpdateVariable(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { name, ...updates } = args;
    this.currentModel.updateVariable(name, updates);
    
    return {
      content: [
        {
          type: 'text',
          text: `Updated variable: ${name}`,
        },
      ],
    };
  }

  private async handleListVariables() {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const variables = this.currentModel.listVariables();
    
    if (variables.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No variables in current model',
          },
        ],
      };
    }

    const variableList = variables.map((v: any) => {
      const formula = v.formula ? ` = ${v.formula}` : '';
      const deps = v.dependencies.length > 0 ? ` (depends on: ${v.dependencies.join(', ')})` : '';
      return `- ${v.name}${formula}${deps}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Variables in ${this.currentModel.name}:\n${variableList}`,
        },
      ],
    };
  }

  private async handleGetVariable(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { name } = args;
    const variable = this.currentModel.getVariable(name);
    
    if (!variable) {
      throw new Error(`Variable '${name}' not found`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(variable.toJSON(), null, 2),
        },
      ],
    };
  }

  private async handleEvaluateModel(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { timeSteps } = args;
    const result = await this.engine.evaluateModel(this.currentModel, timeSteps);
    
    if (!result.success) {
      throw new Error(`Evaluation failed: ${result.errors.join(', ')}`);
    }

    const summary = Object.entries(result.values)
      .map(([name, values]) => `${name}: [${values.join(', ')}]`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Model evaluation completed in ${result.executionTime}ms:\n${summary}`,
        },
      ],
    };
  }

  private async handleEvaluateVariable(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { name, timeSteps } = args;
    const result = await this.engine.evaluateVariable(this.currentModel, name, timeSteps);
    
    if (result.errors.length > 0) {
      throw new Error(`Evaluation failed: ${result.errors.join(', ')}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `${name}: [${result.values.join(', ')}]`,
        },
      ],
    };
  }

  private async handleGetDependencies(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { variable } = args;
    
    if (variable) {
      const deps = this.currentModel.getDependencies(variable);
      const dependents = this.currentModel.getDependents(variable);
      
      return {
        content: [
          {
            type: 'text',
            text: `Dependencies for ${variable}:\n` +
                  `Depends on: [${deps.map((d: any) => d.name).join(', ')}]\n` +
                  `Required by: [${dependents.map((d: any) => d.name).join(', ')}]`,
          },
        ],
      };
    } else {
      // Return all dependencies
      this.graph.buildFromModel(this.currentModel);
      const nodes = this.graph.getAllNodes();
      
      const depInfo = nodes.map(node => 
        `${node.name}: depends on [${node.dependencies.join(', ')}], required by [${node.dependents.join(', ')}]`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `All variable dependencies:\n${depInfo}`,
          },
        ],
      };
    }
  }

  private async handleGetGraph() {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    this.graph.buildFromModel(this.currentModel);
    const graphData = this.graph.toJSON();
    const stats = this.graph.getStatistics();
    
    return {
      content: [
        {
          type: 'text',
          text: `Dependency Graph Statistics:\n` +
                `- Nodes: ${stats.nodeCount}\n` +
                `- Edges: ${stats.edgeCount}\n` +
                `- Max Level: ${stats.maxLevel}\n` +
                `- Time-dependent variables: ${stats.timeDependentNodes}\n` +
                `- Cycles: ${stats.cycleCount}\n\n` +
                `Graph structure:\n${JSON.stringify(graphData, null, 2)}`,
        },
      ],
    };
  }

  private async handleValidateModel() {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const validation = this.currentModel.validateModel();
    this.graph.buildFromModel(this.currentModel);
    const cycles = this.graph.findCycles();
    
    const isValid = validation.isValid && cycles.length === 0;
    const allErrors = [...validation.errors];
    
    if (cycles.length > 0) {
      allErrors.push(`Circular dependencies: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: isValid ? 
            `Model '${this.currentModel.name}' is valid` :
            `Model validation failed:\n${allErrors.join('\n')}`,
        },
      ],
    };
  }

  // New marketplace and graph handlers
  private async handleCreateEdge(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { source, target, type, strength, lag } = args;
    
    const edge = new Edge({
      id: Edge.generateId(source, target, type),
      source,
      target,
      type,
      metadata: {
        strength,
        lag,
        created: new Date()
      }
    });

    this.currentModel.addEdge(edge);
    this.refreshModelGraph();

    return {
      content: [
        {
          type: 'text',
          text: `Created edge from ${source} to ${target} (type: ${type})`,
        },
      ],
    };
  }

  private async handleSearchMarketplace(args: any) {
    const { text, tags, category, author, limit = 10 } = args;
    
    const results = await this.marketplace.searchModels({
      text,
      tags,
      category,
      author,
      limit
    });

    const modelList = results.models.map(model => 
      `- ${model.name} v${model.version} by ${model.author} (⭐ ${model.stars})`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.models.length} models:\n${modelList || 'No models found'}`,
        },
      ],
    };
  }

  private async handlePublishModel(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { tags = [], category = 'general', license = 'MIT' } = args;

    // Update model metadata for publishing
    if (!this.currentModel.metadata) this.currentModel.metadata = {};
    this.currentModel.metadata.tags = tags;
    this.currentModel.metadata.category = category;
    this.currentModel.metadata.license = license;
    this.currentModel.metadata.author = 'user'; // In real implementation, get from auth

    const modelId = await this.marketplace.publishModel(this.currentModel, 'user');

    return {
      content: [
        {
          type: 'text',
          text: `Successfully published model '${this.currentModel.name}' to marketplace with ID: ${modelId}`,
        },
      ],
    };
  }

  private async handleImportModel(args: any) {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    const { modelId, prefix } = args;
    
    const importedModel = await this.marketplace.downloadModel(modelId);
    if (!importedModel) {
      throw new Error(`Model with ID '${modelId}' not found in marketplace`);
    }

    this.currentModel.mergeModel(importedModel, prefix);
    this.refreshModelGraph();

    return {
      content: [
        {
          type: 'text',
          text: `Successfully imported model '${importedModel.name}' ${prefix ? `with prefix '${prefix}'` : ''}`,
        },
      ],
    };
  }

  private async handleGetGraphStats() {
    if (!this.currentModel) {
      throw new Error('No current model. Create or load a model first.');
    }

    this.refreshModelGraph();
    
    if (!this.currentModelGraph) {
      throw new Error('Failed to create model graph');
    }

    const stats = this.currentModelGraph.getStatistics();
    const cycles = this.currentModelGraph.findCycles();
    const topOrder = this.currentModelGraph.getTopologicalOrder();

    const statsText = `Graph Statistics:
- Nodes: ${stats.nodeCount}
- Edges: ${stats.edgeCount}
- Max Evaluation Level: ${stats.maxLevel}
- Cycles: ${stats.cycleCount}
- Strongly Connected Components: ${stats.stronglyConnectedComponents}
- Time-dependent Variables: ${stats.timeDependentNodes}
- Isolated Variables: ${stats.isolatedNodes}
- Can Evaluate: ${topOrder.canEvaluate ? 'Yes' : 'No'}

${cycles.length > 0 ? `Cycles found:\n${cycles.map(cycle => `- ${cycle.join(' → ')}`).join('\n')}` : 'No cycles detected'}`;

    return {
      content: [
        {
          type: 'text',
          text: statsText,
        },
      ],
    };
  }

  // New handlers for 3D visualization and database functionality
  private async handleGetGraphData(args: any) {
    const modelName = args.modelName || this.currentModel?.name;
    if (!modelName) {
      throw new Error('No model specified and no current model loaded');
    }

    const graphData = await this.dbStorage.getGraphData(modelName);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(graphData, null, 2),
        },
      ],
    };
  }

  private async handleSaveGraphLayout(args: any) {
    const { nodePositions, modelName } = args;
    const targetModelName = modelName || this.currentModel?.name;
    
    if (!targetModelName) {
      throw new Error('No model specified and no current model loaded');
    }

    await this.dbStorage.saveGraphLayout(targetModelName, nodePositions);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully saved 3D layout for model '${targetModelName}'`,
        },
      ],
    };
  }

  private async handleQueryModels(args: any) {
    // Use database marketplace for advanced queries
    const searchResult = await (this.marketplace as DatabaseMarketplaceAPI).searchModels(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            models: searchResult.models.map(m => ({
              id: m.id,
              name: m.name,
              description: m.description,
              author: m.author,
              tags: m.tags,
              category: m.category,
              stars: m.stars,
              forks: m.forks,
              downloads: m.downloads
            })),
            total: searchResult.total,
            hasMore: searchResult.hasMore
          }, null, 2),
        },
      ],
    };
  }

  private async handleCreateModelVersion(args: any) {
    const { changelog, modelName } = args;
    const targetModelName = modelName || this.currentModel?.name;
    
    if (!targetModelName) {
      throw new Error('No model specified and no current model loaded');
    }

    const version = await this.dbStorage.createVersion(targetModelName, changelog);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created version ${version} for model '${targetModelName}'`,
        },
      ],
    };
  }

  // New JSON graph handlers
  private async handleLoadGraphJson(args: any) {
    const { modelName, includeValues = true, includeMetadata = true } = args;
    const targetModelName = modelName || this.currentModel?.name;
    
    if (!targetModelName) {
      throw new Error('No model specified and no current model loaded');
    }

    let model: Model;
    if (targetModelName === this.currentModel?.name) {
      model = this.currentModel;
    } else {
      model = await this.getStorage().loadModel(targetModelName);
    }

    const variables = model.listVariables().map(variable => {
      const varData: any = {
        name: variable.name,
        type: variable.type,
        formula: variable.formula,
        dependencies: variable.dependencies
      };

      if (includeValues && variable.values) {
        varData.values = variable.values;
      }

      if (includeMetadata && variable.metadata) {
        varData.metadata = variable.metadata;
      }

      return varData;
    });

    const edges = model.listEdges().map(edge => {
      const edgeData: any = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type
      };

      if (includeMetadata && edge.metadata) {
        edgeData.metadata = edge.metadata;
      }

      return edgeData;
    });

    const graphData = {
      model: {
        name: model.name,
        description: model.description,
        metadata: includeMetadata ? model.metadata : undefined
      },
      variables,
      edges,
      statistics: this.getGraphStatistics(model)
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(graphData, null, 2),
        },
      ],
    };
  }

  private async handleUpdateGraphJson(args: any) {
    const { graphData, modelName, validateOnly = false } = args;
    const targetModelName = modelName || this.currentModel?.name;
    
    if (!targetModelName) {
      throw new Error('No model specified and no current model loaded');
    }

    // Validate the JSON structure first
    const validation = this.validateGraphJsonData(graphData);
    if (!validation.isValid) {
      throw new Error(`Graph JSON validation failed: ${validation.errors.join(', ')}`);
    }

    if (validateOnly) {
      return {
        content: [
          {
            type: 'text',
            text: 'Graph JSON validation passed successfully',
          },
        ],
      };
    }

    // Load or create the model
    let model: Model;
    if (targetModelName === this.currentModel?.name) {
      model = this.currentModel;
    } else {
      try {
        model = await this.getStorage().loadModel(targetModelName);
      } catch {
        // Create new model if it doesn't exist
        model = new Model({
          name: targetModelName,
          description: graphData.model?.description || 'Model created from JSON',
          metadata: {
            created: new Date(),
            version: '1.0.0',
            ...graphData.model?.metadata
          }
        });
      }
    }

    // Clear existing variables and edges
    const existingVariables = model.listVariables();
    const existingEdges = model.listEdges();
    
    for (const variable of existingVariables) {
      model.removeVariable(variable.name);
    }
    
    for (const edge of existingEdges) {
      model.removeEdge(edge.id);
    }

    // Add variables from JSON in dependency order
    const variablesToAdd = graphData.variables.map(varData => ({
      name: varData.name,
      type: varData.type || 'scalar',
      formula: varData.formula,
      dependencies: varData.dependencies || [],
      values: varData.values,
      metadata: varData.metadata
    }));

    // Sort variables by dependency order (parameters first, then computed variables)
    const sortedVariables = this.sortVariablesByDependencies(variablesToAdd);
    
    for (const varData of sortedVariables) {
      const variable = new Variable(varData);
      model.addVariable(variable);
    }

    // Add edges from JSON
    for (const edgeData of graphData.edges) {
      const edge = new Edge({
        id: edgeData.id,
        source: edgeData.source,
        target: edgeData.target,
        type: edgeData.type,
        metadata: edgeData.metadata
      });
      model.addEdge(edge);
    }

    // Update model metadata if provided
    if (graphData.model?.metadata) {
      model.metadata = { ...model.metadata, ...graphData.model.metadata };
    }

    // Set as current model
    this.currentModel = model;
    this.refreshModelGraph();

    // Save the updated model
    await this.getStorage().saveModel(model);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated model '${targetModelName}' from JSON data. Added ${graphData.variables.length} variables and ${graphData.edges.length} edges.`,
        },
      ],
    };
  }

  private async handleValidateGraphJson(args: any) {
    const { graphData } = args;
    
    const validation = this.validateGraphJsonData(graphData);
    
    return {
      content: [
        {
          type: 'text',
          text: validation.isValid ? 
            'Graph JSON validation passed successfully' :
            `Graph JSON validation failed:\n${validation.errors.join('\n')}`,
        },
      ],
    };
  }

  private validateGraphJsonData(graphData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate structure
    if (!graphData || typeof graphData !== 'object') {
      errors.push('Graph data must be an object');
      return { isValid: false, errors };
    }

    if (!Array.isArray(graphData.variables)) {
      errors.push('Variables must be an array');
    }

    if (!Array.isArray(graphData.edges)) {
      errors.push('Edges must be an array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Validate variables
    const variableNames = new Set<string>();
    for (const [index, variable] of graphData.variables.entries()) {
      if (!variable.name || typeof variable.name !== 'string') {
        errors.push(`Variable ${index}: name is required and must be a string`);
        continue;
      }

      if (variableNames.has(variable.name)) {
        errors.push(`Variable ${index}: duplicate name '${variable.name}'`);
      }
      variableNames.add(variable.name);

      if (variable.type && !['scalar', 'series', 'parameter'].includes(variable.type)) {
        errors.push(`Variable '${variable.name}': type must be 'scalar', 'series', or 'parameter'`);
      }

      if (variable.values && !Array.isArray(variable.values)) {
        errors.push(`Variable '${variable.name}': values must be an array of numbers`);
      }

      if (variable.dependencies && !Array.isArray(variable.dependencies)) {
        errors.push(`Variable '${variable.name}': dependencies must be an array of strings`);
      }
    }

    // Validate edges
    const edgeIds = new Set<string>();
    for (const [index, edge] of graphData.edges.entries()) {
      if (!edge.id || typeof edge.id !== 'string') {
        errors.push(`Edge ${index}: id is required and must be a string`);
        continue;
      }

      if (edgeIds.has(edge.id)) {
        errors.push(`Edge ${index}: duplicate id '${edge.id}'`);
      }
      edgeIds.add(edge.id);

      if (!edge.source || typeof edge.source !== 'string') {
        errors.push(`Edge '${edge.id}': source is required and must be a string`);
      }

      if (!edge.target || typeof edge.target !== 'string') {
        errors.push(`Edge '${edge.id}': target is required and must be a string`);
      }

      if (!edge.type || !['dependency', 'temporal', 'causal', 'derived', 'constraint'].includes(edge.type)) {
        errors.push(`Edge '${edge.id}': type must be one of: dependency, temporal, causal, derived, constraint`);
      }

      // Check if source and target variables exist
      if (edge.source && !variableNames.has(edge.source)) {
        errors.push(`Edge '${edge.id}': source variable '${edge.source}' not found in variables`);
      }

      if (edge.target && !variableNames.has(edge.target)) {
        errors.push(`Edge '${edge.id}': target variable '${edge.target}' not found in variables`);
      }
    }

    // Validate variable dependencies
    for (const variable of graphData.variables) {
      if (variable.dependencies) {
        for (const dep of variable.dependencies) {
          if (!variableNames.has(dep)) {
            errors.push(`Variable '${variable.name}': dependency '${dep}' not found in variables`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private sortVariablesByDependencies(variables: any[]): any[] {
    const sorted: any[] = [];
    const remaining = [...variables];
    const added = new Set<string>();

    // First pass: add all parameters (no dependencies)
    for (let i = remaining.length - 1; i >= 0; i--) {
      const variable = remaining[i];
      if (variable.type === 'parameter' || !variable.dependencies || variable.dependencies.length === 0) {
        sorted.push(variable);
        added.add(variable.name);
        remaining.splice(i, 1);
      }
    }

    // Subsequent passes: add variables whose dependencies are already added
    let changed = true;
    while (remaining.length > 0 && changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const variable = remaining[i];
        const allDepsAdded = variable.dependencies.every((dep: string) => added.has(dep));
        
        if (allDepsAdded) {
          sorted.push(variable);
          added.add(variable.name);
          remaining.splice(i, 1);
          changed = true;
        }
      }
    }

    // Add any remaining variables (they might have circular dependencies)
    sorted.push(...remaining);

    return sorted;
  }

  private getGraphStatistics(model: Model): any {
    this.refreshModelGraph();
    
    if (!this.currentModelGraph) {
      return { error: 'Failed to create model graph' };
    }

    const stats = this.currentModelGraph.getStatistics();
    const cycles = this.currentModelGraph.findCycles();
    const topOrder = this.currentModelGraph.getTopologicalOrder();

    return {
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
      maxLevel: stats.maxLevel,
      cycleCount: stats.cycleCount,
      stronglyConnectedComponents: stats.stronglyConnectedComponents,
      timeDependentNodes: stats.timeDependentNodes,
      isolatedNodes: stats.isolatedNodes,
      canEvaluate: topOrder.canEvaluate,
      cycles: cycles.length > 0 ? cycles : null
    };
  }

  private refreshModelGraph(): void {
    if (this.currentModel) {
      this.currentModelGraph = new ModelGraph(this.currentModel);
    }
  }

  private extractVariableReferences(formula: string): string[] {
    // Simple regex to find variable references in formulas
    // Matches word characters that could be variable names
    // Excludes common mathematical functions and operators
    const variablePattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    const mathFunctions = new Set([
      'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'abs', 'max', 'min',
      'sum', 'avg', 'mean', 'std', 'var', 'ceil', 'floor', 'round'
    ]);
    
    const matches = formula.match(variablePattern) || [];
    const variables = new Set<string>();
    
    for (const match of matches) {
      // Skip mathematical functions and common constants
      if (!mathFunctions.has(match.toLowerCase()) && 
          match !== 'pi' && match !== 'e' && 
          !/^\d/.test(match)) {
        variables.add(match);
      }
    }
    
    return Array.from(variables);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }
}