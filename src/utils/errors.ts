export class ModelitError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any) {
    super(message);
    this.name = 'ModelitError';
    this.code = code;
    this.details = details;
    
    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModelitError);
    }
  }
}

export class ValidationError extends ModelitError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class EvaluationError extends ModelitError {
  constructor(message: string, details?: any) {
    super(message, 'EVALUATION_ERROR', details);
    this.name = 'EvaluationError';
  }
}

export class CircularDependencyError extends ModelitError {
  public readonly cycle: string[];

  constructor(cycle: string[], details?: any) {
    const cycleStr = cycle.join(' -> ');
    super(`Circular dependency detected: ${cycleStr}`, 'CIRCULAR_DEPENDENCY', details);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

export class VariableNotFoundError extends ModelitError {
  public readonly variableName: string;

  constructor(variableName: string, details?: any) {
    super(`Variable '${variableName}' not found`, 'VARIABLE_NOT_FOUND', details);
    this.name = 'VariableNotFoundError';
    this.variableName = variableName;
  }
}

export class FormulaError extends ModelitError {
  public readonly formula: string;
  public readonly variableName?: string;

  constructor(formula: string, message: string, variableName?: string, details?: any) {
    const varContext = variableName ? ` in variable '${variableName}'` : '';
    super(`Formula error${varContext}: ${message}`, 'FORMULA_ERROR', details);
    this.name = 'FormulaError';
    this.formula = formula;
    this.variableName = variableName;
  }
}

export class StorageError extends ModelitError {
  public readonly operation: string;
  public readonly resourceName?: string;

  constructor(operation: string, message: string, resourceName?: string, details?: any) {
    const resource = resourceName ? ` '${resourceName}'` : '';
    super(`Storage ${operation} failed${resource}: ${message}`, 'STORAGE_ERROR', details);
    this.name = 'StorageError';
    this.operation = operation;
    this.resourceName = resourceName;
  }
}

export class TimeSeriesError extends ModelitError {
  public readonly timeStep: number;
  public readonly variableName?: string;

  constructor(timeStep: number, message: string, variableName?: string, details?: any) {
    const varContext = variableName ? ` for variable '${variableName}'` : '';
    super(`Time series error at step ${timeStep}${varContext}: ${message}`, 'TIME_SERIES_ERROR', details);
    this.name = 'TimeSeriesError';
    this.timeStep = timeStep;
    this.variableName = variableName;
  }
}

export class MCPError extends ModelitError {
  public readonly toolName?: string;

  constructor(message: string, toolName?: string, details?: any) {
    const toolContext = toolName ? ` in tool '${toolName}'` : '';
    super(`MCP error${toolContext}: ${message}`, 'MCP_ERROR', details);
    this.name = 'MCPError';
    this.toolName = toolName;
  }
}

export function isModelitError(error: unknown): error is ModelitError {
  return error instanceof ModelitError;
}

export function getErrorDetails(error: unknown): {
  message: string;
  code: string;
  stack?: string;
  details?: any;
} {
  if (isModelitError(error)) {
    return {
      message: error.message,
      code: error.code,
      stack: error.stack,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR',
  };
}

export function formatError(error: unknown): string {
  const details = getErrorDetails(error);
  return `[${details.code}] ${details.message}`;
}

export function createErrorResponse(error: unknown, context?: string): {
  success: false;
  error: string;
  code: string;
  details?: any;
} {
  const errorDetails = getErrorDetails(error);
  const contextStr = context ? `${context}: ` : '';
  
  return {
    success: false,
    error: `${contextStr}${errorDetails.message}`,
    code: errorDetails.code,
    details: errorDetails.details,
  };
}

// Error handling utilities for async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<{ success: true; data: T } | { success: false; error: string; code: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorDetails = getErrorDetails(error);
    return {
      success: false,
      error: `${context}: ${errorDetails.message}`,
      code: errorDetails.code,
    };
  }
}

export function wrapError<T extends any[], R>(
  fn: (...args: T) => R,
  context: string
): (...args: T) => R {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      if (isModelitError(error)) {
        throw error;
      }
      throw new ModelitError(`${context}: ${error instanceof Error ? error.message : String(error)}`, 'WRAPPED_ERROR');
    }
  };
}

export function wrapAsyncError<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isModelitError(error)) {
        throw error;
      }
      throw new ModelitError(`${context}: ${error instanceof Error ? error.message : String(error)}`, 'WRAPPED_ERROR');
    }
  };
}