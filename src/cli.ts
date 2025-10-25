#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Model } from 'models/Model';
// CLI imports
import { EvaluationEngine } from 'engine/EvaluationEngine';
import { ModelStorage } from 'storage/ModelStorage';
import { ModelitHTTPServer } from 'mcp/http-server';

interface CLIOptions {
  help?: boolean;
  version?: boolean;
  model?: string;
  evaluate?: boolean;
  timeSteps?: number;
  variable?: string;
  validate?: boolean;
  graph?: boolean;
  list?: boolean;
  import?: string;
  export?: string;
  storage?: string;
  httpServer?: boolean;
  port?: number;
  host?: string;
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-m':
      case '--model':
        options.model = args[++i];
        break;
      case '-e':
      case '--evaluate':
        options.evaluate = true;
        break;
      case '-t':
      case '--time-steps':
        options.timeSteps = parseInt(args[++i], 10);
        break;
      case '--variable':
        options.variable = args[++i];
        break;
      case '--validate':
        options.validate = true;
        break;
      case '--graph':
        options.graph = true;
        break;
      case '--list':
        options.list = true;
        break;
      case '--import':
        options.import = args[++i];
        break;
      case '--export':
        options.export = args[++i];
        break;
      case '--storage':
        options.storage = args[++i];
        break;
      case '--http-server':
        options.httpServer = true;
        break;
      case '--port':
        options.port = parseInt(args[++i], 10);
        break;
      case '--host':
        options.host = args[++i];
        break;
    }
  }
  
  return options;
}

function printHelp(): void {
  console.log(`
Modelit CLI - Mathematical Model Evaluation Tool

Usage: modelit [options]

Options:
  -h, --help                    Show this help message
  -v, --version                 Show version information
  -m, --model <name>            Load model by name
  -e, --evaluate                Evaluate the loaded model
  -t, --time-steps <n>          Number of time steps for evaluation (default: 1)
  --variable <name>             Evaluate specific variable only
  --validate                    Validate model structure
  --graph                       Show dependency graph
  --list                        List all available models
  --import <file>               Import model from file
  --export <file>               Export model to file
  --storage <dir>               Set storage directory (default: ~/.modelit/models)
  --http-server                 Start HTTP server for ChatGPT integration
  --port <n>                    HTTP server port (default: 3000)
  --host <host>                 HTTP server host (default: localhost)

Examples:
  modelit --list                           List all models
  modelit --import examples/cashflow-model.json  Import example model
  modelit -m "Cashflow Forecast" --evaluate -t 3  Evaluate for 3 time steps
  modelit -m "Cashflow Forecast" --variable EBITDA  Evaluate specific variable
  modelit -m "Cashflow Forecast" --validate        Validate model
  modelit -m "Cashflow Forecast" --graph           Show dependency graph
  modelit --http-server --port 3000        Start HTTP server for ChatGPT
`);
}

