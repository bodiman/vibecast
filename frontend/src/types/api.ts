// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

// Graph Data Types
export interface GraphNode {
  id: string;
  name: string;
  type: 'scalar' | 'series' | 'parameter' | 'formula';
  values?: number[];
  metadata?: {
    description?: string;
    units?: string;
    [key: string]: any;
  };
  position3D?: { x: number; y: number; z: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'formula' | 'temporal' | 'causal' | 'derived' | 'constraint';
  formula?: string;
  metadata?: {
    description?: string;
    strength?: number;
    [key: string]: any;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Model Types
export interface ModelInfo {
  name: string;
  description?: string;
  size: number;
  lastModified: Date;
  variableCount: number;
  edgeCount: number;
}

export interface ModelListResponse {
  models: string[];
}

// Layout Types
export interface NodePosition {
  x: number;
  y: number;
  z: number;
}

export interface LayoutUpdateRequest {
  nodePositions: Record<string, NodePosition>;
}

// Environment Configuration
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}