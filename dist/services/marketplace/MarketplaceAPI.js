import { Model } from '../models/Model.js';
import { ModelGraph } from '../models/ModelGraph.js';
// Simulated marketplace for now - would be replaced with actual database/API
export class MarketplaceAPI {
    models = new Map();
    nextId = 1;
    constructor() {
        // Initialize with some example models
        this.initializeExamples();
    }
    initializeExamples() {
        // Create example financial model
        const financialModel = new Model({
            name: 'basic-dcf',
            description: 'Basic Discounted Cash Flow model',
            variables: [],
            metadata: {
                author: 'marketplace',
                version: '1.0.0',
                tags: ['finance', 'dcf', 'valuation'],
                category: 'finance',
                license: 'MIT',
                created: new Date('2024-01-01'),
                updated: new Date('2024-01-01')
            }
        });
        this.publishModel(financialModel, 'marketplace');
    }
    async publishModel(model, userId) {
        const id = this.generateId();
        const marketplaceModel = {
            id,
            name: model.name,
            description: model.description,
            author: userId,
            version: model.metadata?.version || '1.0.0',
            tags: model.metadata?.tags || [],
            category: model.metadata?.category || 'general',
            license: model.metadata?.license || 'MIT',
            stars: 0,
            forks: 0,
            downloads: 0,
            created: model.metadata?.created || new Date(),
            updated: model.metadata?.updated || new Date(),
            model: model.clone(),
            dependencies: model.metadata?.dependencies || []
        };
        // Update model with marketplace metadata
        if (!model.metadata)
            model.metadata = {};
        model.metadata.marketplaceId = id;
        model.metadata.published = true;
        this.models.set(id, marketplaceModel);
        return id;
    }
    async getModel(id) {
        return this.models.get(id) || null;
    }
    async searchModels(query) {
        let results = Array.from(this.models.values());
        // Apply filters
        if (query.text) {
            const searchText = query.text.toLowerCase();
            results = results.filter(model => model.name.toLowerCase().includes(searchText) ||
                model.description?.toLowerCase().includes(searchText) ||
                model.tags.some(tag => tag.toLowerCase().includes(searchText)));
        }
        if (query.tags && query.tags.length > 0) {
            results = results.filter(model => query.tags.some(tag => model.tags.includes(tag)));
        }
        if (query.category) {
            results = results.filter(model => model.category === query.category);
        }
        if (query.author) {
            results = results.filter(model => model.author === query.author);
        }
        if (query.minStars !== undefined) {
            results = results.filter(model => model.stars >= query.minStars);
        }
        if (query.license) {
            results = results.filter(model => model.license === query.license);
        }
        // Sort by relevance (stars + downloads)
        results.sort((a, b) => (b.stars + b.downloads) - (a.stars + a.downloads));
        // Apply pagination
        const offset = query.offset || 0;
        const limit = query.limit || 20;
        const total = results.length;
        const hasMore = offset + limit < total;
        results = results.slice(offset, offset + limit);
        return {
            models: results,
            total,
            hasMore
        };
    }
    async forkModel(originalId, userId, newName) {
        const original = await this.getModel(originalId);
        if (!original) {
            throw new Error('Original model not found');
        }
        const forkedModel = original.model.clone();
        forkedModel.metadata = {
            ...forkedModel.metadata,
            forkOf: originalId,
            author: userId,
            created: new Date(),
            updated: new Date(),
            version: '1.0.0',
            marketplaceId: undefined,
            published: false
        };
        if (newName) {
            forkedModel.name = newName;
        }
        // Increment fork count
        original.forks++;
        return await this.publishModel(forkedModel, userId);
    }
    async starModel(id) {
        const model = this.models.get(id);
        if (model) {
            model.stars++;
        }
    }
    async downloadModel(id) {
        const marketplaceModel = this.models.get(id);
        if (!marketplaceModel) {
            return null;
        }
        // Increment download count
        marketplaceModel.downloads++;
        return marketplaceModel.model.clone();
    }
    async getCategories() {
        const categories = new Set();
        for (const model of this.models.values()) {
            categories.add(model.category);
        }
        return Array.from(categories).sort();
    }
    async getPopularTags(limit = 20) {
        const tagCounts = new Map();
        for (const model of this.models.values()) {
            for (const tag of model.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
    async getModelDependencies(id) {
        const model = await this.getModel(id);
        if (!model) {
            return [];
        }
        const dependencies = [];
        for (const depId of model.dependencies) {
            const dep = await this.getModel(depId);
            if (dep) {
                dependencies.push(dep);
            }
        }
        return dependencies;
    }
    async getModelDependents(id) {
        const dependents = [];
        for (const model of this.models.values()) {
            if (model.dependencies.includes(id)) {
                dependents.push(model);
            }
        }
        return dependents;
    }
    // Analytics
    async getModelStats(id) {
        const model = await this.getModel(id);
        if (!model) {
            return null;
        }
        const dependents = await this.getModelDependents(id);
        const graph = new ModelGraph(model.model);
        const graphStats = graph.getStatistics();
        return {
            stars: model.stars,
            forks: model.forks,
            downloads: model.downloads,
            dependents: dependents.length,
            graphStats
        };
    }
    generateId() {
        return `model_${this.nextId++}`;
    }
}
