// Anthropic Provider Implementation
// Supports: Claude Opus 4.5, Sonnet 4.5, Opus 4.1, Sonnet 4, Haiku 4, Claude 3 Opus, Claude 3.5 Sonnet

import type {
  AIProvider,
  AIMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';
import { AIProviderError, APIKeyInvalidError, RateLimitError } from './types';

// All supported Anthropic models
const SUPPORTED_MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-opus-4-1',
  'claude-sonnet-4',
  'claude-haiku-4',
  'claude-3-opus',
  'claude-3-5-sonnet',
  'claude-3-sonnet',
  'claude-3-haiku',
];

// Map from our model IDs to Anthropic's API model IDs
const MODEL_ID_MAP: Record<string, string> = {
  'claude-opus-4-5': 'claude-opus-4-5-20251101',
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20251022',
  'claude-opus-4-1': 'claude-opus-4-1-20251025',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-haiku-4': 'claude-haiku-4-20250514',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
};

export class AnthropicProvider implements AIProvider {
  readonly name = 'Anthropic';
  readonly type = 'anthropic' as const;

  private readonly defaultBaseUrl = 'https://api.anthropic.com';
  private readonly apiVersion = '2023-06-01';

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

    // Map to Anthropic's model ID
    const anthropicModelId = MODEL_ID_MAP[model] || model;

    // Extract system message (Anthropic uses a separate "system" field)
    const { systemPrompt, conversationMessages } = this.formatMessages(messages);

    const requestBody: Record<string, unknown> = {
      model: anthropicModelId,
      max_tokens: maxTokens,
      temperature,
      messages: conversationMessages,
    };

    // Add system prompt if present
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await this.handleError(response, model);
    }

    const data = await response.json();

    // Extract text from Anthropic's response format
    const content = data.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('') || '';

    return {
      content,
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model: data.model || anthropicModelId,
      finishReason: data.stop_reason,
    };
  }

  private formatMessages(messages: AIMessage[]): {
    systemPrompt: string | null;
    conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  } {
    let systemPrompt: string | null = null;
    const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Combine multiple system messages if present
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
      } else {
        conversationMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    return { systemPrompt, conversationMessages };
  }

  private async handleError(response: Response, model: string): Promise<never> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: 'Unknown error' } };
    }

    const errorMessage = errorData.error?.message || 'Unknown Anthropic error';
    const errorType = errorData.error?.type;

    console.error('Anthropic API error:', errorData);

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
      errorType,
      errorData
    );
  }
}

// Export singleton instance
export const anthropicProvider = new AnthropicProvider();
