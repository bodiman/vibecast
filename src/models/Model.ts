import { Variable, VariableInput } from './Variable.js';
import { Edge, EdgeData } from './Edge.js';
import { z } from 'zod';

export const ModelSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(z.unknown()),
  edges: z.array(z.unknown()).optional(),
  metadata: z.object({
    created: z.union([z.date(), z.string()]).optional(),
    updated: z.union([z.date(), z.string()]).optional(),
    version: z.string().optional(),
    author: z.string().optional(),
    // Marketplace metadata
    marketplaceId: z.string().optional(),
    published: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    license: z.string().optional(),
    // Collaboration metadata
    collaborators: z.array(z.string()).optional(),
    forkOf: z.string().optional(), // Original model ID if this is a fork
    forks: z.number().optional(), // Number of forks
    stars: z.number().optional(), // Number of stars/likes
    // Dependencies
    dependencies: z.array(z.string()).optional(), // Other model IDs this depends on
  }).optional(),
});

export type ModelData = z.infer<typeof ModelSchema>;

export class Model {
  public readonly name: string;
  public description?: string;
  private variableMap: Map<string, Variable>;
  private edgeMap: Map<string, Edge>;
  public metadata?: {
    created?: Date;
    updated?: Date;
    version?: string;
    author?: string;
    // Marketplace metadata
    marketplaceId?: string;
    published?: boolean;
    tags?: string[];
    category?: string;
    license?: string;
    // Collaboration metadata
    collaborators?: string[];
    forkOf?: string;
    forks?: number;
    stars?: number;
    // Dependencies
    dependencies?: string[];
  };

