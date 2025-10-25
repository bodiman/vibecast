#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = require("path");
const os_1 = require("os");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// Create MCP server instance
const defaultStorageDir = (0, path_1.join)((0, os_1.homedir)(), '.modelit', 'models');
const storageDirectory = process.env.MODELIT_STORAGE_DIR || defaultStorageDir;
// Initialize the MCP server components directly
const Model_1 = require("./models/Model");
const Variable_1 = require("./models/Variable");
const EvaluationEngine_1 = require("./engine/EvaluationEngine");
const ModelStorage_1 = require("./storage/ModelStorage");
const DependencyGraph_1 = require("./graph/DependencyGraph");
const engine = new EvaluationEngine_1.EvaluationEngine();
const storage = new ModelStorage_1.ModelStorage({
    baseDirectory: storageDirectory,
    createDirectories: true,
});
const graph = new DependencyGraph_1.DependencyGraph();
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'healthy',
        storage: storageDirectory,
        version: '0.1.0',
        timestamp: new Date().toISOString()
    });
});
// List available tools
app.get('/api/tools', (_req, res) => {
    const tools = [
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
            name: 'list_variables',
            description: 'List all variables in the current model',
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
    ];
    res.json({ tools });
});
// Tool execution endpoint
app.post('/api/tools/:toolName', async (req, res) => {
    try {
        const { toolName } = req.params;
        const args = req.body;
        let result;
        switch (toolName) {
            case 'create_model':
                result = await handleCreateModel(args);
                break;
            case 'load_model':
                result = await handleLoadModel(args);
                break;
            case 'save_model':
                result = await handleSaveModel(args);
                break;
            case 'list_models':
                result = await handleListModels();
                break;
            case 'create_variable':
                result = await handleCreateVariable(args);
                break;
            case 'evaluate_model':
                result = await handleEvaluateModel(args);
                break;
            case 'list_variables':
                result = await handleListVariables();
                break;
            case 'validate_model':
                result = await handleValidateModel();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: `Unknown tool: ${toolName}`
                });
        }
        return res.json({ success: true, result });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
// In-memory model storage for HTTP server
let currentModel = null;
// Tool handlers (simplified versions of MCP server handlers)
async function handleCreateModel(args) {
    const { name, description } = args;
    currentModel = new Model_1.Model({
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
async function handleLoadModel(args) {
    const { name } = args;
    currentModel = await storage.loadModel(name);
    return {
        content: [
            {
                type: 'text',
                text: `Loaded model: ${currentModel.name} (${currentModel.listVariables().length} variables)`,
            },
        ],
    };
}
async function handleSaveModel(args) {
    if (!currentModel) {
        throw new Error('No current model to save');
    }
    const modelName = args.name || currentModel.name;
    const modelToSave = args.name ?
        new Model_1.Model({ ...currentModel.toJSON(), name: modelName }) :
        currentModel;
    await storage.saveModel(modelToSave);
    return {
        content: [
            {
                type: 'text',
                text: `Saved model: ${modelName}`,
            },
        ],
    };
}
async function handleListModels() {
    const models = await storage.listModels();
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
async function handleCreateVariable(args) {
    if (!currentModel) {
        throw new Error('No current model. Create or load a model first.');
    }
    const variable = new Variable_1.Variable(args);
    currentModel.addVariable(variable);
    return {
        content: [
            {
                type: 'text',
                text: `Created variable: ${variable.name}${variable.formula ? ` = ${variable.formula}` : ''}`,
            },
        ],
    };
}
async function handleEvaluateModel(args) {
    if (!currentModel) {
        throw new Error('No current model. Create or load a model first.');
    }
    const { timeSteps } = args;
    const result = await engine.evaluateModel(currentModel, timeSteps);
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
async function handleListVariables() {
    if (!currentModel) {
        throw new Error('No current model. Create or load a model first.');
    }
    const variables = currentModel.listVariables();
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
                text: `Variables in ${currentModel.name}:\n${variableList}`,
            },
        ],
    };
}
async function handleValidateModel() {
    if (!currentModel) {
        throw new Error('No current model. Create or load a model first.');
    }
    const validation = currentModel.validateModel();
    graph.buildFromModel(currentModel);
    const cycles = graph.findCycles();
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
                    `Model '${currentModel.name}' is valid` :
                    `Model validation failed:\n${allErrors.join('\n')}`,
            },
        ],
    };
}
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Modelit HTTP Server running on port ${PORT}`);
    console.log(`Storage directory: ${storageDirectory}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Available tools: http://localhost:${PORT}/api/tools`);
});