function printVersion(): void {
  const packageJsonPath = resolve(process.cwd(), 'package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    console.log(`Modelit CLI v${packageJson.version}`);
  } catch {
    console.log('Modelit CLI v0.1.0');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    printVersion();
    return;
  }

  // Set up storage
  // Handle HTTP server mode
  if (options.httpServer) {
    const port = options.port || 3000;
    const host = options.host || 'localhost';
    const storageDir = options.storage || resolve(process.env.HOME || '~', '.modelit', 'models');
    
    const httpServer = new ModelitHTTPServer({
      port,
      host,
      storageDirectory: storageDir
    });
    
    console.log('Starting Modelit MCP HTTP Server...');
    await httpServer.start();
    
    // Keep the server running
    process.on('SIGINT', async () => {
      console.log('\nShutting down HTTP server...');
      await httpServer.stop();
      process.exit(0);
    });
    
    return;
  }

  const storageDir = options.storage || resolve(process.env.HOME || '~', '.modelit', 'models');
  const storage = new ModelStorage({
    baseDirectory: storageDir,
    createDirectories: true,
  });

  const engine = new EvaluationEngine();

  try {
    // Handle list command
    if (options.list) {
      const models = await storage.listModels();
      if (models.length === 0) {
        console.log('No models found in storage');
      } else {
        console.log('Available models:');
        for (const modelName of models) {
          const info = await storage.getModelInfo(modelName);
          console.log(`  ${modelName} (${info.variableCount} variables, ${Math.round(info.size / 1024)}KB)`);
        }
      }
      return;
    }

    // Handle import command
    if (options.import) {
      const importPath = resolve(options.import);
      const model = await storage.importModel(importPath);
      console.log(`Imported model: ${model.name}`);
      return;
    }

    // Handle export command
    if (options.export && options.model) {
      const exportPath = resolve(options.export);
      await storage.exportModel(options.model, exportPath);
      console.log(`Exported model '${options.model}' to ${exportPath}`);
      return;
    }

    // Load model if specified
    let model: Model | null = null;
    if (options.model) {
      try {
        model = await storage.loadModel(options.model);
        console.log(`Loaded model: ${model.name}`);
      } catch (error) {
        console.error(`Failed to load model '${options.model}': ${(error as Error)?.message || String(error)}`);
        process.exit(1);
      }
    }

    if (!model) {
      console.error('No model specified. Use -m <name> to load a model or --list to see available models.');
      process.exit(1);
    }

    // Handle validate command
    if (options.validate) {
      const validation = model.validateModel();
      if (validation.isValid) {
        console.log('✓ Model is valid');
      } else {
        console.log('✗ Model validation failed:');
        validation.errors.forEach((error: string) => console.log(`  - ${error}`));
      }
      return;
    }

    // Handle graph command
    if (options.graph) {
      const graph = engine.getLastEvaluationGraph();
      // Build graph from model first
      graph.buildFromModel(model);
      
      const stats = graph.getStatistics();
      console.log('Dependency Graph:');
      console.log(`  Nodes: ${stats.nodeCount}`);
      console.log(`  Edges: ${stats.edgeCount}`);
      console.log(`  Max Level: ${stats.maxLevel}`);
      console.log(`  Time-dependent: ${stats.timeDependentNodes}`);
      console.log(`  Cycles: ${stats.cycleCount}`);
      
      console.log('\nEvaluation Order:');
      const order = graph.getTopologicalOrder();
      order.forEach((name, index) => {
        const node = graph.getNode(name);
        const deps = node?.dependencies.length ? ` (depends on: ${node.dependencies.join(', ')})` : '';
        console.log(`  ${index + 1}. ${name}${deps}`);
      });
      return;
    }

    // Handle evaluate command
    if (options.evaluate) {
      const timeSteps = options.timeSteps || 1;
      
      if (options.variable) {
        // Evaluate specific variable
        const result = await engine.evaluateVariable(model, options.variable, timeSteps);
        
        if (result.errors.length > 0) {
          console.error('Evaluation failed:');
          result.errors.forEach(error => console.error(`  - ${error}`));
          process.exit(1);
        }
        
        console.log(`${options.variable}: [${result.values.join(', ')}]`);
      } else {
        // Evaluate entire model
        const result = await engine.evaluateModel(model, timeSteps);
        
        if (!result.success) {
          console.error('Evaluation failed:');
          result.errors.forEach(error => console.error(`  - ${error}`));
          process.exit(1);
        }
        
        console.log(`Model evaluation completed in ${result.executionTime}ms:`);
        Object.entries(result.values).forEach(([name, values]) => {
          const variable = model!.getVariable(name);
          const units = variable?.metadata?.units ? ` ${variable.metadata.units}` : '';
          console.log(`  ${name}: [${values.map(v => v.toFixed(2)).join(', ')}]${units}`);
        });
      }
      return;
    }

    // If no specific command, show model summary
    console.log(`Model: ${model.name}`);
    if (model.description) {
      console.log(`Description: ${model.description}`);
    }
    
    const variables = model.listVariables();
    console.log(`Variables: ${variables.length}`);
    
    variables.forEach((variable: any) => {
      const formula = variable.formula ? ` = ${variable.formula}` : '';
      const type = variable.type !== 'scalar' ? ` [${variable.type}]` : '';
      console.log(`  ${variable.name}${type}${formula}`);
    });

  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}