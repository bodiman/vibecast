import { Variable } from '../src/models/Variable.js';

describe('Variable', () => {
  describe('constructor', () => {
    it('should create a simple variable', () => {
      const variable = new Variable({
        name: 'REVENUE',
        values: [100, 110, 121],
      });

      expect(variable.name).toBe('REVENUE');
      expect(variable.values).toEqual([100, 110, 121]);
      expect(variable.type).toBe('scalar');
      expect(variable.dependencies).toEqual([]);
    });

    it('should create a variable with formula', () => {
      const variable = new Variable({
        name: 'EBITDA',
        formula: 'REVENUE - COGS - SGA',
        dependencies: ['REVENUE', 'COGS', 'SGA'],
      });

      expect(variable.name).toBe('EBITDA');
      expect(variable.formula).toBe('REVENUE - COGS - SGA');
      expect(variable.dependencies).toEqual(['REVENUE', 'COGS', 'SGA']);
    });

    it('should validate required fields', () => {
      expect(() => {
        new Variable({ name: '' });
      }).toThrow();
    });
  });

  describe('helper methods', () => {
    it('should detect time-dependent variables', () => {
      const timeDep = new Variable({
        name: 'CASH',
        formula: 'CASH[t-1] + FREE_CASH_FLOW[t]',
      });

      const regular = new Variable({
        name: 'EBITDA',
        formula: 'REVENUE - COGS',
      });

      expect(timeDep.isTimeDependent()).toBe(true);
      expect(regular.isTimeDependent()).toBe(false);
    });

    it('should identify computed variables', () => {
      const computed = new Variable({
        name: 'EBITDA',
        formula: 'REVENUE - COGS',
      });

      const parameter = new Variable({
        name: 'REVENUE',
        type: 'parameter',
        values: [100],
      });

      expect(computed.isComputed()).toBe(true);
      expect(parameter.isComputed()).toBe(false);
    });

    it('should handle value operations', () => {
      const variable = new Variable({
        name: 'TEST',
        values: [10, 20, 30],
      });

      expect(variable.getValue(0)).toBe(10);
      expect(variable.getValue(1)).toBe(20);
      expect(variable.getValue()).toBe(10); // default to first value

      variable.setValue(40, 3);
      expect(variable.getValue(3)).toBe(40);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original = new Variable({
        name: 'CASH',
        formula: 'CASH[t-1] + FCF[t]',
        dependencies: ['CASH[t-1]', 'FCF[t]'],
        type: 'series',
        values: [50, 60, 70],
        metadata: {
          description: 'Cash balance',
          units: 'USD',
        },
      });

      const json = original.toJSON();
      const restored = Variable.fromJSON(json);

      expect(restored.name).toBe(original.name);
      expect(restored.formula).toBe(original.formula);
      expect(restored.dependencies).toEqual(original.dependencies);
      expect(restored.type).toBe(original.type);
      expect(restored.values).toEqual(original.values);
      expect(restored.metadata).toEqual(original.metadata);
    });
  });
});