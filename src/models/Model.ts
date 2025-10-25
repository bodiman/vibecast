import { Variable, VariableInput } from './Variable.js';
import { z } from 'zod';

export const ModelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(z.unknown()),
  metadata: z.object({
    created: z.union([z.date(), z.string()]).optional(),
    updated: z.union([z.date(), z.string()]).optional(),
    version: z.string().optional(),
    author: z.string().optional(),
  }).optional(),
});

export type ModelData = z.infer<typeof ModelSchema>;

export class Model {
  public readonly name: string;
  public description?: string;
  private variableMap: Map<string, Variable>;
  public metadata?: {
    created?: Date;
    updated?: Date;
    version?: string;
    author?: string;
  };

  constructor(data: Partial<ModelData> & { name: string }) {
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
        const variable = Variable.fromJSON(varData);
        this.variableMap.set(variable.name, variable);
      }
    }
  }

  addVariable(variable: Variable): void {
    this.validateVariableDependencies(variable);
    this.variableMap.set(variable.name, variable);
    this.touch();
  }

  removeVariable(name: string): boolean {
    this.validateVariableNotReferenced(name);
    const removed = this.variableMap.delete(name);
    if (removed) this.touch();
    return removed;
  }

  getVariable(name: string): Variable | undefined {
    return this.variableMap.get(name);
  }

  hasVariable(name: string): boolean {
    return this.variableMap.has(name);
  }

  listVariables(): Variable[] {
    return Array.from(this.variableMap.values());
  }

  getVariableNames(): string[] {
    return Array.from(this.variableMap.keys());
  }

  updateVariable(name: string, updates: Partial<VariableInput>): void {
    const existing = this.variableMap.get(name);
    if (!existing) {
      throw new Error(`Variable '${name}' not found`);
    }

    const updatedData = { ...existing.toJSON(), ...updates };
    const updatedVariable = new Variable(updatedData);
    
    this.validateVariableDependencies(updatedVariable);
    this.variableMap.set(name, updatedVariable);
    this.touch();
  }

  getDependents(variableName: string): Variable[] {
    return this.listVariables().filter(variable => 
      variable.dependencies.includes(variableName)
    );
  }

  getDependencies(variableName: string): Variable[] {
    const variable = this.getVariable(variableName);
    if (!variable) return [];
    
    return variable.dependencies
      .map(depName => this.getVariable(depName))
      .filter((dep): dep is Variable => dep !== undefined);
  }

  getAllDependencies(variableName: string, visited: Set<string> = new Set()): Set<string> {
    if (visited.has(variableName)) {
      throw new Error(`Circular dependency detected involving variable '${variableName}'`);
    }
    
    visited.add(variableName);
    const dependencies = new Set<string>();
    
    const variable = this.getVariable(variableName);
    if (!variable) return dependencies;
    
    for (const depName of variable.dependencies) {
      dependencies.add(depName);
      const subDeps = this.getAllDependencies(depName, new Set(visited));
      subDeps.forEach(dep => dependencies.add(dep));
    }
    
    return dependencies;
  }

  validateModel(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const variable of this.listVariables()) {
      try {
        this.validateVariableDependencies(variable);
        this.getAllDependencies(variable.name);
      } catch (error) {
        errors.push(`Variable '${variable.name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateVariableDependencies(variable: Variable): void {
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

  private isTimeDependentSelfReference(depName: string, varName: string): boolean {
    // Check if this is a time reference to the same variable
    const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]\d+\]$/);
    if (timeRefMatch) {
      const baseVar = timeRefMatch[1];
      return baseVar === varName;
    }
    return false;
  }

  private extractBaseVariableName(depName: string): string {
    // Extract base variable name from time references like VAR[t-1] -> VAR
    const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]?\d*\]$/);
    if (timeRefMatch) {
      return timeRefMatch[1];
    }
    return depName;
  }

  private validateVariableNotReferenced(name: string): void {
    const dependents = this.getDependents(name);
    if (dependents.length > 0) {
      const dependentNames = dependents.map(v => v.name).join(', ');
      throw new Error(`Cannot remove variable '${name}' - it is referenced by: ${dependentNames}`);
    }
  }

  private touch(): void {
    if (!this.metadata) this.metadata = {};
    this.metadata.updated = new Date();
  }

  clone(): Model {
    const variables = this.listVariables().map(v => v.toJSON());
    return new Model({
      name: this.name,
      description: this.description,
      variables,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  toJSON(): ModelData {
    return {
      name: this.name,
      description: this.description,
      variables: this.listVariables().map(v => v.toJSON()),
      metadata: this.metadata,
    };
  }

  static fromJSON(data: unknown): Model {
    const parsed = ModelSchema.parse(data);
    const processedData: Partial<ModelData> & { name: string } = {
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