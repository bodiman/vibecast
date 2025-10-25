import type { 
  ApiConfig, 
  GraphData, 
  ModelListResponse, 
  LayoutUpdateRequest,
  ModelInfo 
} from '../types/api';

class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: ApiConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 10000; // 10s default timeout
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        
        // Retry on certain status codes
        if (retryCount < this.maxRetries && this.shouldRetry(response.status)) {
          console.warn(`Request failed, retrying in ${this.retryDelay}ms... (${retryCount + 1}/${this.maxRetries})`);
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text() as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }
        
        // Retry on network errors
        if (retryCount < this.maxRetries && this.isNetworkError(error)) {
          console.warn(`Network error, retrying in ${this.retryDelay}ms... (${retryCount + 1}/${this.maxRetries})`);
          await this.delay(this.retryDelay * (retryCount + 1));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
        
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  private shouldRetry(status: number): boolean {
    return status >= 500 || status === 408 || status === 429;
  }

  private isNetworkError(error: Error): boolean {
    return error.message.includes('fetch') || 
           error.message.includes('network') ||
           error.message.includes('timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Get list of available models
  async getModels(): Promise<string[]> {
    const response = await this.request<ModelListResponse>('/api/models');
    return response.models;
  }

  // Get model information
  async getModelInfo(modelName: string): Promise<ModelInfo> {
    return this.request(`/api/models/${encodeURIComponent(modelName)}/info`);
  }

  // Get graph data for a specific model
  async getGraphData(modelName: string): Promise<GraphData> {
    return this.request(`/api/models/${encodeURIComponent(modelName)}/graph`);
  }

  // Save graph layout (node positions)
  async saveLayout(modelName: string, layout: LayoutUpdateRequest): Promise<void> {
    await this.request(`/api/models/${encodeURIComponent(modelName)}/layout`, {
      method: 'POST',
      body: JSON.stringify(layout),
    });
  }

  // Test API connectivity
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }
}

// Create API client instance
const getApiBaseUrl = (): string => {
  // Check for environment variable first
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  // In development, use local server
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }

  // In production, use the deployed MCP server
  return 'https://vibecast.fly.dev';
};

export const apiClient = new ApiClient({
  baseUrl: getApiBaseUrl(),
  timeout: 15000, // 15s timeout for 3D data loading
});

export default apiClient;