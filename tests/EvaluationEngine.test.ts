import { EvaluationEngine } from '../src/engine/EvaluationEngine.js';
import { Model } from '../src/models/Model.js';
import { Variable } from '../src/models/Variable.js';

describe('EvaluationEngine', () => {
  let engine: EvaluationEngine;
  let model: Model;

  beforeEach(() => {
    engine = new EvaluationEngine();
    model = new Model({ name: 'Test Model' });
  });

  describe('simple model evaluation', () => {
    beforeEach(() => {
      // Create a simple model: EBITDA = REVENUE - COGS - SGA
      model.addVariable(new Variable({
        name: 'REVENUE',
        type: 'parameter',
        values: [100, 110, 121],
      }));

      model.addVariable(new Variable({
        name: 'COGS',
        formula: 'REVENUE * 0.3',
        dependencies: ['REVENUE'],
      }));

      model.addVariable(new Variable({
        name: 'SGA',
        type: 'parameter',
        values: [25, 25, 25],
      }));

      model.addVariable(new Variable({
        name: 'EBITDA',
        formula: 'REVENUE - COGS - SGA',
        dependencies: ['REVENUE', 'COGS', 'SGA'],
      }));
    });

    it('should evaluate model correctly', async () => {
      const result = await engine.evaluateModel(model, 3);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Check calculated values
      expect(result.values.REVENUE).toEqual([100, 110, 121]);
      expect(result.values.COGS).toEqual([30, 30, 30]); // 30% of revenue at each time step
      expect(result.values.SGA).toEqual([25, 25, 25]);
      expect(result.values.EBITDA).toEqual([45, 55, 66]); // REVENUE - COGS - SGA
    });

    it('should handle single time step', async () => {
      const result = await engine.evaluateModel(model, 1);

      expect(result.success).toBe(true);
      expect(result.values.REVENUE).toEqual([100]);
      expect(result.values.EBITDA).toEqual([45]);
    });
  });

  describe('time-dependent model evaluation', () => {
    beforeEach(() => {
      // Create a model with time-dependent cash balance
      model.addVariable(new Variable({
        name: 'FCF',
        type: 'parameter',
        values: [20, 25, 30],
      }));

      model.addVariable(new Variable({
        name: 'CASH',
        formula: 'CASH[t-1] + FCF[t]',
        dependencies: ['CASH[t-1]', 'FCF[t]'],
        type: 'series',
        values: [100], // Initial cash balance
      }));
    });

    it('should evaluate time-dependent variables correctly', async () => {
      const result = await engine.evaluateModel(model, 3);

      expect(result.success).toBe(true);
      
      // Initial: 100, t=0: 100+20=120, t=1: 120+25=145, t=2: 145+30=175
      expect(result.values.CASH).toEqual([120, 145, 175]);
      expect(result.values.FCF).toEqual([20, 25, 30]);
    });

    it('should handle negative time references gracefully', async () => {
      // Create a model where CASH[t-1] would reference t=-1 at t=0
      const result = await engine.evaluateModel(model, 1);

      expect(result.success).toBe(true);
      // At t=0, CASH[t-1] should default to 0, so CASH[0] = 0 + FCF[0] = 20
      expect(result.values.CASH).toEqual([20]);
    });
  });

  describe('error handling', () => {
    it('should detect circular dependencies', async () => {
      model.addVariable(new Variable({
        name: 'A',
        formula: 'B + 1',
        dependencies: ['B'],
      }));

      model.addVariable(new Variable({
        name: 'B',
        formula: 'A + 1',
        dependencies: ['A'],
      }));

      const result = await engine.evaluateModel(model, 1);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Circular');
    });

    it('should handle missing dependencies', async () => {
      model.addVariable(new Variable({
        name: 'A',
        formula: 'B + C',
        dependencies: ['B', 'C'],
      }));

      // Only add B, not C
      model.addVariable(new Variable({
        name: 'B',
        type: 'parameter',
        values: [10],
      }));

      const result = await engine.evaluateModel(model, 1);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle invalid formulas', async () => {
      model.addVariable(new Variable({
        name: 'A',
        type: 'parameter',
        values: [10],
      }));

      model.addVariable(new Variable({
        name: 'B',
        formula: 'A + +', // Invalid syntax
        dependencies: ['A'],
      }));

      const result = await engine.evaluateModel(model, 1);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('variable-specific evaluation', () => {
    beforeEach(() => {
      model.addVariable(new Variable({
        name: 'REVENUE',
        type: 'parameter',
        values: [100],
      }));

      model.addVariable(new Variable({
        name: 'COGS',
        formula: 'REVENUE * 0.3',
        dependencies: ['REVENUE'],
      }));

      model.addVariable(new Variable({
        name: 'GROSS_PROFIT',
        formula: 'REVENUE - COGS',
        dependencies: ['REVENUE', 'COGS'],
      }));
    });

    it('should evaluate specific variable with dependencies', async () => {
      const result = await engine.evaluateVariable(model, 'GROSS_PROFIT', 1);

      expect(result.errors).toHaveLength(0);
      expect(result.values).toEqual([70]); // 100 - 30 = 70
    });

    it('should handle missing variable', async () => {
      const result = await engine.evaluateVariable(model, 'NONEXISTENT', 1);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.values).toEqual([]);
    });
  });

  describe('scenario simulation', () => {
    beforeEach(() => {
      model.addVariable(new Variable({
        name: 'PRICE',
        type: 'parameter',
        values: [10],
      }));

      model.addVariable(new Variable({
        name: 'QUANTITY',
        type: 'parameter',
        values: [100],
      }));

      model.addVariable(new Variable({
        name: 'REVENUE',
        formula: 'PRICE * QUANTITY',
        dependencies: ['PRICE', 'QUANTITY'],
      }));
    });

    it('should simulate multiple scenarios', async () => {
      const scenarios = {
        'low_price': { PRICE: [8], QUANTITY: [100] },
        'high_price': { PRICE: [12], QUANTITY: [100] },
        'high_volume': { PRICE: [10], QUANTITY: [150] },
      };

      const results = await engine.simulateScenario(model, scenarios, 1);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results.low_price.success).toBe(true);
      expect(results.low_price.values.REVENUE).toEqual([800]); // 8 * 100
      expect(results.high_price.values.REVENUE).toEqual([1200]); // 12 * 100
      expect(results.high_volume.values.REVENUE).toEqual([1500]); // 10 * 150
    });
  });
});