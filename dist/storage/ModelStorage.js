import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Model } from '../models/Model.js';
export class ModelStorage {
    constructor(config) {
        this.config = config;
    }
    async saveModel(model) {
        const filePath = this.getModelPath(model.name);
        if (this.config.createDirectories) {
            await this.ensureDirectoryExists(dirname(filePath));
        }
        const modelData = model.toJSON();
        const jsonString = JSON.stringify(modelData, null, 2);
        try {
            await fs.writeFile(filePath, jsonString, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to save model '${model.name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async loadModel(name) {
        const filePath = this.getModelPath(name);
        try {
            const jsonString = await fs.readFile(filePath, 'utf-8');
            const modelData = JSON.parse(jsonString);
            return Model.fromJSON(modelData);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Model '${name}' not found`);
            }
            throw new Error(`Failed to load model '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async deleteModel(name) {
        const filePath = this.getModelPath(name);
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Model '${name}' not found`);
            }
            throw new Error(`Failed to delete model '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async listModels() {
        try {
            const files = await fs.readdir(this.config.baseDirectory);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async modelExists(name) {
        const filePath = this.getModelPath(name);
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async exportModel(name, outputPath) {
        const model = await this.loadModel(name);
        const modelData = model.toJSON();
        const exportData = {
            exportedAt: new Date().toISOString(),
            modelitVersion: '0.1.0',
            model: modelData,
        };
        const jsonString = JSON.stringify(exportData, null, 2);
        try {
            await fs.writeFile(outputPath, jsonString, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to export model '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async importModel(filePath) {
        try {
            const jsonString = await fs.readFile(filePath, 'utf-8');
            const importData = JSON.parse(jsonString);
            // Handle both direct model data and wrapped export format
            const modelData = importData.model || importData;
            const model = Model.fromJSON(modelData);
            // Save the imported model
            await this.saveModel(model);
            return model;
        }
        catch (error) {
            throw new Error(`Failed to import model from '${filePath}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async getModelInfo(name) {
        const filePath = this.getModelPath(name);
        try {
            const stats = await fs.stat(filePath);
            const model = await this.loadModel(name);
            return {
                name,
                size: stats.size,
                lastModified: stats.mtime,
                variableCount: model.listVariables().length,
            };
        }
        catch (error) {
            throw new Error(`Failed to get model info for '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getModelPath(name) {
        // Sanitize model name for filesystem
        const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
        return join(this.config.baseDirectory, `${sanitizedName}.json`);
    }
    async ensureDirectoryExists(path) {
        try {
            await fs.mkdir(path, { recursive: true });
        }
        catch (error) {
            throw new Error(`Failed to create directory '${path}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
export class ScenarioStorage {
    constructor(storage) {
        this.storage = storage;
    }
    async saveScenario(modelName, scenarioName, parameters, results) {
        const scenarioData = {
            modelName,
            scenarioName,
            parameters,
            results,
            createdAt: new Date().toISOString(),
        };
        const filePath = this.getScenarioPath(modelName, scenarioName);
        const jsonString = JSON.stringify(scenarioData, null, 2);
        try {
            await fs.writeFile(filePath, jsonString, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to save scenario '${scenarioName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async loadScenario(modelName, scenarioName) {
        const filePath = this.getScenarioPath(modelName, scenarioName);
        try {
            const jsonString = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(jsonString);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Scenario '${scenarioName}' not found for model '${modelName}'`);
            }
            throw new Error(`Failed to load scenario '${scenarioName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async listScenarios(modelName) {
        const scenarioDir = join(this.storage['config'].baseDirectory, 'scenarios', modelName);
        try {
            const files = await fs.readdir(scenarioDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', ''));
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw new Error(`Failed to list scenarios for model '${modelName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getScenarioPath(modelName, scenarioName) {
        const sanitizedModel = modelName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const sanitizedScenario = scenarioName.replace(/[^a-zA-Z0-9_-]/g, '_');
        return join(this.storage['config'].baseDirectory, 'scenarios', sanitizedModel, `${sanitizedScenario}.json`);
    }
}
