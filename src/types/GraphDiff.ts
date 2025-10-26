// Graph Diff Types for Bulk Operations

export interface GraphNode {
  id: string;
  name: string;
  type: 'scalar' | 'series' | 'parameter';
  formula?: string;
  values?: number[];
  metadata?: Record<string, any>;
  dependencies?: string[];
  position3D?: { x: number; y: number; z: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'temporal' | 'causal' | 'derived' | 'constraint';
  metadata?: Record<string, any>;
  strength?: number;
  lag?: number;
}

export interface GraphData {
  model?: {
    name: string;
    description?: string;
    metadata?: Record<string, any>;
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeDiff {
  added: GraphNode[];
  modified: {
    old: GraphNode;
    new: GraphNode;
    changes: string[];
  }[];
  deleted: GraphNode[];
}

export interface EdgeDiff {
  added: GraphEdge[];
  modified: {
    old: GraphEdge;
    new: GraphEdge;
    changes: string[];
  }[];
  deleted: GraphEdge[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cycles?: string[][];
  unreachableNodes?: string[];
  duplicateNames?: string[];
}

export interface GraphDiff {
  modelName: string;
  timestamp: Date;
  validation: ValidationResult;
  changes: {
    nodes: NodeDiff;
    edges: EdgeDiff;
  };
  stats: {
    totalNodesAdded: number;
    totalNodesModified: number;
    totalNodesDeleted: number;
    totalEdgesAdded: number;
    totalEdgesModified: number;
    totalEdgesDeleted: number;
  };
}

export interface ApplyDiffResult {
  success: boolean;
  appliedChanges: {
    nodesAdded: number;
    nodesModified: number;
    nodesDeleted: number;
    edgesAdded: number;
    edgesModified: number;
    edgesDeleted: number;
  };
  errors?: string[];
  transactionId?: string;
  rollbackInfo?: {
    canRollback: boolean;
    rollbackId?: string;
  };
}

export interface DiffGenerationOptions {
  validateOnly?: boolean;
  includeWarnings?: boolean;
  skipCycleDetection?: boolean;
  compareMode?: 'strict' | 'lenient'; // strict = exact match, lenient = allow minor differences
}

export interface ApplyDiffOptions {
  dryRun?: boolean;
  createBackup?: boolean;
  continueOnError?: boolean;
  batchSize?: number; // for large updates
}