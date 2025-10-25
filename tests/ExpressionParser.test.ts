import { ExpressionParser } from '../src/engine/ExpressionParser.js';

describe('ExpressionParser', () => {
  let parser: ExpressionParser;

  beforeEach(() => {
    parser = new ExpressionParser();
  });

  describe('parseExpression', () => {
    it('should parse simple expressions', () => {
      const result = parser.parseExpression('REVENUE - COGS - SGA');
      
      expect(result.formula).toBe('REVENUE - COGS - SGA');
      expect(result.dependencies).toEqual(['COGS', 'REVENUE', 'SGA']);
      expect(result.isTimeDependent).toBe(false);
      expect(result.timeReferences).toHaveLength(0);
    });

    it('should parse time-dependent expressions', () => {
      const result = parser.parseExpression('CASH[t-1] + FCF[t] - CAPEX[t]');
      
      expect(result.isTimeDependent).toBe(true);
      expect(result.timeReferences).toHaveLength(3);
      expect(result.timeReferences[0]).toEqual({
        variable: 'CASH',
        offset: -1,
        originalText: 'CASH[t-1]',
      });
      expect(result.timeReferences[1]).toEqual({
        variable: 'FCF',
        offset: 0,
        originalText: 'FCF[t]',
      });
    });

    it('should handle complex mathematical expressions', () => {
      const result = parser.parseExpression('sqrt(REVENUE^2 + COGS^2) * 0.1');
      
      expect(result.dependencies).toEqual(['COGS', 'REVENUE']);
      expect(result.isTimeDependent).toBe(false);
    });

    it('should ignore mathematical functions', () => {
      const result = parser.parseExpression('max(REVENUE, 100) + min(COGS, 50) + pi');
      
      expect(result.dependencies).toEqual(['COGS', 'REVENUE']);
      expect(result.dependencies).not.toContain('max');
      expect(result.dependencies).not.toContain('min');
      expect(result.dependencies).not.toContain('pi');
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate simple mathematical expressions', () => {
      const result = parser.evaluateExpression('A + B * C', {
        A: 10,
        B: 5,
        C: 2,
      });
      
      expect(result).toBe(20); // 10 + 5 * 2 = 20
    });

    it('should handle complex expressions', () => {
      const result = parser.evaluateExpression('sqrt(A^2 + B^2)', {
        A: 3,
        B: 4,
      });
      
      expect(result).toBe(5); // sqrt(9 + 16) = 5
    });

    it('should handle time references in context', () => {
      const result = parser.evaluateExpression('CASH_t_minus_1 + FCF_t', {
        'CASH_t_minus_1': 100,
        'FCF_t': 25,
      });
      
      expect(result).toBe(125);
    });

    it('should throw on invalid expressions', () => {
      expect(() => {
        parser.evaluateExpression('A +', { A: 10 });
      }).toThrow();
    });

    it('should throw on missing variables', () => {
      expect(() => {
        parser.evaluateExpression('A + B', { A: 10 });
      }).toThrow();
    });
  });

  describe('validateExpression', () => {
    it('should validate correct expressions', () => {
      const result = parser.validateExpression('A + B * sqrt(C)');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect syntax errors', () => {
      const result = parser.validateExpression('A + B)'); // Unmatched parenthesis
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should detect unmatched parentheses', () => {
      const result = parser.validateExpression('A + (B * C');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('time reference extraction', () => {
    it('should extract various time reference formats', () => {
      const testCases = [
        { input: 'VAR[t]', expected: { variable: 'VAR', offset: 0 } },
        { input: 'VAR[t-1]', expected: { variable: 'VAR', offset: -1 } },
        { input: 'VAR[t+2]', expected: { variable: 'VAR', offset: 2 } },
        { input: 'VAR[t - 3]', expected: { variable: 'VAR', offset: -3 } },
      ];

      for (const testCase of testCases) {
        const result = parser.parseExpression(testCase.input);
        expect(result.timeReferences).toHaveLength(1);
        expect(result.timeReferences[0].variable).toBe(testCase.expected.variable);
        expect(result.timeReferences[0].offset).toBe(testCase.expected.offset);
      }
    });
  });
});