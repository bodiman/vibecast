import { z } from 'zod';

export const VariableTypeSchema = z.enum(['scalar', 'series', 'parameter']);
export type VariableType = z.infer<typeof VariableTypeSchema>;

export const VariableMetadataSchema = z.object({
  units: z.string().optional(),
  description: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Marketplace metadata
  author: z.string().optional(),
  version: z.string().optional(),
  created: z.union([z.date(), z.string()]).optional(),
  updated: z.union([z.date(), z.string()]).optional(),
  // Time series metadata
  timeIndex: z.array(z.string()).optional(), // Time labels like ["2024-Q1", "2024-Q2", ...]
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  // Mathematical metadata
  domain: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  // Provenance
  derivedFrom: z.array(z.string()).optional(), // Variable names this was derived from
  marketplaceId: z.string().optional(), // ID in marketplace if published
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
    this.touch();
  }

  // Enhanced time-series methods
  getTimeIndex(): string[] {
    return this.metadata?.timeIndex || [];
  }

  setTimeIndex(timeIndex: string[]): void {
    if (!this.metadata) this.metadata = {};
    this.metadata.timeIndex = timeIndex;
    this.touch();
  }

  getValueByTimeLabel(timeLabel: string): number | undefined {
    const timeIndex = this.getTimeIndex();
    const index = timeIndex.indexOf(timeLabel);
    return index >= 0 ? this.getValue(index) : undefined;
  }

  setValueByTimeLabel(timeLabel: string, value: number): void {
    const timeIndex = this.getTimeIndex();
    let index = timeIndex.indexOf(timeLabel);
    
    if (index === -1) {
      // Add new time label
      timeIndex.push(timeLabel);
      index = timeIndex.length - 1;
      this.setTimeIndex(timeIndex);
    }
    
    this.setValue(value, index);
  }

  getTimeSeries(): Array<{ time: string; value: number }> {
    const timeIndex = this.getTimeIndex();
    const values = this.values || [];
    
    return timeIndex.map((time, index) => ({
      time,
      value: values[index] || 0
    }));
  }

  appendTimeSeriesData(data: Array<{ time: string; value: number }>): void {
    const currentTimeIndex = this.getTimeIndex();
    const currentValues = this.values || [];
    
    data.forEach(({ time, value }) => {
      const existingIndex = currentTimeIndex.indexOf(time);
      if (existingIndex >= 0) {
        currentValues[existingIndex] = value;
      } else {
        currentTimeIndex.push(time);
        currentValues.push(value);
      }
    });
    
    this.setTimeIndex(currentTimeIndex);
    this.values = currentValues;
    this.touch();
  }

  // Marketplace methods
  isFromMarketplace(): boolean {
    return !!this.metadata?.marketplaceId;
  }

  getMarketplaceInfo(): { id?: string; author?: string; version?: string } {
    return {
      id: this.metadata?.marketplaceId,
      author: this.metadata?.author,
      version: this.metadata?.version
    };
  }

  // Mathematical validation
  validateDomain(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const domain = this.metadata?.domain;
    
    if (domain && this.values) {
      for (const [index, value] of this.values.entries()) {
        if (domain.min !== undefined && value < domain.min) {
          errors.push(`Value ${value} at index ${index} is below minimum ${domain.min}`);
        }
        if (domain.max !== undefined && value > domain.max) {
          errors.push(`Value ${value} at index ${index} is above maximum ${domain.max}`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private touch(): void {
    if (!this.metadata) this.metadata = {};
    this.metadata.updated = new Date();
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