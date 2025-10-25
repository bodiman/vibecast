import { create, all, MathJsStatic } from 'mathjs';

export interface ParsedExpression {
  formula: string;
  dependencies: string[];
  isTimeDependent: boolean;
  timeReferences: TimeReference[];
}

export interface TimeReference {
  variable: string;
  offset: number; // 0 for [t], -1 for [t-1], etc.
  originalText: string;
}

export class ExpressionParser {
  private math: MathJsStatic;

  constructor() {
    this.math = create(all, {
      number: 'BigNumber',
      precision: 64
    });
    
    // Configure for safe evaluation - disable dangerous functions
    this.math.import({
      import: function () { throw new Error('Function import is disabled') },
      createUnit: function () { throw new Error('Function createUnit is disabled') },
      // Don't disable evaluate - we need it!
      // evaluate: function () { throw new Error('Function evaluate is disabled') },
      // Don't disable parse - we need it for validation!
      // parse: function () { throw new Error('Function parse is disabled') },
      simplify: function () { throw new Error('Function simplify is disabled') },
      derivative: function () { throw new Error('Function derivative is disabled') }
    }, { override: true });
  }

  parseExpression(formula: string): ParsedExpression {
    const cleanFormula = formula.trim();
    
    // Extract time references like Variable[t], Variable[t-1], etc.
    const timeReferences = this.extractTimeReferences(cleanFormula);
    const isTimeDependent = timeReferences.length > 0;
    
    // Extract all variable dependencies
    const dependencies = this.extractDependencies(cleanFormula);
    
    return {
      formula: cleanFormula,
      dependencies,
      isTimeDependent,
      timeReferences,
    };
  }

  evaluateExpression(formula: string, context: Record<string, number>): number {
    try {
      // Replace variable names with their values
      let processedFormula = formula;
      
      // Sort variables by length (longest first) to avoid partial replacements
      const sortedVars = Object.keys(context).sort((a, b) => b.length - a.length);
      
      for (const varName of sortedVars) {
        const value = context[varName];
        if (value === undefined || value === null || isNaN(value)) {
          throw new Error(`Variable '${varName}' has invalid value: ${value}`);
        }
        
        // Replace variable references - handle both simple vars and time references
        if (varName.includes('[')) {
          // For time references like CASH_BALANCE[t-1], do exact replacement
          const regex = new RegExp(this.escapeRegExp(varName), 'g');
          processedFormula = processedFormula.replace(regex, value.toString());
        } else {
          // For simple variables, use word boundaries but exclude those followed by [  
          const regex = new RegExp(`\\b${this.escapeRegExp(varName)}\\b(?!\\[)`, 'g');
          processedFormula = processedFormula.replace(regex, value.toString());
        }
      }
      
      // Evaluate the mathematical expression
      const result = this.math.evaluate(processedFormula);
      
      // Convert BigNumber back to regular number
      return typeof result === 'object' && 'toNumber' in result 
        ? result.toNumber() 
        : Number(result);
        
    } catch (error) {
      throw new Error(`Failed to evaluate expression '${formula}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validateExpression(formula: string): { isValid: boolean; error?: string } {
    try {
      // Try to parse the expression syntax
      this.math.parse(formula);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private extractTimeReferences(formula: string): TimeReference[] {
    const timeReferences: TimeReference[] = [];
    
    // Match patterns like Variable[t], Variable[t-1], Variable[t+2], etc.
    const timeRegex = /(\w+)\[\s*t\s*([+-]\s*\d+)?\s*\]/gi;
    let match;
    
    while ((match = timeRegex.exec(formula)) !== null) {
      const variable = match[1];
      const offsetStr = match[2];
      const originalText = match[0];
      
      let offset = 0;
      if (offsetStr) {
        const cleanOffset = offsetStr.replace(/\s/g, '');
        offset = parseInt(cleanOffset, 10) || 0;
      }
      
      timeReferences.push({
        variable,
        offset,
        originalText,
      });
    }
    
    return timeReferences;
  }

  private extractDependencies(formula: string): string[] {
    const dependencies = new Set<string>();
    
    // First add time-dependent variables with their full time reference
    const timeReferences = this.extractTimeReferences(formula);
    timeReferences.forEach(ref => dependencies.add(ref.originalText));
    
    // Extract regular variable references (not in time brackets)
    // Remove time references first to avoid double counting
    let formulaWithoutTimeRefs = formula;
    timeReferences.forEach(ref => {
      formulaWithoutTimeRefs = formulaWithoutTimeRefs.replace(new RegExp(this.escapeRegExp(ref.originalText), 'g'), '');
    });
    
    // This matches word characters that are not followed by [t...]
    const varRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*\[)/g;
    let match;
    
    while ((match = varRegex.exec(formulaWithoutTimeRefs)) !== null) {
      const varName = match[1];
      
      // Skip mathematical functions and constants
      if (!this.isMathFunction(varName)) {
        dependencies.add(varName);
      }
    }
    
    return Array.from(dependencies).sort();
  }

  private isMathFunction(name: string): boolean {
    const mathFunctions = new Set([
      'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
      'ceil', 'cos', 'cosh', 'exp', 'floor', 'log', 'log10', 'max', 'min',
      'pow', 'random', 'round', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
      'pi', 'e', 'PI', 'E', 'true', 'false', 'null', 'undefined'
    ]);
    
    return mathFunctions.has(name.toLowerCase());
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}