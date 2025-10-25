import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge } from '../models/Edge.js';
import { ModelGraph } from '../models/ModelGraph.js';
import { EvaluationEngine } from '../engine/EvaluationEngine.js';
import { ModelStorage } from '../storage/ModelStorage.js';
import { DatabaseStorage, DatabaseMarketplaceAPI } from '../storage/DatabaseStorage.js';
import { DependencyGraph } from '../graph/DependencyGraph.js';
import { MarketplaceAPI } from '../marketplace/MarketplaceAPI.js';
export class ModelitMCPServer {
    constructor(storageDirectory = './models', databaseUrl) {
        this.currentModel = null;
        this.currentModelGraph = null;
        this.server = new Server({
            name: 'modelit-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.engine = new EvaluationEngine();
        // Initialize both storage systems
        this.storage = new ModelStorage({
            baseDirectory: storageDirectory,
            createDirectories: true,
        });
        this.dbStorage = new DatabaseStorage({ databaseUrl });
        this.useDatabase = !!databaseUrl || !!process.env.DATABASE_URL;
        this.graph = new DependencyGraph();
        if (this.useDatabase) {
            this.marketplace = new DatabaseMarketplaceAPI(this.dbStorage);
        }
        else {
            this.marketplace = new MarketplaceAPI();
        }
        this.setupHandlers();
    }
    // Initialize database connection if using database storage
    async initialize() {
        if (this.useDatabase) {
            await this.dbStorage.initialize();
        }
    }
    // Get the appropriate storage based on configuration
    getStorage() {
        return this.useDatabase ? this.dbStorage : this.storage;
    }
    // Cleanup method
    async cleanup() {
        if (this.useDatabase) {
            await this.dbStorage.disconnect();
        }
    }
    setupHandlers() {
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
                            type: { type: 'string', enum: ['scalar', 'series', 'parameter'], description: 'Variable type' },
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
                {
                    name: 'create_edge',
                    description: 'Create a dependency relationship between variables',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            source: { type: 'string', description: 'Source variable name' },
                            target: { type: 'string', description: 'Target variable name' },
                            type: { type: 'string', enum: ['dependency', 'temporal', 'causal', 'derived', 'constraint'], description: 'Edge type' },
                            strength: { type: 'number', minimum: 0, maximum: 1, description: 'Relationship strength (optional)' },
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
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
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
    async handleCreateModel(args) {
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
    async handleLoadModel(args) {
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
    async handleSaveModel(args) {
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
    async handleListModels() {
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
    async handleCreateVariable(args) {
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
            console.log(`Creating variable ${variableArgs.name} with formula: ${variableArgs.formula}`);
            console.log(`Referenced variables: ${referencedVars.join(', ')}`);
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
                    console.log(`Creating edge from ${refVar} to ${variable.name}`);
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
                }
                else {
                    console.log(`Referenced variable ${refVar} not found in model`);
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
    async handleUpdateVariable(args) {
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
    async handleListVariables() {
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
        const variableList = variables.map((v) => {
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
    async handleGetVariable(args) {
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
    async handleEvaluateModel(args) {
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
    async handleEvaluateVariable(args) {
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
    async handleGetDependencies(args) {
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
                            `Depends on: [${deps.map((d) => d.name).join(', ')}]\n` +
                            `Required by: [${dependents.map((d) => d.name).join(', ')}]`,
                    },
                ],
            };
        }
        else {
            // Return all dependencies
            this.graph.buildFromModel(this.currentModel);
            const nodes = this.graph.getAllNodes();
            const depInfo = nodes.map(node => `${node.name}: depends on [${node.dependencies.join(', ')}], required by [${node.dependents.join(', ')}]`).join('\n');
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
    async handleGetGraph() {
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
    async handleValidateModel() {
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
    async handleCreateEdge(args) {
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
    async handleSearchMarketplace(args) {
        const { text, tags, category, author, limit = 10 } = args;
        const results = await this.marketplace.searchModels({
            text,
            tags,
            category,
            author,
            limit
        });
        const modelList = results.models.map(model => `- ${model.name} v${model.version} by ${model.author} (⭐ ${model.stars})`).join('\n');
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${results.models.length} models:\n${modelList || 'No models found'}`,
                },
            ],
        };
    }
    async handlePublishModel(args) {
        if (!this.currentModel) {
            throw new Error('No current model. Create or load a model first.');
        }
        const { tags = [], category = 'general', license = 'MIT' } = args;
        // Update model metadata for publishing
        if (!this.currentModel.metadata)
            this.currentModel.metadata = {};
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
    async handleImportModel(args) {
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
    async handleGetGraphStats() {
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
    async handleGetGraphData(args) {
        const modelName = args.modelName || this.currentModel?.name;
        if (!modelName) {
            throw new Error('No model specified and no current model loaded');
        }
        if (this.useDatabase) {
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
        else {
            // Fallback to current model for file storage
            if (!this.currentModel) {
                throw new Error('No current model loaded');
            }
            const nodes = this.currentModel.listVariables().map(v => ({
                id: v.name,
                name: v.name,
                type: v.type,
                values: v.values,
                metadata: v.metadata
            }));
            const edges = this.currentModel.listEdges().map(e => ({
                id: `${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                type: e.type,
                metadata: e.metadata
            }));
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ nodes, edges }, null, 2),
                    },
                ],
            };
        }
    }
    async handleSaveGraphLayout(args) {
        const { nodePositions, modelName } = args;
        const targetModelName = modelName || this.currentModel?.name;
        if (!targetModelName) {
            throw new Error('No model specified and no current model loaded');
        }
        if (this.useDatabase) {
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
        else {
            // For file storage, we could save to a separate layout file
            return {
                content: [
                    {
                        type: 'text',
                        text: `Graph layout saving not supported with file storage. Use database storage for 3D layout persistence.`,
                    },
                ],
            };
        }
    }
    async handleQueryModels(args) {
        if (!this.useDatabase) {
            // Fallback to simple listing for file storage
            const models = await this.storage.listModels();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ models, total: models.length, hasMore: false }, null, 2),
                    },
                ],
            };
        }
        // Use database marketplace for advanced queries
        const searchResult = await this.marketplace.searchModels(args);
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
    async handleCreateModelVersion(args) {
        const { changelog, modelName } = args;
        const targetModelName = modelName || this.currentModel?.name;
        if (!targetModelName) {
            throw new Error('No model specified and no current model loaded');
        }
        if (!this.useDatabase) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Model versioning not supported with file storage. Use database storage for version control.`,
                    },
                ],
            };
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
    refreshModelGraph() {
        if (this.currentModel) {
            this.currentModelGraph = new ModelGraph(this.currentModel);
        }
    }
    extractVariableReferences(formula) {
        // Simple regex to find variable references in formulas
        // Matches word characters that could be variable names
        // Excludes common mathematical functions and operators
        const variablePattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        const mathFunctions = new Set([
            'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'abs', 'max', 'min',
            'sum', 'avg', 'mean', 'std', 'var', 'ceil', 'floor', 'round'
        ]);
        const matches = formula.match(variablePattern) || [];
        const variables = new Set();
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
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }
    async connect(transport) {
        await this.server.connect(transport);
    }
}
