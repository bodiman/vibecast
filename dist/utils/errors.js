export class ModelitError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR', details) {
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
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
export class EvaluationError extends ModelitError {
    constructor(message, details) {
        super(message, 'EVALUATION_ERROR', details);
        this.name = 'EvaluationError';
    }
}
export class CircularDependencyError extends ModelitError {
    constructor(cycle, details) {
        const cycleStr = cycle.join(' -> ');
        super(`Circular dependency detected: ${cycleStr}`, 'CIRCULAR_DEPENDENCY', details);
        this.name = 'CircularDependencyError';
        this.cycle = cycle;
    }
}
export class VariableNotFoundError extends ModelitError {
    constructor(variableName, details) {
        super(`Variable '${variableName}' not found`, 'VARIABLE_NOT_FOUND', details);
        this.name = 'VariableNotFoundError';
        this.variableName = variableName;
    }
}
export class FormulaError extends ModelitError {
    constructor(formula, message, variableName, details) {
        const varContext = variableName ? ` in variable '${variableName}'` : '';
        super(`Formula error${varContext}: ${message}`, 'FORMULA_ERROR', details);
        this.name = 'FormulaError';
        this.formula = formula;
        this.variableName = variableName;
    }
}
export class StorageError extends ModelitError {
    constructor(operation, message, resourceName, details) {
        const resource = resourceName ? ` '${resourceName}'` : '';
        super(`Storage ${operation} failed${resource}: ${message}`, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
        this.operation = operation;
        this.resourceName = resourceName;
    }
}
export class TimeSeriesError extends ModelitError {
    constructor(timeStep, message, variableName, details) {
        const varContext = variableName ? ` for variable '${variableName}'` : '';
        super(`Time series error at step ${timeStep}${varContext}: ${message}`, 'TIME_SERIES_ERROR', details);
        this.name = 'TimeSeriesError';
        this.timeStep = timeStep;
        this.variableName = variableName;
    }
}
export class MCPError extends ModelitError {
    constructor(message, toolName, details) {
        const toolContext = toolName ? ` in tool '${toolName}'` : '';
        super(`MCP error${toolContext}: ${message}`, 'MCP_ERROR', details);
        this.name = 'MCPError';
        this.toolName = toolName;
    }
}
export function isModelitError(error) {
    return error instanceof ModelitError;
}
export function getErrorDetails(error) {
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
export function formatError(error) {
    const details = getErrorDetails(error);
    return `[${details.code}] ${details.message}`;
}
export function createErrorResponse(error, context) {
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
export async function withErrorHandling(operation, context) {
    try {
        const data = await operation();
        return { success: true, data };
    }
    catch (error) {
        const errorDetails = getErrorDetails(error);
        return {
            success: false,
            error: `${context}: ${errorDetails.message}`,
            code: errorDetails.code,
        };
    }
}
export function wrapError(fn, context) {
    return (...args) => {
        try {
            return fn(...args);
        }
        catch (error) {
            if (isModelitError(error)) {
                throw error;
            }
            throw new ModelitError(`${context}: ${error instanceof Error ? error.message : String(error)}`, 'WRAPPED_ERROR');
        }
    };
}
export function wrapAsyncError(fn, context) {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            if (isModelitError(error)) {
                throw error;
            }
            throw new ModelitError(`${context}: ${error instanceof Error ? error.message : String(error)}`, 'WRAPPED_ERROR');
        }
    };
}
