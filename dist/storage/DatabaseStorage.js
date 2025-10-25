import { PrismaClient } from '@prisma/client';
import { Model } from '../models/Model.js';
import { Variable } from '../models/Variable.js';
import { Edge } from '../models/Edge.js';
import { MarketplaceAPI } from '../marketplace/MarketplaceAPI.js';
export class DatabaseStorage {
    constructor(config = {}) {
        this.config = config;
        const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
        // Only create PrismaClient if we have a valid database URL
        if (databaseUrl) {
            this.prisma = new PrismaClient({
                datasourceUrl: databaseUrl
            });
        }
        else {
            // Create a dummy PrismaClient that will fail on use
            this.prisma = null;
        }
    }
    async initialize() {
        if (!this.prisma) {
            console.log('📁 Using file storage (no database configured)');
            return;
        }
        try {
            await this.prisma.$connect();
            console.log('✅ Connected to database');
        }
        catch (error) {
            console.error('❌ Failed to connect to database:', error);
            throw error;
        }
    }
    async disconnect() {
        if (this.prisma) {
            await this.prisma.$disconnect();
        }
    }
    // Model CRUD operations
    async saveModel(model) {
        try {
            await this.prisma.$transaction(async (tx) => {
                // Upsert the model
                const dbModel = await tx.model.upsert({
                    where: { name: model.name },
                    update: {
                        description: model.description,
                        metadata: model.metadata,
                        version: model.metadata?.version || '1.0.0',
                        updatedAt: new Date()
                    },
                    create: {
                        name: model.name,
                        description: model.description,
                        metadata: model.metadata,
                        version: model.metadata?.version || '1.0.0'
                    }
                });
                // Delete existing variables and edges (will be recreated)
                await tx.edge.deleteMany({ where: { modelId: dbModel.id } });
                await tx.variable.deleteMany({ where: { modelId: dbModel.id } });
                // Create variables
                const variableIds = new Map();
                for (const variable of model.listVariables()) {
                    const dbVariable = await tx.variable.create({
                        data: {
                            name: variable.name,
                            type: variable.type,
                            formula: variable.formula,
                            values: variable.values,
                            metadata: variable.metadata,
                            modelId: dbModel.id
                        }
                    });
                    variableIds.set(variable.name, dbVariable.id);
                }
                // Create edges
                for (const edge of model.listEdges()) {
                    const sourceId = variableIds.get(edge.source);
                    const targetId = variableIds.get(edge.target);
                    if (sourceId && targetId) {
                        await tx.edge.create({
                            data: {
                                type: edge.type,
                                metadata: edge.metadata,
                                modelId: dbModel.id,
                                sourceId,
                                targetId
                            }
                        });
                    }
                }
                // Update marketplace data if model is published
                if (model.metadata?.published) {
                    await tx.marketplaceModel.upsert({
                        where: { modelId: dbModel.id },
                        update: {
                            author: model.metadata?.author || 'unknown',
                            tags: model.metadata?.tags || [],
                            category: model.metadata?.category || 'general',
                            license: model.metadata?.license || 'MIT',
                            dependencies: model.metadata?.dependencies || []
                        },
                        create: {
                            modelId: dbModel.id,
                            author: model.metadata?.author || 'unknown',
                            tags: model.metadata?.tags || [],
                            category: model.metadata?.category || 'general',
                            license: model.metadata?.license || 'MIT',
                            dependencies: model.metadata?.dependencies || []
                        }
                    });
                }
            });
        }
        catch (error) {
            throw new Error(`Failed to save model '${model.name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async loadModel(name) {
        try {
            const dbModel = await this.prisma.model.findUnique({
                where: { name },
                include: {
                    variables: true,
                    edges: {
                        include: {
                            source: true,
                            target: true
                        }
                    },
                    marketplace: true
                }
            });
            if (!dbModel) {
                throw new Error(`Model '${name}' not found`);
            }
            // Convert database model to our Model class
            const variables = dbModel.variables.map(v => {
                return new Variable({
                    name: v.name,
                    type: v.type,
                    formula: v.formula || undefined,
                    values: v.values || undefined,
                    metadata: v.metadata || undefined
                });
            });
            const edges = dbModel.edges.map(e => {
                return new Edge({
                    id: e.id,
                    source: e.source.name,
                    target: e.target.name,
                    type: e.type,
                    metadata: e.metadata
                });
            });
            // Merge marketplace metadata
            let metadata = dbModel.metadata || {};
            if (dbModel.marketplace) {
                metadata = {
                    ...metadata,
                    marketplaceId: dbModel.marketplace.id,
                    published: dbModel.marketplace.published,
                    author: dbModel.marketplace.author,
                    tags: dbModel.marketplace.tags,
                    category: dbModel.marketplace.category,
                    license: dbModel.marketplace.license,
                    stars: dbModel.marketplace.stars,
                    forks: dbModel.marketplace.forks,
                    downloads: dbModel.marketplace.downloads,
                    dependencies: dbModel.marketplace.dependencies
                };
            }
            const modelData = {
                name: dbModel.name,
                description: dbModel.description || undefined,
                variables: variables.map(v => v.toJSON()),
                edges: edges.map(e => e.toJSON()),
                metadata
            };
            return Model.fromJSON(modelData);
        }
        catch (error) {
            throw new Error(`Failed to load model '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async deleteModel(name) {
        try {
            const result = await this.prisma.model.delete({
                where: { name }
            });
        }
        catch (error) {
            if (error?.code === 'P2025') {
                throw new Error(`Model '${name}' not found`);
            }
            throw new Error(`Failed to delete model '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async listModels() {
        try {
            const models = await this.prisma.model.findMany({
                select: { name: true },
                orderBy: { updatedAt: 'desc' }
            });
            return models.map(m => m.name);
        }
        catch (error) {
            throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async modelExists(name) {
        try {
            const count = await this.prisma.model.count({
                where: { name }
            });
            return count > 0;
        }
        catch (error) {
            return false;
        }
    }
    async getModelInfo(name) {
        try {
            const model = await this.prisma.model.findUnique({
                where: { name },
                include: {
                    _count: {
                        select: {
                            variables: true,
                            edges: true
                        }
                    }
                }
            });
            if (!model) {
                throw new Error(`Model '${name}' not found`);
            }
            return {
                name: model.name,
                size: JSON.stringify(model).length, // Approximate size
                lastModified: model.updatedAt,
                variableCount: model._count.variables,
                edgeCount: model._count.edges
            };
        }
        catch (error) {
            throw new Error(`Failed to get model info for '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Graph queries for 3D visualization
    async getGraphData(modelName) {
        try {
            const model = await this.prisma.model.findUnique({
                where: { name: modelName },
                include: {
                    variables: true,
                    edges: {
                        include: {
                            source: true,
                            target: true
                        }
                    }
                }
            });
            if (!model) {
                throw new Error(`Model '${modelName}' not found`);
            }
            const nodes = model.variables.map(v => ({
                id: v.id,
                name: v.name,
                type: v.type,
                values: v.values,
                metadata: v.metadata,
                position3D: v.position3D ? v.position3D : undefined
            }));
            const edges = model.edges.map(e => ({
                id: e.id,
                source: e.source.name,
                target: e.target.name,
                type: e.type,
                metadata: e.metadata
            }));
            return { nodes, edges };
        }
        catch (error) {
            throw new Error(`Failed to get graph data for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async saveGraphLayout(modelName, nodePositions) {
        try {
            const model = await this.prisma.model.findUnique({
                where: { name: modelName }
            });
            if (!model) {
                throw new Error(`Model '${modelName}' not found`);
            }
            await this.prisma.graphLayout.upsert({
                where: { modelId: model.id },
                update: {
                    nodePositions: nodePositions,
                    updatedAt: new Date()
                },
                create: {
                    modelId: model.id,
                    nodePositions: nodePositions
                }
            });
            // Also update individual variable positions
            for (const [variableName, position] of Object.entries(nodePositions)) {
                await this.prisma.variable.updateMany({
                    where: {
                        modelId: model.id,
                        name: variableName
                    },
                    data: {
                        position3D: position
                    }
                });
            }
        }
        catch (error) {
            throw new Error(`Failed to save graph layout for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Version control
    async createVersion(modelName, changelog) {
        try {
            const model = await this.loadModel(modelName);
            const dbModel = await this.prisma.model.findUnique({
                where: { name: modelName }
            });
            if (!dbModel) {
                throw new Error(`Model '${modelName}' not found`);
            }
            // Generate next version number
            const latestVersion = await this.prisma.modelVersion.findFirst({
                where: { modelId: dbModel.id },
                orderBy: { createdAt: 'desc' }
            });
            const nextVersion = this.incrementVersion(latestVersion?.version || '1.0.0');
            await this.prisma.modelVersion.create({
                data: {
                    modelId: dbModel.id,
                    version: nextVersion,
                    snapshot: model.toJSON(),
                    changelog
                }
            });
            return nextVersion;
        }
        catch (error) {
            throw new Error(`Failed to create version for '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    incrementVersion(version) {
        const parts = version.split('.').map(Number);
        parts[2] = (parts[2] || 0) + 1;
        return parts.join('.');
    }
    // Health check for monitoring
    async healthCheck() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return {
                status: 'healthy',
                details: {
                    connected: true,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                details: {
                    connected: false,
                    error: error instanceof Error ? error.message : String(error),
                    timestamp: new Date().toISOString()
                }
            };
        }
    }
}
// Enhanced MarketplaceAPI that uses database storage
export class DatabaseMarketplaceAPI extends MarketplaceAPI {
    constructor(db) {
        super();
        this.db = db;
    }
    async searchModels(query) {
        try {
            const where = {};
            const include = {
                model: {
                    include: {
                        variables: true,
                        edges: true
                    }
                }
            };
            // Build search filters
            if (query.text) {
                where.OR = [
                    { model: { name: { contains: query.text, mode: 'insensitive' } } },
                    { model: { description: { contains: query.text, mode: 'insensitive' } } },
                    { tags: { hasSome: [query.text] } }
                ];
            }
            if (query.tags && query.tags.length > 0) {
                where.tags = { hasSome: query.tags };
            }
            if (query.category) {
                where.category = query.category;
            }
            if (query.author) {
                where.author = query.author;
            }
            if (query.minStars !== undefined) {
                where.stars = { gte: query.minStars };
            }
            if (query.license) {
                where.license = query.license;
            }
            // Execute query with pagination
            const [results, total] = await Promise.all([
                this.db['prisma'].marketplaceModel.findMany({
                    where,
                    include,
                    orderBy: [
                        { stars: 'desc' },
                        { downloads: 'desc' },
                        { publishedAt: 'desc' }
                    ],
                    skip: query.offset || 0,
                    take: query.limit || 20
                }),
                this.db['prisma'].marketplaceModel.count({ where })
            ]);
            const models = results.map(result => ({
                id: result.id,
                name: result.model.name,
                description: result.model.description,
                author: result.author,
                version: result.model.version,
                tags: result.tags,
                category: result.category,
                license: result.license,
                stars: result.stars,
                forks: result.forks,
                downloads: result.downloads,
                created: result.publishedAt,
                updated: result.model.updatedAt,
                model: Model.fromJSON({
                    name: result.model.name,
                    description: result.model.description,
                    variables: result.model.variables.map(v => ({
                        name: v.name,
                        type: v.type,
                        values: v.values,
                        metadata: v.metadata
                    })),
                    edges: result.model.edges.map(e => ({
                        source: '', // Will be resolved by model loading
                        target: '',
                        type: e.type,
                        metadata: e.metadata
                    })),
                    metadata: result.model.metadata
                }),
                dependencies: result.dependencies
            }));
            return {
                models,
                total,
                hasMore: (query.offset || 0) + (query.limit || 20) < total
            };
        }
        catch (error) {
            throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
