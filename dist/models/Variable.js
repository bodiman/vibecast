"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Variable = exports.VariableInputSchema = exports.VariableSchema = exports.VariableMetadataSchema = exports.VariableTypeSchema = void 0;
const zod_1 = require("zod");
exports.VariableTypeSchema = zod_1.z.enum(['scalar', 'series', 'parameter']);
exports.VariableMetadataSchema = zod_1.z.object({
    units: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
}).optional();
exports.VariableSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    formula: zod_1.z.string().optional(),
    dependencies: zod_1.z.array(zod_1.z.string()).default([]),
    type: exports.VariableTypeSchema.default('scalar'),
    values: zod_1.z.array(zod_1.z.number()).optional(),
    metadata: exports.VariableMetadataSchema,
});
exports.VariableInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    formula: zod_1.z.string().optional(),
    dependencies: zod_1.z.array(zod_1.z.string()).optional(),
    type: exports.VariableTypeSchema.optional(),
    values: zod_1.z.array(zod_1.z.number()).optional(),
    metadata: exports.VariableMetadataSchema,
});
class Variable {
    constructor(data) {
        const validated = exports.VariableInputSchema.parse(data);
        this.name = validated.name;
        this.formula = validated.formula;
        this.type = validated.type || 'scalar';
        this.values = validated.values;
        this.metadata = validated.metadata;
        this.dependencies = validated.dependencies || [];
    }
    hasFormula() {
        return this.formula !== undefined && this.formula.trim() !== '';
    }
    hasValues() {
        return this.values !== undefined && this.values.length > 0;
    }
    isTimeDependent() {
        if (!this.formula)
            return false;
        return /\[\s*t\s*[-+]\s*\d+\s*\]|\[\s*t\s*\]/i.test(this.formula);
    }
    isParameter() {
        return this.type === 'parameter';
    }
    isComputed() {
        return this.hasFormula() && !this.isParameter();
    }
    getValue(timeStep) {
        if (!this.values)
            return undefined;
        if (timeStep === undefined)
            return this.values[0];
        return this.values[timeStep];
    }
    setValue(value, timeStep) {
        if (!this.values)
            this.values = [];
        if (timeStep === undefined || timeStep === 0) {
            this.values[0] = value;
        }
        else {
            while (this.values.length <= timeStep) {
                this.values.push(0);
            }
            this.values[timeStep] = value;
        }
    }
    clone() {
        return new Variable({
            name: this.name,
            formula: this.formula,
            dependencies: [...this.dependencies],
            type: this.type,
            values: this.values ? [...this.values] : undefined,
            metadata: this.metadata ? { ...this.metadata } : undefined,
        });
    }
    toJSON() {
        return {
            name: this.name,
            formula: this.formula,
            dependencies: this.dependencies,
            type: this.type,
            values: this.values,
            metadata: this.metadata,
        };
    }
    static fromJSON(data) {
        return new Variable(exports.VariableSchema.parse(data));
    }
}
exports.Variable = Variable;
