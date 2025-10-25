import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { EvaluationEngine } from '../engine/EvaluationEngine.js';
import { ModelStorage } from '../storage/ModelStorage.js';
import { DependencyGraph } from '../graph/DependencyGraph.js';

export class ModelitMCPServer {
  private server: Server;
  private currentModel: Model | null = null;
  private engine: EvaluationEngine;
  private storage: ModelStorage;
  private graph: DependencyGraph;

  constructor(storageDirectory: string = './models') {
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
    this.storage = new ModelStorage({
      baseDirectory: storageDirectory,
      createDirectories: true,
    });
    this.graph = new DependencyGraph();

    this.setupHandlers();
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
          description: 'Add a new variable to the current model',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Variable name' },
              formula: { type: 'string', description: 'Mathematical formula (optional)' },
              type: { type: 'string', enum: ['scalar', 'series', 'parameter'], description: 'Variable type' },
              values: { type: 'array', items: { type: 'number' }, description: 'Initial values (optional)' },
              metadata: {
                type: 'object',
                properties: {
                  units: { type: 'string' },
                  description: { type: 'string' },
                  source: { type: 'string' },
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
              timeSteps: { type: 'number', description: 'Number of time steps to evaluate', minimum: 1 },
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
              timeSteps: { type: 'number', description: 'Number of time steps', minimum: 1 },
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
    
    this.currentModel = await this.storage.loadModel(name);
    
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

    await this.storage.saveModel(modelToSave);
    
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
    const models = await this.storage.listModels();
    
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

    const variable = new Variable(args);
    this.currentModel.addVariable(variable);
    
    return {
      content: [
        {
          type: 'text',
          text: `Created variable: ${variable.name}${variable.formula ? ` = ${variable.formula}` : ''}`,
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

    const variableList = variables.map(v => {
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
                  `Depends on: [${deps.map(d => d.name).join(', ')}]\n` +
                  `Required by: [${dependents.map(d => d.name).join(', ')}]`,
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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }
}