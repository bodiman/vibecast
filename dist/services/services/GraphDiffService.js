import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge } from '../models/Edge.js';
export class GraphDiffService {
    dbStorage;
    constructor(dbStorage) {
        this.dbStorage = dbStorage;
    }
    async generateDiff(modelName, newGraphData, options = {}) {
        try {
            // Load current model from database
            const currentModel = await this.dbStorage.loadModel(modelName);
            // Convert new graph data to Model format
            const newModel = this.convertGraphDataToModel(newGraphData);
            // Generate diff
            const diff = this.computeDiff(currentModel, newModel, options);
            // Validate the diff
            const validation = await this.validateDiff(diff, options);
            return {
                modelName,
                changes: diff,
                validation,
                metadata: {
                    timestamp: new Date().toISOString(),
                    diffId: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    options
                }
            };
        }
        catch (error) {
            throw new Error(`Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async applyDiff(diff, options = {}) {
        try {
            if (options.dryRun) {
                return {
                    success: true,
                    appliedChanges: {
                        nodesAdded: diff.changes.nodes.added.length,
                        nodesModified: diff.changes.nodes.modified.length,
                        nodesDeleted: diff.changes.nodes.deleted.length,
                        edgesAdded: diff.changes.edges.added.length,
                        edgesModified: diff.changes.edges.modified.length,
                        edgesDeleted: diff.changes.edges.deleted.length,
                    },
                    transactionId: 'dry_run_' + Date.now()
                };
            }
            // Apply the diff using database storage
            const result = await this.dbStorage.applyGraphDiff(diff);
            return {
                success: true,
                appliedChanges: result.appliedChanges,
                transactionId: result.transactionId,
                rollbackInfo: {
                    canRollback: true,
                    rollbackId: result.transactionId
                }
            };
        }
        catch (error) {
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
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    convertGraphDataToModel(graphData) {
        const variables = graphData.nodes?.map((node) => new Variable({
            name: node.name,
            type: node.type || 'scalar',
            formula: node.formula,
            values: node.values,
            metadata: node.metadata,
            dependencies: node.dependencies || []
        })) || [];
        const edges = graphData.edges?.map((edge) => new Edge({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            metadata: edge.metadata
        })) || [];
        return new Model({
            name: graphData.model?.name || 'converted_model',
            description: graphData.model?.description,
            metadata: graphData.model?.metadata,
            variables,
            edges
        });
    }
    computeDiff(currentModel, newModel, options) {
        const currentNodes = currentModel.listVariables();
        const newNodes = newModel.listVariables();
        const currentEdges = currentModel.listEdges();
        const newEdges = newModel.listEdges();
        // Find node changes
        const addedNodes = newNodes.filter(newNode => !currentNodes.some(currentNode => currentNode.name === newNode.name));
        const deletedNodes = currentNodes.filter(currentNode => !newNodes.some(newNode => newNode.name === currentNode.name));
        const modifiedNodes = newNodes.filter(newNode => {
            const currentNode = currentNodes.find(n => n.name === newNode.name);
            if (!currentNode)
                return false;
            return this.hasNodeChanged(currentNode, newNode, options.compareMode);
        }).map(newNode => ({
            old: currentNodes.find(n => n.name === newNode.name).toJSON(),
            new: newNode.toJSON()
        }));
        // Find edge changes
        const addedEdges = newEdges.filter(newEdge => !currentEdges.some(currentEdge => currentEdge.source === newEdge.source &&
            currentEdge.target === newEdge.target &&
            currentEdge.type === newEdge.type));
        const deletedEdges = currentEdges.filter(currentEdge => !newEdges.some(newEdge => newEdge.source === currentEdge.source &&
            newEdge.target === currentEdge.target &&
            newEdge.type === currentEdge.type));
        const modifiedEdges = newEdges.filter(newEdge => {
            const currentEdge = currentEdges.find(e => e.source === newEdge.source &&
                e.target === newEdge.target &&
                e.type === newEdge.type);
            if (!currentEdge)
                return false;
            return this.hasEdgeChanged(currentEdge, newEdge, options.compareMode);
        }).map(newEdge => ({
            old: currentEdges.find(e => e.source === newEdge.source &&
                e.target === newEdge.target &&
                e.type === newEdge.type).toJSON(),
            new: newEdge.toJSON()
        }));
        return {
            nodes: {
                added: addedNodes.map(n => n.toJSON()),
                modified: modifiedNodes,
                deleted: deletedNodes.map(n => n.toJSON())
            },
            edges: {
                added: addedEdges.map(e => e.toJSON()),
                modified: modifiedEdges,
                deleted: deletedEdges.map(e => e.toJSON())
            }
        };
    }
    hasNodeChanged(current, updated, compareMode) {
        if (compareMode === 'lenient') {
            // Only check critical fields
            return current.type !== updated.type ||
                current.formula !== updated.formula;
        }
        else {
            // Strict comparison
            return JSON.stringify(current.toJSON()) !== JSON.stringify(updated.toJSON());
        }
    }
    hasEdgeChanged(current, updated, compareMode) {
        if (compareMode === 'lenient') {
            // Only check critical fields
            return current.type !== updated.type;
        }
        else {
            // Strict comparison
            return JSON.stringify(current.toJSON()) !== JSON.stringify(updated.toJSON());
        }
    }
    async validateDiff(diff, options) {
        const errors = [];
        const warnings = [];
        // Validate node changes
        for (const addedNode of diff.nodes.added) {
            if (!addedNode.name || typeof addedNode.name !== 'string') {
                errors.push(`Added node has invalid name: ${addedNode.name}`);
            }
            if (addedNode.type && !['scalar', 'series', 'parameter'].includes(addedNode.type)) {
                errors.push(`Added node ${addedNode.name} has invalid type: ${addedNode.type}`);
            }
        }
        // Validate edge changes
        for (const addedEdge of diff.edges.added) {
            if (!addedEdge.source || !addedEdge.target) {
                errors.push(`Added edge has missing source or target: ${addedEdge.id}`);
            }
            if (addedEdge.type && !['dependency', 'temporal', 'causal', 'derived', 'constraint'].includes(addedEdge.type)) {
                errors.push(`Added edge ${addedEdge.id} has invalid type: ${addedEdge.type}`);
            }
        }
        // Check for circular dependencies if not skipped
        if (!options.skipCycleDetection) {
            // This would require building a graph and checking for cycles
            // For now, just add a warning
            warnings.push('Cycle detection not implemented yet');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings: options.includeWarnings ? warnings : []
        };
    }
}
