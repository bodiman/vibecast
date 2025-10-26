import { 
  GraphData, 
  GraphDiff, 
  GraphNode, 
  GraphEdge, 
  NodeDiff, 
  EdgeDiff, 
  ValidationResult, 
  ApplyDiffResult,
  DiffGenerationOptions,
  ApplyDiffOptions
} from '../types/GraphDiff.js';
import { DatabaseStorage } from '../storage/DatabaseStorage.js';
import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge } from '../models/Edge.js';
import { ModelGraph } from '../models/ModelGraph.js';

export class GraphDiffService {
  constructor(private dbStorage: DatabaseStorage) {}

  /**
   * Generate a diff between the current graph state and a new graph
   */
  async generateDiff(
    modelName: string,
    newGraphData: GraphData,
    options: DiffGenerationOptions = {}
  ): Promise<GraphDiff> {
    const timestamp = new Date();

    // Get current graph state from database
    let currentGraphData: GraphData;
    try {
      currentGraphData = await this.dbStorage.getGraphData(modelName);
    } catch (error) {
      // Model doesn't exist, treat as empty graph
      currentGraphData = { nodes: [], edges: [] };
    }

    // Generate node and edge diffs
    const nodeDiff = this.generateNodeDiff(currentGraphData.nodes, newGraphData.nodes);
    const edgeDiff = this.generateEdgeDiff(currentGraphData.edges, newGraphData.edges);

    // Validate the new graph structure
    const validation = await this.validateGraph(newGraphData, options);

    // Calculate stats
    const stats = {
      totalNodesAdded: nodeDiff.added.length,
      totalNodesModified: nodeDiff.modified.length,
      totalNodesDeleted: nodeDiff.deleted.length,
      totalEdgesAdded: edgeDiff.added.length,
      totalEdgesModified: edgeDiff.modified.length,
      totalEdgesDeleted: edgeDiff.deleted.length,
    };

    return {
      modelName,
      timestamp,
      validation,
      changes: {
        nodes: nodeDiff,
        edges: edgeDiff,
      },
      stats,
    };
  }

