import { z } from 'zod';

export const EdgeTypeSchema = z.enum([
  'dependency',     // Direct dependency relationship
  'temporal',       // Time-based dependency (e.g., lag relationships)
  'causal',         // Causal relationship
  'derived',        // Derived calculation
  'constraint',     // Mathematical constraint
  'inheritance'     // Inherited from marketplace model
]);

export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const EdgeMetadataSchema = z.object({
  description: z.string().optional(),
  strength: z.number().min(0).max(1).optional(), // Relationship strength 0-1
  confidence: z.number().min(0).max(1).optional(), // Confidence in relationship
  lag: z.number().optional(), // Time lag for temporal relationships
  author: z.string().optional(),
  created: z.union([z.date(), z.string()]).optional(),
  // Marketplace provenance
  marketplaceId: z.string().optional(),
  derivedFrom: z.string().optional(), // Original edge ID if derived
}).optional();

export type EdgeMetadata = z.infer<typeof EdgeMetadataSchema>;

export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(), // Source variable name
  target: z.string(), // Target variable name
  type: EdgeTypeSchema,
  metadata: EdgeMetadataSchema,
});

export type EdgeData = z.infer<typeof EdgeSchema>;

export class Edge {
  public readonly id: string;
  public readonly source: string;
  public readonly target: string;
  public type: EdgeType;
  public metadata?: EdgeMetadata;

  constructor(data: EdgeData) {
    const validated = EdgeSchema.parse(data);
    
    this.id = validated.id;
    this.source = validated.source;
    this.target = validated.target;
    this.type = validated.type;
    this.metadata = validated.metadata;
  }

  // Relationship properties
  isDependency(): boolean {
    return this.type === 'dependency';
  }

  isTemporal(): boolean {
    return this.type === 'temporal' || (this.metadata?.lag !== undefined);
  }

  isFromMarketplace(): boolean {
    return !!this.metadata?.marketplaceId;
  }

  // Strength and confidence
  getStrength(): number {
    return this.metadata?.strength ?? 1.0;
  }

  getConfidence(): number {
    return this.metadata?.confidence ?? 1.0;
  }

  getLag(): number {
    return this.metadata?.lag ?? 0;
  }

  // Validation
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check temporal consistency
    if (this.type === 'temporal' && this.metadata?.lag === undefined) {
      errors.push('Lag must be specified for temporal edges');
    }

    // Validate strength and confidence ranges
    if (this.metadata?.strength !== undefined && (this.metadata.strength < 0 || this.metadata.strength > 1)) {
      errors.push('Strength must be between 0 and 1');
    }

    if (this.metadata?.confidence !== undefined && (this.metadata.confidence < 0 || this.metadata.confidence > 1)) {
      errors.push('Confidence must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Marketplace methods
  getMarketplaceInfo(): { id?: string; author?: string; derivedFrom?: string } {
    return {
      id: this.metadata?.marketplaceId,
      author: this.metadata?.author,
      derivedFrom: this.metadata?.derivedFrom
    };
  }

  // Clone and serialization
  clone(): Edge {
    return new Edge({
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      metadata: this.metadata ? { ...this.metadata } : undefined
    });
  }

  toJSON(): EdgeData {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      metadata: this.metadata
    };
  }

  static fromJSON(data: unknown): Edge {
    return new Edge(EdgeSchema.parse(data));
  }

  // Utility methods
  static generateId(source: string, target: string, type: EdgeType): string {
    return `${source}-${type}-${target}-${Date.now()}`;
  }

  static createDependencyEdge(source: string, target: string, metadata?: Partial<EdgeMetadata>): Edge {
    return new Edge({
      id: Edge.generateId(source, target, 'dependency'),
      source,
      target,
      type: 'dependency',
      metadata: {
        ...metadata,
        created: new Date()
      }
    });
  }

  static createTemporalEdge(source: string, target: string, lag: number, metadata?: Partial<EdgeMetadata>): Edge {
    return new Edge({
      id: Edge.generateId(source, target, 'temporal'),
      source,
      target,
      type: 'temporal',
      metadata: {
        ...metadata,
        lag,
        created: new Date()
      }
    });
  }
}