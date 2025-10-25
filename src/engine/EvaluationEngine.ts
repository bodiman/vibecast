import { Model } from '../models/Model';
import { Variable } from '../models/Variable';
import { DependencyGraph } from '../graph/DependencyGraph';
import { ExpressionParser } from './ExpressionParser';

export interface EvaluationContext {
  timeSteps: number;
  variables: Record<string, number[]>;
  parameters: Record<string, number>;
}

export interface EvaluationResult {
  success: boolean;
  timeSteps: number;
  values: Record<string, number[]>;
  errors: string[];
  executionTime: number;
}

export class EvaluationEngine {
  private parser: ExpressionParser;
  private graph: DependencyGraph;

  constructor() {
    this.parser = new ExpressionParser();
    this.graph = new DependencyGraph();
  }

  async evaluateModel(model: Model, timeSteps: number = 1): Promise<EvaluationResult> {
    const startTime = Date.now();
    const result: EvaluationResult = {
      success: false,
      timeSteps,
      values: {},
      errors: [],
      executionTime: 0,
    };

    try {
      // Build dependency graph
      this.graph.buildFromModel(model);

      // Validate the model
      const validation = model.validateModel();
      if (!validation.isValid) {
        result.errors = validation.errors;
        return result;
      }

      // Check for cycles
      if (!this.graph.isAcyclic()) {
        const cycles = this.graph.findCycles();
        result.errors.push(`Circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(', ')}`);
        return result;
      }

      // Initialize evaluation context
      const context = this.initializeContext(model, timeSteps);

      // Evaluate the model
      await this.performEvaluation(model, context, timeSteps);

      result.success = true;
      result.values = context.variables;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  private initializeContext(model: Model, timeSteps: number): EvaluationContext {
    const context: EvaluationContext = {
      timeSteps,
      variables: {},
      parameters: {},
    };

    // Initialize all variables with empty arrays or existing values
    for (const variable of model.listVariables()) {
      context.variables[variable.name] = new Array(timeSteps).fill(0);
      
      // Copy existing values if available
      if (variable.values) {
        for (let t = 0; t < Math.min(variable.values.length, timeSteps); t++) {
          context.variables[variable.name][t] = variable.values[t];
        }
      }

      // Set parameters
      if (variable.isParameter() && variable.values && variable.values.length > 0) {
        context.parameters[variable.name] = variable.values[0];
      }
    }

    return context;
  }

  private async performEvaluation(model: Model, context: EvaluationContext, timeSteps: number): Promise<void> {
    const evaluationOrder = this.graph.getTopologicalOrder();

    // Separate time-dependent and time-independent variables
    const timeDependentVars = new Set<string>();
    const timeIndependentVars: string[] = [];

    for (const varName of evaluationOrder) {
      const variable = model.getVariable(varName);
      if (!variable) {
        throw new Error(`Variable '${varName}' not found in model during evaluation setup`);
      }
      if (variable.isTimeDependent()) {
        timeDependentVars.add(varName);
      } else if (variable.hasFormula()) {
        timeIndependentVars.push(varName);
      }
    }
    
    // Variables categorized successfully

    // First, evaluate time-independent variables for each time step
    for (let t = 0; t < timeSteps; t++) {
      for (const varName of timeIndependentVars) {
        const variable = model.getVariable(varName)!;
        if (variable.hasFormula()) {
          const value = this.evaluateVariableFormula(variable, context, t, model);
          context.variables[varName][t] = value;
        }
      }
    }

    // Then, evaluate time-dependent variables for each time step
    for (let t = 0; t < timeSteps; t++) {
      for (const varName of evaluationOrder) {
        if (timeDependentVars.has(varName)) {
          const variable = model.getVariable(varName)!;
          if (variable.hasFormula()) {
            const value = this.evaluateVariableFormula(variable, context, t, model);
            context.variables[varName][t] = value;
          }
        }
      }
    }
  }

  private evaluateVariableFormula(variable: Variable, context: EvaluationContext, timeStep: number, model: Model): number {
    if (!variable.formula) {
      throw new Error(`Variable '${variable.name}' has no formula`);
    }

    // Parse the expression to get time references
    const parsed = this.parser.parseExpression(variable.formula);
    
    // Build evaluation context for this time step
    const evalContext: Record<string, number> = {};

    // Handle time-dependent references
    for (const timeRef of parsed.timeReferences) {
      const refTimeStep = timeStep + timeRef.offset;
      
      if (refTimeStep < 0) {
        // For negative time steps (like t-1 at t=0), use the initial/historical value
        // This handles cases like CASH_BALANCE[t-1] at t=0 should use the initial CASH_BALANCE value
        const variable = model.getVariable(timeRef.variable);
        if (variable && variable.values && variable.values.length > 0) {
          // For t-1 at t=0, use the initial value (index 0)
          // For t-2 at t=1, use the initial value (index 0), etc.
          evalContext[timeRef.originalText] = variable.values[0];
        } else {
          evalContext[timeRef.originalText] = 0;
        }
        // Historical value retrieved
      } else if (refTimeStep >= context.timeSteps) {
        // For future time steps, use the last available value
        const lastTimeStep = context.timeSteps - 1;
        evalContext[timeRef.originalText] = context.variables[timeRef.variable]?.[lastTimeStep] ?? 0;
      } else {
        evalContext[timeRef.originalText] = context.variables[timeRef.variable]?.[refTimeStep] ?? 0;
        // Time reference retrieved
      }
    }

    // Handle regular variable references (use current time step)
    for (const depName of parsed.dependencies) {
      // Skip if already handled as a time reference
      if (parsed.timeReferences.some(tr => tr.originalText === depName)) {
        continue;
      }

      // Use current time step value
      evalContext[depName] = context.variables[depName]?.[timeStep] ?? 0;
    }

    return this.parser.evaluateExpression(variable.formula, evalContext);
  }

  getLastEvaluationGraph(): DependencyGraph {
    return this.graph;
  }

  async evaluateVariable(
    model: Model, 
    variableName: string, 
    timeSteps: number = 1
  ): Promise<{ values: number[]; errors: string[] }> {
    
    const result = { values: [] as number[], errors: [] as string[] };

    try {
      const variable = model.getVariable(variableName);
      if (!variable) {
        result.errors.push(`Variable '${variableName}' not found`);
        return result;
      }

      // Get all dependencies
      const allDeps = model.getAllDependencies(variableName);
      
      // Create a subset model with only required variables
      const subModel = new Model({ name: `${model.name}_subset` });
      
      // Add the target variable and all its dependencies
      for (const depName of allDeps) {
        const depVar = model.getVariable(depName);
        if (depVar) {
          subModel.addVariable(depVar);
        }
      }
      subModel.addVariable(variable);

      // Evaluate the subset model
      const evalResult = await this.evaluateModel(subModel, timeSteps);
      
      if (evalResult.success) {
        result.values = evalResult.values[variableName] || [];
      } else {
        result.errors = evalResult.errors;
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  async simulateScenario(
    model: Model,
    scenarios: Record<string, Record<string, number[]>>,
    timeSteps: number
  ): Promise<Record<string, EvaluationResult>> {
    
    const results: Record<string, EvaluationResult> = {};

    for (const [scenarioName, parameterValues] of Object.entries(scenarios)) {
      try {
        // Clone the model
        const scenarioModel = model.clone();
        
        // Update parameter values
        for (const [paramName, values] of Object.entries(parameterValues)) {
          if (scenarioModel.hasVariable(paramName)) {
            scenarioModel.updateVariable(paramName, { values });
          }
        }

        // Evaluate the scenario
        results[scenarioName] = await this.evaluateModel(scenarioModel, timeSteps);

      } catch (error) {
        results[scenarioName] = {
          success: false,
          timeSteps,
          values: {},
          errors: [error instanceof Error ? error.message : String(error)],
          executionTime: 0,
        };
      }
    }

    return results;
  }
}