  /**
   * Apply a diff to the database
   */
  async applyDiff(
    diff: GraphDiff,
    options: ApplyDiffOptions = {}
  ): Promise<ApplyDiffResult> {
    const { dryRun = false, createBackup = true, continueOnError = false } = options;

    // Validate that the diff is still applicable
    if (!diff.validation.isValid && !continueOnError) {
      return {
        success: false,
        appliedChanges: {
          nodesAdded: 0,
          nodesModified: 0,
          nodesDeleted: 0,
          edgesAdded: 0,
          edgesModified: 0,
          edgesDeleted: 0,
        },
        errors: ['Cannot apply diff: validation failed', ...diff.validation.errors],
      };
    }

    if (dryRun) {
      return {
        success: true,
        appliedChanges: {
          nodesAdded: diff.stats.totalNodesAdded,
          nodesModified: diff.stats.totalNodesModified,
          nodesDeleted: diff.stats.totalNodesDeleted,
          edgesAdded: diff.stats.totalEdgesAdded,
          edgesModified: diff.stats.totalEdgesModified,
          edgesDeleted: diff.stats.totalEdgesDeleted,
        },
      };
    }

    try {
      // Create backup if requested
      let backupId: string | undefined;
      if (createBackup) {
        backupId = await this.createBackup(diff.modelName);
      }

      // Apply changes in transaction
      const result = await this.dbStorage.applyGraphDiff(diff);

      return {
        success: true,
        appliedChanges: result.appliedChanges,
        transactionId: result.transactionId,
        rollbackInfo: backupId ? {
          canRollback: true,
          rollbackId: backupId,
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        appliedChanges: {
          nodesAdded: 0,
          nodesModified: 0,
          nodesDeleted: 0,
          edgesAdded: 0,
          edgesModified: 0,
          edgesDeleted: 0,
        },
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate diff for nodes
   */
  private generateNodeDiff(currentNodes: GraphNode[], newNodes: GraphNode[]): NodeDiff {
    const currentMap = new Map(currentNodes.map(node => [node.id, node]));
    const newMap = new Map(newNodes.map(node => [node.id, node]));

    const added: GraphNode[] = [];
    const modified: NodeDiff['modified'] = [];
    const deleted: GraphNode[] = [];

    // Find added and modified nodes
    for (const newNode of newNodes) {
      const currentNode = currentMap.get(newNode.id);
      if (!currentNode) {
        added.push(newNode);
      } else {
        const changes = this.compareNodes(currentNode, newNode);
        if (changes.length > 0) {
          modified.push({
            old: currentNode,
            new: newNode,
            changes,
          });
        }
      }
    }

    // Find deleted nodes
    for (const currentNode of currentNodes) {
      if (!newMap.has(currentNode.id)) {
        deleted.push(currentNode);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Generate diff for edges
   */
  private generateEdgeDiff(currentEdges: GraphEdge[], newEdges: GraphEdge[]): EdgeDiff {
    const currentMap = new Map(currentEdges.map(edge => [edge.id, edge]));
    const newMap = new Map(newEdges.map(edge => [edge.id, edge]));

    const added: GraphEdge[] = [];
    const modified: EdgeDiff['modified'] = [];
    const deleted: GraphEdge[] = [];

    // Find added and modified edges
    for (const newEdge of newEdges) {
      const currentEdge = currentMap.get(newEdge.id);
      if (!currentEdge) {
        added.push(newEdge);
      } else {
        const changes = this.compareEdges(currentEdge, newEdge);
        if (changes.length > 0) {
          modified.push({
            old: currentEdge,
            new: newEdge,
            changes,
          });
        }
      }
    }

    // Find deleted edges
    for (const currentEdge of currentEdges) {
      if (!newMap.has(currentEdge.id)) {
        deleted.push(currentEdge);
      }
    }

    return { added, modified, deleted };
  }

  /**
   * Compare two nodes and return list of changes
   */
  private compareNodes(oldNode: GraphNode, newNode: GraphNode): string[] {
    const changes: string[] = [];

    if (oldNode.name !== newNode.name) {
      changes.push(`name: "${oldNode.name}" → "${newNode.name}"`);
    }
    if (oldNode.type !== newNode.type) {
      changes.push(`type: "${oldNode.type}" → "${newNode.type}"`);
    }
    if (oldNode.formula !== newNode.formula) {
      changes.push(`formula: "${oldNode.formula || ''}" → "${newNode.formula || ''}"`);
    }
    if (JSON.stringify(oldNode.values) !== JSON.stringify(newNode.values)) {
      changes.push('values changed');
    }
    if (JSON.stringify(oldNode.metadata) !== JSON.stringify(newNode.metadata)) {
      changes.push('metadata changed');
    }
    if (JSON.stringify(oldNode.dependencies) !== JSON.stringify(newNode.dependencies)) {
      changes.push('dependencies changed');
    }
    if (JSON.stringify(oldNode.position3D) !== JSON.stringify(newNode.position3D)) {
      changes.push('position3D changed');
    }

    return changes;
  }

  /**
   * Compare two edges and return list of changes
   */
  private compareEdges(oldEdge: GraphEdge, newEdge: GraphEdge): string[] {
    const changes: string[] = [];

    if (oldEdge.source !== newEdge.source) {
      changes.push(`source: "${oldEdge.source}" → "${newEdge.source}"`);
    }
    if (oldEdge.target !== newEdge.target) {
      changes.push(`target: "${oldEdge.target}" → "${newEdge.target}"`);
    }
    if (oldEdge.type !== newEdge.type) {
      changes.push(`type: "${oldEdge.type}" → "${newEdge.type}"`);
    }
    if (oldEdge.strength !== newEdge.strength) {
      changes.push(`strength: ${oldEdge.strength} → ${newEdge.strength}`);
    }
    if (oldEdge.lag !== newEdge.lag) {
      changes.push(`lag: ${oldEdge.lag} → ${newEdge.lag}`);
    }
    if (JSON.stringify(oldEdge.metadata) !== JSON.stringify(newEdge.metadata)) {
      changes.push('metadata changed');
    }

    return changes;
  }

  /**
   * Validate the graph structure
   */
  private async validateGraph(
    graphData: GraphData,
    options: DiffGenerationOptions
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
      errors.push('Nodes must be an array');
    }
    if (!graphData.edges || !Array.isArray(graphData.edges)) {
      errors.push('Edges must be an array');
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Validate nodes
    const nodeNames = new Set<string>();
    const nodeIds = new Set<string>();
    
    for (const [index, node] of graphData.nodes.entries()) {
      if (!node.id || typeof node.id !== 'string') {
        errors.push(`Node ${index}: id is required and must be a string`);
        continue;
      }
      if (!node.name || typeof node.name !== 'string') {
        errors.push(`Node ${index}: name is required and must be a string`);
        continue;
      }

      if (nodeIds.has(node.id)) {
        errors.push(`Node ${index}: duplicate id '${node.id}'`);
      }
      nodeIds.add(node.id);

      if (nodeNames.has(node.name)) {
        errors.push(`Node ${index}: duplicate name '${node.name}'`);
      }
      nodeNames.add(node.name);

      if (!['scalar', 'series', 'parameter'].includes(node.type)) {
        errors.push(`Node '${node.name}': type must be 'scalar', 'series', or 'parameter'`);
      }

      if (node.values && !Array.isArray(node.values)) {
        errors.push(`Node '${node.name}': values must be an array`);
      }

      if (node.dependencies && !Array.isArray(node.dependencies)) {
        errors.push(`Node '${node.name}': dependencies must be an array`);
      }
    }

    // Validate edges
    const edgeIds = new Set<string>();
    
    for (const [index, edge] of graphData.edges.entries()) {
      if (!edge.id || typeof edge.id !== 'string') {
        errors.push(`Edge ${index}: id is required and must be a string`);
        continue;
      }
      if (!edge.source || typeof edge.source !== 'string') {
        errors.push(`Edge ${index}: source is required and must be a string`);
        continue;
      }
      if (!edge.target || typeof edge.target !== 'string') {
        errors.push(`Edge ${index}: target is required and must be a string`);
        continue;
      }

      if (edgeIds.has(edge.id)) {
        errors.push(`Edge ${index}: duplicate id '${edge.id}'`);
      }
      edgeIds.add(edge.id);

      if (!['dependency', 'temporal', 'causal', 'derived', 'constraint'].includes(edge.type)) {
        errors.push(`Edge '${edge.id}': invalid type '${edge.type}'`);
      }

      // Check if source and target nodes exist
      if (!nodeIds.has(edge.source)) {
        errors.push(`Edge '${edge.id}': source node '${edge.source}' not found`);
      }
      if (!nodeIds.has(edge.target)) {
        errors.push(`Edge '${edge.id}': target node '${edge.target}' not found`);
      }
    }

    // Validate dependencies
    for (const node of graphData.nodes) {
      if (node.dependencies) {
        for (const dep of node.dependencies) {
          if (!nodeNames.has(dep)) {
            errors.push(`Node '${node.name}': dependency '${dep}' not found`);
          }
        }
      }
    }

    // Cycle detection (if not skipped)
    let cycles: string[][] = [];
    if (!options.skipCycleDetection && errors.length === 0) {
      cycles = this.detectCycles(graphData);
      if (cycles.length > 0) {
        errors.push(`Circular dependencies detected: ${cycles.map(c => c.join(' → ')).join(', ')}`);
      }
    }

    // Warnings
    if (options.includeWarnings) {
      // Check for isolated nodes
      const connectedNodes = new Set<string>();
      for (const edge of graphData.edges) {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
      }
      
      const isolatedNodes = graphData.nodes
        .filter(node => !connectedNodes.has(node.id))
        .map(node => node.name);
      
      if (isolatedNodes.length > 0) {
        warnings.push(`Isolated nodes (no connections): ${isolatedNodes.join(', ')}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      cycles: cycles.length > 0 ? cycles : undefined,
    };
  }

  /**
   * Detect cycles in the graph
   */
  private detectCycles(graphData: GraphData): string[][] {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    for (const node of graphData.nodes) {
      graph.set(node.id, []);
    }
    for (const edge of graphData.edges) {
      const targets = graph.get(edge.source) || [];
      targets.push(edge.target);
      graph.set(edge.source, targets);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycle.push(neighbor); // Complete the cycle
          cycles.push(cycle);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Create a backup of the current model state
   */
  private async createBackup(modelName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${modelName}_backup_${timestamp}`;
    
    try {
      const currentData = await this.dbStorage.getGraphData(modelName);
      await this.dbStorage.saveBackup(backupId, currentData);
      return backupId;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}