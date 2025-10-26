/**
 * Lava API Integration
 * Handles AI model requests through Lava's payment gateway
 */

import { Request, Response } from 'express';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  frameworks?: string[];
  temperature?: number;
  max_tokens?: number;
}

export class LavaAPI {
  private baseUrl: string;
  private forwardToken: string;

  constructor() {
    this.baseUrl = process.env.LAVA_BASE_URL || 'https://api.lavapayments.com/v1';
    this.forwardToken = process.env.LAVA_FORWARD_TOKEN || '';

    if (!this.forwardToken) {
      console.warn('⚠️  LAVA_FORWARD_TOKEN not found in environment variables');
    } else {
      console.log('✅ Lava API configured successfully');
    }
  }

  /**
   * Chat completion endpoint
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      if (!this.forwardToken) {
        res.status(500).json({ 
          error: 'Lava API not configured',
          message: 'LAVA_FORWARD_TOKEN is missing from environment variables'
        });
        return;
      }

      const { model, messages, frameworks, temperature = 0.7, max_tokens = 2000 }: ChatRequest = req.body;

      if (!model || !messages || messages.length === 0) {
        res.status(400).json({ 
          error: 'Invalid request',
          message: 'Model and messages are required'
        });
        return;
      }

      // Build system message with framework context
      let systemMessage = 'You are an AI assistant helping users analyze and understand their VibeCast frameworks. ';
      systemMessage += 'Frameworks are graph-based structures with nodes and edges representing various relationships. ';
      
      if (frameworks && frameworks.length > 0) {
        systemMessage += `The user has selected these frameworks: ${frameworks.join(', ')}. `;
        systemMessage += 'Provide detailed, insightful responses about these frameworks, their structure, patterns, and relationships. ';
      }
      
      systemMessage += 'Always provide comprehensive, well-structured responses with clear explanations.';

      // Prepare messages with system context
      const allMessages: ChatMessage[] = [
        { role: 'system', content: systemMessage },
        ...messages
      ];

      // Map model names to provider endpoints
      const modelConfig = this.getModelConfig(model);

      // Build the forward URL with the target API endpoint
      const targetUrl = modelConfig.provider === 'openai' 
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages';

      // Make request to Lava API using /forward endpoint
      const forwardUrl = `${this.baseUrl}/forward?u=${encodeURIComponent(targetUrl)}`;

      const response = await fetch(forwardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.forwardToken}`,
        },
        body: JSON.stringify({
          model: modelConfig.apiModel,
          messages: allMessages,
          temperature,
          max_tokens,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        console.error('Lava API error:', response.status, errorData);
        
        res.status(response.status).json({
          error: 'Lava API request failed',
          message: errorData.error?.message || 'Unknown error occurred',
          details: errorData
        });
        return;
      }

      const data = await response.json() as any;
      
      // Log Lava request ID for tracking
      const lavaRequestId = response.headers.get('x-lava-request-id');
      if (lavaRequestId) {
        console.log('✅ Lava request ID:', lavaRequestId);
      }
      
      // Extract the assistant's response
      const assistantMessage = data.choices?.[0]?.message?.content || 'No response generated';

      res.json({
        success: true,
        message: assistantMessage,
        model: model,
        usage: data.usage
      });

    } catch (error: any) {
      console.error('Error in Lava chat:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(req: Request, res: Response): Promise<void> {
    try {
      // Return list of models we support through Lava
      const models = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'OpenAI',
          description: 'Most capable OpenAI model. Best for complex reasoning and analysis.',
          supportsFiles: false
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'OpenAI',
          description: 'Faster GPT-4 with 128k context window.',
          supportsFiles: false
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'OpenAI',
          description: 'Fast and efficient for most tasks.',
          supportsFiles: false
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'Anthropic',
          description: 'Most capable Anthropic model with file support.',
          supportsFiles: true
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'Anthropic',
          description: 'Balanced performance and speed.',
          supportsFiles: true
        },
        {
          id: 'claude-3-haiku',
          name: 'Claude 3 Haiku',
          provider: 'Anthropic',
          description: 'Fastest Claude model.',
          supportsFiles: false
        }
      ];

      res.json({
        success: true,
        models
      });
    } catch (error: any) {
      console.error('Error getting available models:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Map our model IDs to Lava's API model names
   */
  private getModelConfig(modelId: string): { apiModel: string; provider: string } {
    const modelMap: Record<string, { apiModel: string; provider: string }> = {
      'gpt-4': { apiModel: 'gpt-4', provider: 'openai' },
      'gpt-4-turbo': { apiModel: 'gpt-4-turbo-preview', provider: 'openai' },
      'gpt-3.5-turbo': { apiModel: 'gpt-3.5-turbo', provider: 'openai' },
      'claude-3-opus': { apiModel: 'claude-3-opus-20240229', provider: 'anthropic' },
      'claude-3-sonnet': { apiModel: 'claude-3-sonnet-20240229', provider: 'anthropic' },
      'claude-3-haiku': { apiModel: 'claude-3-haiku-20240307', provider: 'anthropic' }
    };

    return modelMap[modelId] || { apiModel: modelId, provider: 'unknown' };
  }

  /**
   * Health check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'ok',
      configured: !!this.forwardToken,
      baseUrl: this.baseUrl
    });
  }
}

export const lavaAPI = new LavaAPI();
