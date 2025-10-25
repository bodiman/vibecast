import { z } from 'zod';

export const VariableTypeSchema = z.enum(['scalar', 'series', 'parameter']);
export type VariableType = z.infer<typeof VariableTypeSchema>;

export const VariableMetadataSchema = z.object({
  units: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).optional();

export type VariableMetadata = z.infer<typeof VariableMetadataSchema>;

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

export type VariableData = z.infer<typeof VariableSchema>;
export type VariableInput = z.infer<typeof VariableInputSchema>;

export class Variable {
  public readonly name: string;
  public formula?: string;
  public dependencies: string[];
  public type: VariableType;
  public values?: number[];
  public metadata?: VariableMetadata;

  constructor(data: VariableInput) {
    const validated = VariableInputSchema.parse(data);
    
    this.name = validated.name;
    this.formula = validated.formula;
    this.type = validated.type || 'scalar';
    this.values = validated.values;
    this.metadata = validated.metadata;
    this.dependencies = validated.dependencies || [];
  }

  hasFormula(): boolean {
    return this.formula !== undefined && this.formula.trim() !== '';
  }

  hasValues(): boolean {
    return this.values !== undefined && this.values.length > 0;
  }

  isTimeDependent(): boolean {
    if (!this.formula) return false;
    return /\[\s*t\s*[-+]\s*\d+\s*\]|\[\s*t\s*\]/i.test(this.formula);
  }

  isParameter(): boolean {
    return this.type === 'parameter';
  }

  isComputed(): boolean {
    return this.hasFormula() && !this.isParameter();
  }

  getValue(timeStep?: number): number | undefined {
    if (!this.values) return undefined;
    if (timeStep === undefined) return this.values[0];
    return this.values[timeStep];
  }

  setValue(value: number, timeStep?: number): void {
    if (!this.values) this.values = [];
    if (timeStep === undefined || timeStep === 0) {
      this.values[0] = value;
    } else {
      while (this.values.length <= timeStep) {
        this.values.push(0);
      }
      this.values[timeStep] = value;
    }
  }

  clone(): Variable {
    return new Variable({
      name: this.name,
      formula: this.formula,
      dependencies: [...this.dependencies],
      type: this.type,
      values: this.values ? [...this.values] : undefined,
      metadata: this.metadata ? { ...this.metadata } : undefined,
    });
  }

  toJSON(): VariableData {
    return {
      name: this.name,
      formula: this.formula,
      dependencies: this.dependencies,
      type: this.type,
      values: this.values,
      metadata: this.metadata,
    };
  }

  static fromJSON(data: unknown): Variable {
    return new Variable(VariableSchema.parse(data));
  }
}