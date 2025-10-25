"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvaluationEngine = void 0;
const Model_1 = require("../models/Model");
const DependencyGraph_1 = require("../graph/DependencyGraph");
const ExpressionParser_1 = require("./ExpressionParser");
class EvaluationEngine {
    constructor() {
        this.parser = new ExpressionParser_1.ExpressionParser();
        this.graph = new DependencyGraph_1.DependencyGraph();
    }
    async evaluateModel(model, timeSteps = 1) {
        const startTime = Date.now();
        const result = {
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
        }
        catch (error) {
            result.errors.push(error instanceof Error ? error.message : String(error));
        }
        finally {
            result.executionTime = Date.now() - startTime;
        }
        return result;
    }
    initializeContext(model, timeSteps) {
        const context = {
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
    async performEvaluation(model, context, timeSteps) {
        const evaluationOrder = this.graph.getTopologicalOrder();
        // Separate time-dependent and time-independent variables
        const timeDependentVars = new Set();
        const timeIndependentVars = [];
        for (const varName of evaluationOrder) {
            const variable = model.getVariable(varName);
            if (!variable) {
                throw new Error(`Variable '${varName}' not found in model during evaluation setup`);
            }
            if (variable.isTimeDependent()) {
                timeDependentVars.add(varName);
            }
            else if (variable.hasFormula()) {
                timeIndependentVars.push(varName);
            }
        }
        // Variables categorized successfully
        // First, evaluate time-independent variables for each time step
        for (let t = 0; t < timeSteps; t++) {
            for (const varName of timeIndependentVars) {
                const variable = model.getVariable(varName);
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
                    const variable = model.getVariable(varName);
                    if (variable.hasFormula()) {
                        const value = this.evaluateVariableFormula(variable, context, t, model);
                        context.variables[varName][t] = value;
                    }
                }
            }
        }
    }
    evaluateVariableFormula(variable, context, timeStep, model) {
        var _a, _b, _c, _d, _e, _f;
        if (!variable.formula) {
            throw new Error(`Variable '${variable.name}' has no formula`);
        }
        // Parse the expression to get time references
        const parsed = this.parser.parseExpression(variable.formula);
        // Build evaluation context for this time step
        const evalContext = {};
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
                }
                else {
                    evalContext[timeRef.originalText] = 0;
                }
                // Historical value retrieved
            }
            else if (refTimeStep >= context.timeSteps) {
                // For future time steps, use the last available value
                const lastTimeStep = context.timeSteps - 1;
                evalContext[timeRef.originalText] = (_b = (_a = context.variables[timeRef.variable]) === null || _a === void 0 ? void 0 : _a[lastTimeStep]) !== null && _b !== void 0 ? _b : 0;
            }
            else {
                evalContext[timeRef.originalText] = (_d = (_c = context.variables[timeRef.variable]) === null || _c === void 0 ? void 0 : _c[refTimeStep]) !== null && _d !== void 0 ? _d : 0;
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
            evalContext[depName] = (_f = (_e = context.variables[depName]) === null || _e === void 0 ? void 0 : _e[timeStep]) !== null && _f !== void 0 ? _f : 0;
        }
        return this.parser.evaluateExpression(variable.formula, evalContext);
    }
    getLastEvaluationGraph() {
        return this.graph;
    }
    async evaluateVariable(model, variableName, timeSteps = 1) {
        const result = { values: [], errors: [] };
        try {
            const variable = model.getVariable(variableName);
            if (!variable) {
                result.errors.push(`Variable '${variableName}' not found`);
                return result;
            }
            // Get all dependencies
            const allDeps = model.getAllDependencies(variableName);
            // Create a subset model with only required variables
            const subModel = new Model_1.Model({ name: `${model.name}_subset` });
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
            }
            else {
                result.errors = evalResult.errors;
            }
        }
        catch (error) {
            result.errors.push(error instanceof Error ? error.message : String(error));
        }
        return result;
    }
    async simulateScenario(model, scenarios, timeSteps) {
        const results = {};
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
            }
            catch (error) {
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
exports.EvaluationEngine = EvaluationEngine;
