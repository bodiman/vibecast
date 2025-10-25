import { z } from 'zod';
export const VariableTypeSchema = z.enum(['scalar', 'series', 'parameter']);
export const VariableMetadataSchema = z.object({
    units: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
}).optional();
export const VariableSchema = z.object({
    name: z.string().min(1),
    formula: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
    type: VariableTypeSchema.default('scalar'),
    values: z.array(z.number()).optional(),
    metadata: VariableMetadataSchema,
});
export const VariableInputSchema = z.object({
    name: z.string().min(1),
    formula: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    type: VariableTypeSchema.optional(),
    values: z.array(z.number()).optional(),
    metadata: VariableMetadataSchema,
});
export class Variable {
    constructor(data) {
        const validated = VariableInputSchema.parse(data);
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
        return new Variable(VariableSchema.parse(data));
    }
}
