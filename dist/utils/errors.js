"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPError = exports.TimeSeriesError = exports.StorageError = exports.FormulaError = exports.VariableNotFoundError = exports.CircularDependencyError = exports.EvaluationError = exports.ValidationError = exports.ModelitError = void 0;
exports.isModelitError = isModelitError;
exports.getErrorDetails = getErrorDetails;
exports.formatError = formatError;
exports.createErrorResponse = createErrorResponse;
exports.withErrorHandling = withErrorHandling;
exports.wrapError = wrapError;
exports.wrapAsyncError = wrapAsyncError;
class ModelitError extends Error {
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
exports.ModelitError = ModelitError;
class ValidationError extends ModelitError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class EvaluationError extends ModelitError {
    constructor(message, details) {
        super(message, 'EVALUATION_ERROR', details);
        this.name = 'EvaluationError';
    }
}
exports.EvaluationError = EvaluationError;
class CircularDependencyError extends ModelitError {
    constructor(cycle, details) {
        const cycleStr = cycle.join(' -> ');
        super(`Circular dependency detected: ${cycleStr}`, 'CIRCULAR_DEPENDENCY', details);
        this.name = 'CircularDependencyError';
        this.cycle = cycle;
    }
}
exports.CircularDependencyError = CircularDependencyError;
class VariableNotFoundError extends ModelitError {
    constructor(variableName, details) {
        super(`Variable '${variableName}' not found`, 'VARIABLE_NOT_FOUND', details);
        this.name = 'VariableNotFoundError';
        this.variableName = variableName;
    }
}
exports.VariableNotFoundError = VariableNotFoundError;
class FormulaError extends ModelitError {
    constructor(formula, message, variableName, details) {
        const varContext = variableName ? ` in variable '${variableName}'` : '';
        super(`Formula error${varContext}: ${message}`, 'FORMULA_ERROR', details);
        this.name = 'FormulaError';
        this.formula = formula;
        this.variableName = variableName;
    }
}
exports.FormulaError = FormulaError;
class StorageError extends ModelitError {
    constructor(operation, message, resourceName, details) {
        const resource = resourceName ? ` '${resourceName}'` : '';
        super(`Storage ${operation} failed${resource}: ${message}`, 'STORAGE_ERROR', details);
        this.name = 'StorageError';
        this.operation = operation;
        this.resourceName = resourceName;
    }
}
exports.StorageError = StorageError;
class TimeSeriesError extends ModelitError {
    constructor(timeStep, message, variableName, details) {
        const varContext = variableName ? ` for variable '${variableName}'` : '';
        super(`Time series error at step ${timeStep}${varContext}: ${message}`, 'TIME_SERIES_ERROR', details);
        this.name = 'TimeSeriesError';
        this.timeStep = timeStep;
        this.variableName = variableName;
    }
}
exports.TimeSeriesError = TimeSeriesError;
class MCPError extends ModelitError {
    constructor(message, toolName, details) {
        const toolContext = toolName ? ` in tool '${toolName}'` : '';
        super(`MCP error${toolContext}: ${message}`, 'MCP_ERROR', details);
        this.name = 'MCPError';
        this.toolName = toolName;
    }
}
exports.MCPError = MCPError;
function isModelitError(error) {
    return error instanceof ModelitError;
}
function getErrorDetails(error) {
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
function formatError(error) {
    const details = getErrorDetails(error);
    return `[${details.code}] ${details.message}`;
}
function createErrorResponse(error, context) {
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
async function withErrorHandling(operation, context) {
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
function wrapError(fn, context) {
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
function wrapAsyncError(fn, context) {
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
