// AI Provider Factory
// Routes requests to the correct provider based on model ID

import type {
  AIProvider,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderConfig,
} from './types';
import { ModelNotSupportedError } from './types';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { googleProvider } from './google';
import { xaiProvider } from './xai';

// Export types
export * from './types';

// Export individual providers for direct use
export { openaiProvider } from './openai';
export { anthropicProvider } from './anthropic';
export { googleProvider } from './google';
export { xaiProvider } from './xai';

// All registered providers
const providers: AIProvider[] = [
  openaiProvider,
  anthropicProvider,
  googleProvider,
  xaiProvider,
];

/**
 * Get the appropriate provider for a given model ID
 */
export function getProviderForModel(modelId: string): AIProvider | null {
  for (const provider of providers) {
    if (provider.supportsModel(modelId)) {
      return provider;
    }
  }
  return null;
}

/**
 * Get a provider by its type
 */
export function getProviderByType(type: string): AIProvider | null {
  return providers.find(p => p.type === type) || null;
}

/**
 * Get all registered providers
 */
export function getAllProviders(): AIProvider[] {
  return [...providers];
}

/**
 * Check if a model is supported by any provider
 */
export function isModelSupported(modelId: string): boolean {
  return getProviderForModel(modelId) !== null;
}

/**
 * High-level function to make a chat completion request
 * Automatically routes to the correct provider based on model
 */
export async function chatCompletion(
  request: ChatCompletionRequest,
  config: ProviderConfig
): Promise<ChatCompletionResponse> {
  const provider = getProviderForModel(request.model);

  if (!provider) {
    throw new ModelNotSupportedError(
      request.model,
      'any registered provider'
    );
  }

  return provider.chatCompletion(request, config);
}

/**
 * Get all supported model IDs across all providers
 */
export function getAllSupportedModels(): string[] {
  const models: string[] = [];
  for (const provider of providers) {
    models.push(...provider.getSupportedModels());
  }
  return models;
}

/**
 * Get provider information for a model
 */
export function getModelInfo(modelId: string): { provider: string; type: string } | null {
  const provider = getProviderForModel(modelId);
  if (!provider) {
    return null;
  }
  return {
    provider: provider.name,
    type: provider.type,
  };
}
