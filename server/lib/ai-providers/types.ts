// AI Provider Types
// This file defines the interface for AI providers

import type { AiModelProvider } from '../../../shared/types';

// Content part for multimodal messages
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;  // base64 data URI or URL
    detail?: 'low' | 'high' | 'auto';  // Image detail level
  };
}

export type MessageContent = TextContent | ImageContent;

// Message format for AI conversations (supports multimodal)
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];  // String for simple text, array for multimodal
}

// Request options for chat completion
export interface ChatCompletionRequest {
  model: string;                    // Model ID (e.g., "gpt-5.2", "claude-opus-4-5")
  messages: AIMessage[];
  maxTokens?: number;               // Max tokens for response
  temperature?: number;             // 0-2, higher = more creative
  stream?: boolean;                 // Whether to stream the response
}

// Response from chat completion
export interface ChatCompletionResponse {
  content: string;                  // The AI response text
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;                    // Model that was actually used
  finishReason?: string;            // 'stop', 'length', 'content_filter', etc.
}

// Provider configuration
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;                 // For custom endpoints
  organizationId?: string;          // For providers that support org IDs
}

// Abstract base interface for AI providers
export interface AIProvider {
  readonly name: string;            // Provider name (e.g., "OpenAI", "Anthropic")
  readonly type: AiModelProvider;   // Provider type enum

  // Core method: Create chat completion
  chatCompletion(
    request: ChatCompletionRequest,
    config: ProviderConfig
  ): Promise<ChatCompletionResponse>;

  // Check if this provider supports a given model
  supportsModel(modelId: string): boolean;

  // Get the list of supported model IDs
  getSupportedModels(): string[];
}

// Error types for AI providers
export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly errorCode?: string,
    public readonly rawError?: unknown
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class ModelNotSupportedError extends AIProviderError {
  constructor(model: string, provider: string) {
    super(`Model "${model}" is not supported by ${provider}`, provider);
    this.name = 'ModelNotSupportedError';
  }
}

export class APIKeyInvalidError extends AIProviderError {
  constructor(provider: string) {
    super(`Invalid API key for ${provider}`, provider, 401, 'invalid_api_key');
    this.name = 'APIKeyInvalidError';
  }
}

export class RateLimitError extends AIProviderError {
  constructor(provider: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      provider,
      429,
      'rate_limit_exceeded'
    );
    this.name = 'RateLimitError';
  }
}
