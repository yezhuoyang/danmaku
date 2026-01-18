// OpenAI Provider Implementation
// Supports: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-5, GPT-5.2, o1, o1-mini, o3, o3-mini, o4, o4-mini

import type {
  AIProvider,
  AIMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';
import { AIProviderError, APIKeyInvalidError, RateLimitError } from './types';

// OpenAI models that use max_completion_tokens instead of max_tokens
// These are newer models (GPT-5.x, o-series) that require the new parameter
const MODELS_USING_MAX_COMPLETION_TOKENS = [
  'gpt-5',
  'gpt-5.2',
  'o1',
  'o1-mini',
  'o1-preview',
  'o3',
  'o3-mini',
  'o4',
  'o4-mini',
];

// All supported OpenAI models
const SUPPORTED_MODELS = [
  'gpt-5.2',
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o4',
  'o4-mini',
  'o3',
  'o3-mini',
  'o1',
  'o1-mini',
  'o1-preview',
];

// O-series models that don't support system messages in the standard way
const O_SERIES_MODELS = ['o1', 'o1-mini', 'o1-preview', 'o3', 'o3-mini', 'o4', 'o4-mini'];

export class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';
  readonly type = 'openai' as const;

  private readonly defaultBaseUrl = 'https://api.openai.com/v1';

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

    // Determine if this model uses max_completion_tokens
    const usesMaxCompletionTokens = MODELS_USING_MAX_COMPLETION_TOKENS.some(
      m => model.toLowerCase().startsWith(m.toLowerCase())
    );

    // Check if this is an O-series model (they handle system prompts differently)
    const isOSeriesModel = O_SERIES_MODELS.some(
      m => model.toLowerCase().startsWith(m.toLowerCase())
    );

    // Build the request body with model-specific parameters
    const requestBody: Record<string, unknown> = {
      model,
      messages: this.formatMessages(messages, isOSeriesModel),
    };

    // Add temperature only for non-O-series models (O-series doesn't support it)
    if (!isOSeriesModel) {
      requestBody.temperature = temperature;
    }

    // Add the correct max tokens parameter
    if (usesMaxCompletionTokens) {
      requestBody.max_completion_tokens = maxTokens;
    } else {
      requestBody.max_tokens = maxTokens;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        ...(config.organizationId && { 'OpenAI-Organization': config.organizationId }),
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
      model: data.model || model,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  private formatMessages(messages: AIMessage[], isOSeriesModel: boolean): AIMessage[] {
    if (!isOSeriesModel) {
      return messages;
    }

    // O-series models: Convert system messages to user messages with a prefix
    // O1/O3/O4 models don't support the "system" role directly
    return messages.map(msg => {
      if (msg.role === 'system') {
        return {
          role: 'user',
          content: `[System Instructions]\n${msg.content}`,
        };
      }
      return msg;
    });
  }

  private async handleError(response: Response, model: string): Promise<never> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: 'Unknown error' } };
    }

    const errorMessage = errorData.error?.message || 'Unknown OpenAI error';
    const errorCode = errorData.error?.code;

    console.error('OpenAI API error:', errorData);

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
export const openaiProvider = new OpenAIProvider();
