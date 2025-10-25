import { z } from 'zod';
export const EdgeTypeSchema = z.enum([
    'dependency', // Direct dependency relationship
    'temporal', // Time-based dependency (e.g., lag relationships)
    'causal', // Causal relationship
    'derived', // Derived calculation
    'constraint', // Mathematical constraint
    'inheritance' // Inherited from marketplace model
]);
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
export const EdgeSchema = z.object({
    id: z.string(),
    source: z.string(), // Source variable name
    target: z.string(), // Target variable name
    type: EdgeTypeSchema,
    metadata: EdgeMetadataSchema,
});
export class Edge {
    constructor(data) {
        const validated = EdgeSchema.parse(data);
        this.id = validated.id;
        this.source = validated.source;
        this.target = validated.target;
        this.type = validated.type;
        this.metadata = validated.metadata;
    }
    // Relationship properties
    isDependency() {
        return this.type === 'dependency';
    }
    isTemporal() {
        return this.type === 'temporal' || (this.metadata?.lag !== undefined);
    }
    isFromMarketplace() {
        return !!this.metadata?.marketplaceId;
    }
    // Strength and confidence
    getStrength() {
        return this.metadata?.strength ?? 1.0;
    }
    getConfidence() {
        return this.metadata?.confidence ?? 1.0;
    }
    getLag() {
        return this.metadata?.lag ?? 0;
    }
    // Validation
    validate() {
        const errors = [];
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
    getMarketplaceInfo() {
        return {
            id: this.metadata?.marketplaceId,
            author: this.metadata?.author,
            derivedFrom: this.metadata?.derivedFrom
        };
    }
    // Clone and serialization
    clone() {
        return new Edge({
            id: this.id,
            source: this.source,
            target: this.target,
            type: this.type,
            metadata: this.metadata ? { ...this.metadata } : undefined
        });
    }
    toJSON() {
        return {
            id: this.id,
            source: this.source,
            target: this.target,
            type: this.type,
            metadata: this.metadata
        };
    }
    static fromJSON(data) {
        return new Edge(EdgeSchema.parse(data));
    }
    // Utility methods
    static generateId(source, target, type) {
        return `${source}-${type}-${target}-${Date.now()}`;
    }
    static createDependencyEdge(source, target, metadata) {
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
    static createTemporalEdge(source, target, lag, metadata) {
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
