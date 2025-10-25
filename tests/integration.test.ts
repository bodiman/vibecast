import { promises as fs } from 'fs';
import { join } from 'path';
import { Model } from '../src/models/Model.js';
import { Variable } from '../src/models/Variable.js';
import { EvaluationEngine } from '../src/engine/EvaluationEngine.js';
import { ModelStorage } from '../src/storage/ModelStorage.js';

describe('Integration Tests', () => {
  let engine: EvaluationEngine;
  let storage: ModelStorage;
  let tempDir: string;

  beforeEach(async () => {
    engine = new EvaluationEngine();
    tempDir = await fs.mkdtemp('/tmp/modelit-test-');
    storage = new ModelStorage({
      baseDirectory: tempDir,
      createDirectories: true,
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true });
  });

  describe('Cashflow Model Example', () => {
    let model: Model;

    beforeEach(async () => {
      // Load the example cashflow model
      const examplePath = join(process.cwd(), 'examples', 'cashflow-model.json');
      const modelData = JSON.parse(await fs.readFile(examplePath, 'utf-8'));
      model = Model.fromJSON(modelData);
    });

    it('should load and validate the example model', () => {
      expect(model.name).toBe('Cashflow Forecast');
      expect(model.listVariables()).toHaveLength(9);
      
      const validation = model.validateModel();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should evaluate the cashflow model correctly', async () => {
      const result = await engine.evaluateModel(model, 3);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify key calculations
      expect(result.values.REVENUE).toEqual([100, 110, 121]);
      expect(result.values.COGS).toEqual([30, 33, 36.3]); // 30% of revenue
      expect(result.values.EBITDA).toEqual([45, 52, 59.7]); // REVENUE - COGS - SGA
      
      // Check time-dependent cash balance
      // Initial: 50, then 50 + 35 = 85, 85 + 39 = 124, 124 + 56.7 = 180.7
      expect(result.values.CASH_BALANCE[0]).toBeCloseTo(85, 1);
      expect(result.values.CASH_BALANCE[1]).toBeCloseTo(124, 1);
      expect(result.values.CASH_BALANCE[2]).toBeCloseTo(180.7, 1);
    });

    it('should persist and load models correctly', async () => {
      await storage.saveModel(model);
      
      const loadedModel = await storage.loadModel('Cashflow Forecast');
      expect(loadedModel.name).toBe(model.name);
      expect(loadedModel.listVariables()).toHaveLength(model.listVariables().length);
      
      // Evaluate loaded model
      const result = await engine.evaluateModel(loadedModel, 3);
      expect(result.success).toBe(true);
    });

    it('should handle model export and import', async () => {
      const exportPath = join(tempDir, 'exported-model.json');
      await storage.saveModel(model);
      await storage.exportModel(model.name, exportPath);
      
      // Verify export file exists and has correct structure
      const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
      expect(exportData.model.name).toBe(model.name);
      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.modelitVersion).toBeDefined();
      
      // Import the model
      const importedModel = await storage.importModel(exportPath);
      expect(importedModel.name).toBe(model.name);
    });
  });

  describe('Model Storage Operations', () => {
    it('should handle model CRUD operations', async () => {
      const model = new Model({
        name: 'Test Model',
        description: 'A test model',
      });

      // Create
      await storage.saveModel(model);
      expect(await storage.modelExists('Test Model')).toBe(true);
      
      // Read
      const loaded = await storage.loadModel('Test Model');
      expect(loaded.name).toBe('Test Model');
      
      // List
      const models = await storage.listModels();
      expect(models).toContain('Test_Model'); // Model names are sanitized for filesystem
      
      // Delete
      await storage.deleteModel('Test Model');
      expect(await storage.modelExists('Test Model')).toBe(false);
    });

    it('should handle model info retrieval', async () => {
      const model = new Model({ name: 'Info Test' });
      await storage.saveModel(model);
      
      const info = await storage.getModelInfo('Info Test');
      expect(info.name).toBe('Info Test');
      expect(info.size).toBeGreaterThan(0);
      expect(info.lastModified).toBeInstanceOf(Date);
      expect(info.variableCount).toBe(0);
    });

    it('should handle storage errors gracefully', async () => {
      // Try to load non-existent model
      await expect(storage.loadModel('NonExistent')).rejects.toThrow('not found');
      
      // Try to delete non-existent model
      await expect(storage.deleteModel('NonExistent')).rejects.toThrow('not found');
    });
  });

  describe('Complex Model Scenarios', () => {
    it('should handle deeply nested dependencies', async () => {
      const model = new Model({ name: 'Deep Dependencies' });
      
      // Create a chain of dependencies: A -> B -> C -> D
      model.addVariable(new Variable({ name: 'A', type: 'parameter', values: [10] }));
      model.addVariable(new Variable({ name: 'B', formula: 'A * 2', dependencies: ['A'] }));
      model.addVariable(new Variable({ name: 'C', formula: 'B + 5', dependencies: ['B'] }));
      model.addVariable(new Variable({ name: 'D', formula: 'C / 2', dependencies: ['C'] }));
      
      const result = await engine.evaluateModel(model, 1);
      
      expect(result.success).toBe(true);
      expect(result.values.A).toEqual([10]);
      expect(result.values.B).toEqual([20]);
      expect(result.values.C).toEqual([25]);
      expect(result.values.D).toEqual([12.5]);
    });

    it('should handle multiple time-dependent variables', async () => {
      const model = new Model({ name: 'Multiple Time Deps' });
      
      model.addVariable(new Variable({ 
        name: 'INCOME', 
        type: 'parameter', 
        values: [100, 110, 120] 
      }));
      
      model.addVariable(new Variable({
        name: 'SAVINGS',
        formula: 'SAVINGS[t-1] + INCOME[t] * 0.1',
        dependencies: ['SAVINGS[t-1]', 'INCOME[t]'],
        type: 'series',
        values: [0],
      }));
      
      model.addVariable(new Variable({
        name: 'INVESTMENTS',
        formula: 'INVESTMENTS[t-1] + SAVINGS[t] * 0.5',
        dependencies: ['INVESTMENTS[t-1]', 'SAVINGS[t]'],
        type: 'series',
        values: [0],
      }));
      
      const result = await engine.evaluateModel(model, 3);
      
      expect(result.success).toBe(true);
      expect(result.values.SAVINGS).toEqual([10, 21, 33]); // 0+10, 10+11, 21+12
      expect(result.values.INVESTMENTS).toEqual([5, 15.5, 32]); // 0+5, 5+10.5, 15.5+16.5
    });
  });
});