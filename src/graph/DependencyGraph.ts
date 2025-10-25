import { Variable } from '../models/Variable.js';
import { Model } from '../models/Model.js';

export interface GraphNode {
  name: string;
  variable: Variable;
  dependencies: string[];
  dependents: string[];
  level: number; // For topological ordering
  isTimeDependent: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'direct' | 'temporal';
}

export class DependencyGraph {
  private nodes: Map<string, GraphNode>;
  private edges: GraphEdge[];

  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  buildFromModel(model: Model): void {
    this.nodes.clear();
    this.edges.length = 0;

    // Create nodes for all variables
    for (const variable of model.listVariables()) {
      const node: GraphNode = {
        name: variable.name,
        variable: variable,
        dependencies: [...variable.dependencies],
        dependents: [],
        level: 0,
        isTimeDependent: variable.isTimeDependent(),
      };
      this.nodes.set(variable.name, node);
    }

    // Build edges and dependent relationships
    for (const variable of model.listVariables()) {
      for (const depName of variable.dependencies) {
        // Extract base variable name from time references
        const baseDepName = this.extractBaseVariableName(depName);
        
        this.addEdge(baseDepName, variable.name, depName.includes('[t') ? 'temporal' : 'direct');
        
        const depNode = this.nodes.get(baseDepName);
        if (depNode) {
          depNode.dependents.push(variable.name);
        }
      }
    }

    // Calculate topological levels
    this.calculateLevels();
  }

  getNode(name: string): GraphNode | undefined {
    return this.nodes.get(name);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): GraphEdge[] {
    return [...this.edges];
  }

  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (nodeName: string): void => {
      if (visiting.has(nodeName)) {
        throw new Error(`Circular dependency detected involving variable '${nodeName}'`);
      }
      
      if (visited.has(nodeName)) {
        return;
      }

      visiting.add(nodeName);
      
      const node = this.nodes.get(nodeName);
      if (node) {
        for (const depName of node.dependencies) {
          // Only visit dependencies that exist in the graph
          if (this.nodes.has(depName)) {
            visit(depName);
          }
        }
      }

      visiting.delete(nodeName);
      visited.add(nodeName);
      result.push(nodeName);
    };

    // Visit all nodes
    for (const nodeName of this.nodes.keys()) {
      if (!visited.has(nodeName)) {
        visit(nodeName);
      }
    }

    return result;
  }

  getEvaluationGroups(): string[][] {
    const groups: string[][] = [];
    const levelMap = new Map<number, string[]>();

    // Group nodes by level
    for (const node of this.nodes.values()) {
      const level = node.level;
      if (!levelMap.has(level)) {
        levelMap.set(level, []);
      }
      levelMap.get(level)!.push(node.name);
    }

    // Sort groups by level
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      groups.push(levelMap.get(level)!);
    }

    return groups;
  }

  getDependents(variableName: string): string[] {
    const node = this.nodes.get(variableName);
    return node ? [...node.dependents] : [];
  }

  getDependencies(variableName: string): string[] {
    const node = this.nodes.get(variableName);
    return node ? [...node.dependencies] : [];
  }

  getAllDependencies(variableName: string): Set<string> {
    const visited = new Set<string>();
    const dependencies = new Set<string>();

    const collectDeps = (nodeName: string): void => {
      if (visited.has(nodeName)) return;
      visited.add(nodeName);

      const node = this.nodes.get(nodeName);
      if (node) {
        for (const depName of node.dependencies) {
          dependencies.add(depName);
          collectDeps(depName);
        }
      }
    };

    collectDeps(variableName);
    return dependencies;
  }

  getAllDependents(variableName: string): Set<string> {
    const visited = new Set<string>();
    const dependents = new Set<string>();

    const collectDependents = (nodeName: string): void => {
      if (visited.has(nodeName)) return;
      visited.add(nodeName);

      const node = this.nodes.get(nodeName);
      if (node) {
        for (const depName of node.dependents) {
          dependents.add(depName);
          collectDependents(depName);
        }
      }
    };

    collectDependents(variableName);
    return dependents;
  }

  isAcyclic(): boolean {
    try {
      this.getTopologicalOrder();
      return true;
    } catch (error) {
      return false;
    }
  }

  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];

    const visit = (nodeName: string): void => {
      if (visiting.has(nodeName)) {
        // Found a cycle - extract it from the path
        const cycleStart = path.indexOf(nodeName);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), nodeName]);
        }
        return;
      }
      
      if (visited.has(nodeName)) {
        return;
      }

      visiting.add(nodeName);
      path.push(nodeName);
      
      const node = this.nodes.get(nodeName);
      if (node) {
        for (const depName of node.dependencies) {
          visit(depName);
        }
      }

      path.pop();
      visiting.delete(nodeName);
      visited.add(nodeName);
    };

    for (const nodeName of this.nodes.keys()) {
      if (!visited.has(nodeName)) {
        visit(nodeName);
      }
    }

    return cycles;
  }

  private addEdge(from: string, to: string, type: 'direct' | 'temporal'): void {
    this.edges.push({ from, to, type });
  }

  private extractBaseVariableName(depName: string): string {
    // Extract base variable name from time references like VAR[t-1] -> VAR
    const timeRefMatch = depName.match(/^([A-Za-z_][A-Za-z0-9_]*)\[t[+-]?\d*\]$/);
    if (timeRefMatch) {
      return timeRefMatch[1];
    }
    return depName;
  }

  private calculateLevels(): void {
    // Initialize all levels to 0
    for (const node of this.nodes.values()) {
      node.level = 0;
    }

    // Calculate levels using longest path from sources
    const topOrder = this.getTopologicalOrder();
    
    for (const nodeName of topOrder) {
      const node = this.nodes.get(nodeName)!;
      
      // Set level based on maximum dependency level + 1
      let maxDepLevel = -1;
      for (const depName of node.dependencies) {
        const depNode = this.nodes.get(depName);
        if (depNode) {
          maxDepLevel = Math.max(maxDepLevel, depNode.level);
        }
      }
      
      node.level = maxDepLevel + 1;
    }
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getEdges(),
    };
  }

  getStatistics(): {
    nodeCount: number;
    edgeCount: number;
    maxLevel: number;
    timeDependentNodes: number;
    cycleCount: number;
  } {
    const cycles = this.findCycles();
    const timeDependentNodes = this.getAllNodes().filter(n => n.isTimeDependent).length;
    const maxLevel = Math.max(...this.getAllNodes().map(n => n.level));

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      maxLevel,
      timeDependentNodes,
      cycleCount: cycles.length,
    };
  }
}