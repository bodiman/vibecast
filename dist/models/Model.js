"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = exports.ModelSchema = void 0;
const Variable_1 = require("models/Variable");
const zod_1 = require("zod");
exports.ModelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    variables: zod_1.z.array(zod_1.z.unknown()),
    metadata: zod_1.z.object({
        created: zod_1.z.union([zod_1.z.date(), zod_1.z.string()]).optional(),
        updated: zod_1.z.union([zod_1.z.date(), zod_1.z.string()]).optional(),
        version: zod_1.z.string().optional(),
        author: zod_1.z.string().optional(),
    }).optional(),
});
class Model {
    constructor(data) {
        this.name = data.name;
        this.description = data.description;
        this.metadata = data.metadata ? {
            created: data.metadata.created instanceof Date ? data.metadata.created : (data.metadata.created ? new Date(data.metadata.created) : undefined),
            updated: data.metadata.updated instanceof Date ? data.metadata.updated : (data.metadata.updated ? new Date(data.metadata.updated) : undefined),
            version: data.metadata.version,
            author: data.metadata.author,
        } : undefined;
        this.variableMap = new Map();
        if (data.variables) {
            for (const varData of data.variables) {
                const variable = Variable_1.Variable.fromJSON(varData);
                this.variableMap.set(variable.name, variable);
            }
        }
    }
    addVariable(variable) {
        this.validateVariableDependencies(variable);
        this.variableMap.set(variable.name, variable);
        this.touch();
    }
    removeVariable(name) {
        this.validateVariableNotReferenced(name);
        const removed = this.variableMap.delete(name);
        if (removed)
            this.touch();
        return removed;
    }
    getVariable(name) {
        return this.variableMap.get(name);
    }
    hasVariable(name) {
        return this.variableMap.has(name);
    }
    listVariables() {
        return Array.from(this.variableMap.values());
    }
    getVariableNames() {
        return Array.from(this.variableMap.keys());
    }
    updateVariable(name, updates) {
        const existing = this.variableMap.get(name);
        if (!existing) {
            throw new Error(`Variable '${name}' not found`);
        }
        const updatedData = { ...existing.toJSON(), ...updates };
        const updatedVariable = new Variable_1.Variable(updatedData);
        this.validateVariableDependencies(updatedVariable);
        this.variableMap.set(name, updatedVariable);
        this.touch();
    }
    getDependents(variableName) {
        return this.listVariables().filter(variable => variable.dependencies.includes(variableName));
    }
    getDependencies(variableName) {
        const variable = this.getVariable(variableName);
        if (!variable)
            return [];
        return variable.dependencies
            .map(depName => this.getVariable(depName))
            .filter((dep) => dep !== undefined);
    }
    getAllDependencies(variableName, visited = new Set()) {
        if (visited.has(variableName)) {
            throw new Error(`Circular dependency detected involving variable '${variableName}'`);
        }
        visited.add(variableName);
        const dependencies = new Set();
        const variable = this.getVariable(variableName);
        if (!variable)
            return dependencies;
        for (const depName of variable.dependencies) {
            dependencies.add(depName);
            const subDeps = this.getAllDependencies(depName, new Set(visited));
            subDeps.forEach(dep => dependencies.add(dep));
        }
        return dependencies;
    }
    validateModel() {
        const errors = [];
        for (const variable of this.listVariables()) {
            try {
                this.validateVariableDependencies(variable);
                this.getAllDependencies(variable.name);
            }
            catch (error) {
                errors.push(`Variable '${variable.name}': ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    validateVariableDependencies(variable) {
        for (const depName of variable.dependencies) {
            // Skip time-dependent self-references like CASH[t-1] for variable CASH
            if (this.isTimeDependentSelfReference(depName, variable.name)) {
                continue;
            }
            // Extract base variable name from time references
            const baseVarName = this.extractBaseVariableName(depName);
            if (!this.hasVariable(baseVarName)) {
                throw new Error(`Dependency '${baseVarName}' not found for variable '${variable.name}'`);
            }
        }
    }
    isTimeDependentSelfReference(depName, varName) {
        // Check if this is a time reference to the same variable
        const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]\d+\]$/);
        if (timeRefMatch) {
            const baseVar = timeRefMatch[1];
            return baseVar === varName;
        }
        return false;
    }
    extractBaseVariableName(depName) {
        // Extract base variable name from time references like VAR[t-1] -> VAR
        const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]?\d*\]$/);
        if (timeRefMatch) {
            return timeRefMatch[1];
        }
        return depName;
    }
    validateVariableNotReferenced(name) {
        const dependents = this.getDependents(name);
        if (dependents.length > 0) {
            const dependentNames = dependents.map(v => v.name).join(', ');
            throw new Error(`Cannot remove variable '${name}' - it is referenced by: ${dependentNames}`);
        }
    }
    touch() {
        if (!this.metadata)
            this.metadata = {};
        this.metadata.updated = new Date();
    }
    clone() {
        const variables = this.listVariables().map(v => v.toJSON());
        return new Model({
            name: this.name,
            description: this.description,
            variables,
            metadata: this.metadata ? { ...this.metadata } : undefined,
        });
    }
    toJSON() {
        return {
            name: this.name,
            description: this.description,
            variables: this.listVariables().map(v => v.toJSON()),
            metadata: this.metadata,
        };
    }
    static fromJSON(data) {
        const parsed = exports.ModelSchema.parse(data);
        const processedData = {
            ...parsed,
            name: parsed.name || 'Untitled Model',
            metadata: parsed.metadata ? {
                ...parsed.metadata,
                created: parsed.metadata.created ? new Date(parsed.metadata.created) : undefined,
                updated: parsed.metadata.updated ? new Date(parsed.metadata.updated) : undefined,
            } : undefined,
        };
        return new Model(processedData);
    }
}
exports.Model = Model;