  constructor(data: Partial<ModelData> & { name: string }) {
    this.name = data.name;
    this.description = data.description;
    this.metadata = data.metadata ? {
      created: data.metadata.created instanceof Date ? data.metadata.created : (data.metadata.created ? new Date(data.metadata.created) : undefined),
      updated: data.metadata.updated instanceof Date ? data.metadata.updated : (data.metadata.updated ? new Date(data.metadata.updated) : undefined),
      version: data.metadata.version,
      author: data.metadata.author,
      // Marketplace metadata
      marketplaceId: data.metadata.marketplaceId,
      published: data.metadata.published,
      tags: data.metadata.tags,
      category: data.metadata.category,
      license: data.metadata.license,
      // Collaboration metadata
      collaborators: data.metadata.collaborators,
      forkOf: data.metadata.forkOf,
      forks: data.metadata.forks,
      stars: data.metadata.stars,
      // Dependencies
      dependencies: data.metadata.dependencies,
    } : undefined;
    this.variableMap = new Map();
    this.edgeMap = new Map();

    if (data.variables) {
      for (const varData of data.variables) {
        const variable = Variable.fromJSON(varData);
        this.variableMap.set(variable.name, variable);
      }
    }

    if (data.edges) {
      for (const edgeData of data.edges) {
        const edge = Edge.fromJSON(edgeData);
        this.edgeMap.set(edge.id, edge);
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

  // Edge management methods
  addEdge(edge: Edge): void {
    // Validate edge endpoints exist
    if (!this.hasVariable(edge.source)) {
      throw new Error(`Source variable '${edge.source}' not found`);
    }
    if (!this.hasVariable(edge.target)) {
      throw new Error(`Target variable '${edge.target}' not found`);
    }

    // Validate edge
    const validation = edge.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid edge: ${validation.errors.join(', ')}`);
    }

    this.edgeMap.set(edge.id, edge);
    this.touch();
  }

  removeEdge(edgeId: string): boolean {
    const removed = this.edgeMap.delete(edgeId);
    if (removed) this.touch();
    return removed;
  }

  getEdge(edgeId: string): Edge | undefined {
    return this.edgeMap.get(edgeId);
  }

  hasEdge(edgeId: string): boolean {
    return this.edgeMap.has(edgeId);
  }

  listEdges(): Edge[] {
    return Array.from(this.edgeMap.values());
  }

  getEdgesForVariable(variableName: string): { incoming: Edge[]; outgoing: Edge[] } {
    const edges = this.listEdges();
    return {
      incoming: edges.filter(edge => edge.target === variableName),
      outgoing: edges.filter(edge => edge.source === variableName)
    };
  }

  getEdgesByType(type: string): Edge[] {
    return this.listEdges().filter(edge => edge.type === type);
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

  // Marketplace methods
  isPublished(): boolean {
    return !!this.metadata?.published;
  }

  isFromMarketplace(): boolean {
    return !!this.metadata?.marketplaceId;
  }

  isFork(): boolean {
    return !!this.metadata?.forkOf;
  }

  getMarketplaceInfo(): {
    id?: string;
    published?: boolean;
    author?: string;
    version?: string;
    tags?: string[];
    stars?: number;
    forks?: number;
  } {
    return {
      id: this.metadata?.marketplaceId,
      published: this.metadata?.published,
      author: this.metadata?.author,
      version: this.metadata?.version,
      tags: this.metadata?.tags,
      stars: this.metadata?.stars,
      forks: this.metadata?.forks
    };
  }

  addTag(tag: string): void {
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.tags) this.metadata.tags = [];
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
      this.touch();
    }
  }

  removeTag(tag: string): boolean {
    if (!this.metadata?.tags) return false;
    const index = this.metadata.tags.indexOf(tag);
    if (index >= 0) {
      this.metadata.tags.splice(index, 1);
      this.touch();
      return true;
    }
    return false;
  }

  addCollaborator(collaborator: string): void {
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.collaborators) this.metadata.collaborators = [];
    if (!this.metadata.collaborators.includes(collaborator)) {
      this.metadata.collaborators.push(collaborator);
      this.touch();
    }
  }

  removeCollaborator(collaborator: string): boolean {
    if (!this.metadata?.collaborators) return false;
    const index = this.metadata.collaborators.indexOf(collaborator);
    if (index >= 0) {
      this.metadata.collaborators.splice(index, 1);
      this.touch();
      return true;
    }
    return false;
  }

  // Graph composition methods
  mergeModel(otherModel: Model, prefix?: string): void {
    // Merge variables with optional prefix
    for (const variable of otherModel.listVariables()) {
      const newName = prefix ? `${prefix}_${variable.name}` : variable.name;
      const newVariable = variable.clone();
      
      // Update variable name and dependencies
      (newVariable as any).name = newName;
      if (prefix && newVariable.dependencies.length > 0) {
        newVariable.dependencies = newVariable.dependencies.map(dep => 
          otherModel.hasVariable(dep) ? `${prefix}_${dep}` : dep
        );
      }

      this.addVariable(newVariable);
    }

    // Merge edges with updated variable names
    for (const edge of otherModel.listEdges()) {
      const newEdge = edge.clone();
      if (prefix) {
        (newEdge as any).source = otherModel.hasVariable(edge.source) ? `${prefix}_${edge.source}` : edge.source;
        (newEdge as any).target = otherModel.hasVariable(edge.target) ? `${prefix}_${edge.target}` : edge.target;
        (newEdge as any).id = `${prefix}_${edge.id}`;
      }
      
      try {
        this.addEdge(newEdge);
      } catch (error) {
        // Skip edges that reference variables not in this model
        console.warn(`Skipping edge ${newEdge.id}: ${error}`);
      }
    }

    // Update dependencies metadata
    if (!this.metadata) this.metadata = {};
    if (!this.metadata.dependencies) this.metadata.dependencies = [];
    const otherModelId = otherModel.metadata?.marketplaceId;
    if (otherModelId && !this.metadata.dependencies.includes(otherModelId)) {
      this.metadata.dependencies.push(otherModelId);
    }

    this.touch();
  }

  // Version management
  createVersion(): string {
    const version = this.generateVersion();
    if (!this.metadata) this.metadata = {};
    this.metadata.version = version;
    this.touch();
    return version;
  }

  private generateVersion(): string {
    const current = this.metadata?.version || '0.0.0';
    const parts = current.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch version
    return parts.join('.');
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
      edges: this.listEdges().map(e => e.toJSON()),
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