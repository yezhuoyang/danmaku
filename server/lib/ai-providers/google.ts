// Google Gemini Provider Implementation
// Supports: Gemini 3 Pro, Gemini 3 Deep Think, Gemini 2.0 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro

import type {
  AIProvider,
  AIMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';
import { AIProviderError, APIKeyInvalidError, RateLimitError } from './types';

// All supported Google models
const SUPPORTED_MODELS = [
  'gemini-3-pro',
  'gemini-3-deep-think',
  'gemini-2-pro',
  'gemini-2-flash',
  'gemini-1-5-pro',
  'gemini-1-5-flash',
  'gemini-pro',
];

// Map from our model IDs to Google's API model IDs
const MODEL_ID_MAP: Record<string, string> = {
  'gemini-3-pro': 'gemini-3.0-pro',
  'gemini-3-deep-think': 'gemini-3.0-deep-think',
  'gemini-2-pro': 'gemini-2.0-pro',
  'gemini-2-flash': 'gemini-2.0-flash',
  'gemini-1-5-pro': 'gemini-1.5-pro',
  'gemini-1-5-flash': 'gemini-1.5-flash',
  'gemini-pro': 'gemini-pro',
};

export class GoogleProvider implements AIProvider {
  readonly name = 'Google';
  readonly type = 'google' as const;

  private readonly defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta';

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

    // Map to Google's model ID
    const googleModelId = MODEL_ID_MAP[model] || model;

    // Format messages for Gemini API
    const { systemInstruction, contents } = this.formatMessages(messages);

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    };

    // Add system instruction if present
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const url = `${baseUrl}/models/${googleModelId}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await this.handleError(response, model);
    }

    const data = await response.json();

    // Extract text from Gemini's response format
    const content = data.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.text)
      .map((part: any) => part.text)
      .join('') || '';

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      model: googleModelId,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  private formatMessages(messages: AIMessage[]): {
    systemInstruction: string | null;
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  } {
    let systemInstruction: string | null = null;
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Combine multiple system messages
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${msg.content}`
          : msg.content;
      } else {
        // Google uses 'model' instead of 'assistant'
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private async handleError(response: Response, model: string): Promise<never> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: 'Unknown error' } };
    }

    const errorMessage = errorData.error?.message || 'Unknown Google API error';
    const errorCode = errorData.error?.code;

    console.error('Google API error:', errorData);

    if (response.status === 401 || response.status === 403) {
      throw new APIKeyInvalidError(this.name);
    }

    if (response.status === 429) {
      throw new RateLimitError(this.name);
    }

    throw new AIProviderError(
      errorMessage,
      this.name,
      response.status,
      errorCode?.toString(),
      errorData
    );
  }
}

// Export singleton instance
export const googleProvider = new GoogleProvider();
