// xAI Grok Provider Implementation
// Supports all xAI Grok models: Grok 4 family, Grok 3 family, Grok 2
// API Reference: https://docs.x.ai/docs/models

import type {
  AIProvider,
  AIMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';
import { AIProviderError, APIKeyInvalidError, RateLimitError } from './types';

// All supported xAI models
// Based on https://docs.x.ai/docs/models
const SUPPORTED_MODELS = [
  // Grok 4 family (latest)
  'grok-4',                       // Latest Grok 4
  'grok-4-07-09',                 // Grok 4 (256K context)
  'grok-4-fast-non-reasoning',    // Grok 4 Fast non-reasoning (2M context)
  'grok-4-fast-reasoning',        // Grok 4 Fast reasoning (2M context)
  'grok-4-1-fast-non-reasoning',  // Grok 4.1 Fast non-reasoning (2M context)
  'grok-4-1-fast-reasoning',      // Grok 4.1 Fast reasoning (2M context)
  'grok-code-fast-1',             // Grok Code Fast (256K context, optimized for agentic coding)

  // Grok 3 family
  'grok-3',                       // Grok 3 (alias)
  'grok-3-beta',                  // Grok 3 Beta (131K context)
  'grok-3-mini',                  // Grok 3 Mini (alias)
  'grok-3-mini-beta',             // Grok 3 Mini Beta (131K context)

  // Grok 2 family
  'grok-2',                       // Grok 2
  'grok-2-image',                 // Grok 2 Image generation
  'grok-2-image-1212',            // Grok 2 Image (specific version)

  // Legacy/Beta
  'grok-beta',                    // Grok Beta
];

// Map from our model IDs to xAI's API model IDs
const MODEL_ID_MAP: Record<string, string> = {
  // Grok 4 family
  'grok-4': 'grok-4',
  'grok-4-07-09': 'grok-4-07-09',
  'grok-4-fast-non-reasoning': 'grok-4-fast-non-reasoning',
  'grok-4-fast-reasoning': 'grok-4-fast-reasoning',
  'grok-4-1-fast-non-reasoning': 'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast-reasoning': 'grok-4-1-fast-reasoning',
  'grok-code-fast-1': 'grok-code-fast-1',

  // Grok 3 family
  'grok-3': 'grok-3-beta',
  'grok-3-beta': 'grok-3-beta',
  'grok-3-mini': 'grok-3-mini-beta',
  'grok-3-mini-beta': 'grok-3-mini-beta',

  // Grok 2 family
  'grok-2': 'grok-2',
  'grok-2-image': 'grok-2-image',
  'grok-2-image-1212': 'grok-2-image-1212',

  // Legacy
  'grok-beta': 'grok-beta',
};

export class XAIProvider implements AIProvider {
  readonly name = 'xAI';
  readonly type = 'xai' as const;

  // xAI uses an OpenAI-compatible API
  private readonly defaultBaseUrl = 'https://api.x.ai/v1';

  supportsModel(modelId: string): boolean {
    return SUPPORTED_MODELS.includes(modelId);
  }

  getSupportedModels(): string[] {
    return [...SUPPORTED_MODELS];
  }

  async chatCompletion(
    request: ChatCompletionRequest,
    config: ProviderConfig
  ): Promise<ChatCompletionResponse> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const { model, messages, maxTokens = 4000, temperature = 0.7 } = request;

    // Map to xAI's model ID
    const xaiModelId = MODEL_ID_MAP[model] || model;

    // xAI uses OpenAI-compatible format
    const requestBody = {
      model: xaiModelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      temperature,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await this.handleError(response, model);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model: data.model || xaiModelId,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  private async handleError(response: Response, model: string): Promise<never> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: 'Unknown error' } };
    }

    const errorMessage = errorData.error?.message || 'Unknown xAI error';
    const errorCode = errorData.error?.code;

    console.error('xAI API error:', errorData);

    if (response.status === 401) {
      throw new APIKeyInvalidError(this.name);
    }

    if (response.status === 429) {
      throw new RateLimitError(this.name);
    }

    throw new AIProviderError(
      errorMessage,
      this.name,
      response.status,
      errorCode,
      errorData
    );
  }
}

// Export singleton instance
export const xaiProvider = new XAIProvider();
