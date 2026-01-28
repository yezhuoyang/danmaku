/**
 * AI Client
 *
 * Handles API calls to different AI providers (OpenAI, Anthropic, Google).
 * Uses user-provided API keys stored in the browser.
 */

// Message format for AI calls
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// AI call options
export interface AICallOptions {
  modelId: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  apiKeys: Record<string, string>;  // provider -> key
  signal?: AbortSignal;
}

// AI response
export interface AIResponse {
  content: string;
  tokensUsed: number;
  modelId: string;
}

// Model provider mapping
const MODEL_PROVIDERS: Record<string, string> = {
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-3.5-turbo': 'openai',
  'claude-sonnet-4': 'anthropic',
  'claude-haiku-4': 'anthropic',
  'claude-opus-4': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-sonnet': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'gemini-2-pro': 'google',
  'gemini-2-flash': 'google',
  'gemini-1.5-pro': 'google',
  'gemini-1.5-flash': 'google',
};

// Model ID normalization
const MODEL_API_NAMES: Record<string, string> = {
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-haiku-4': 'claude-haiku-4-20250514',
  'claude-opus-4': 'claude-opus-4-20250514',
  'gemini-2-pro': 'gemini-2.0-pro',
  'gemini-2-flash': 'gemini-2.0-flash',
};

/**
 * Call an AI model
 */
export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const provider = MODEL_PROVIDERS[options.modelId];

  if (!provider) {
    throw new Error(`Unknown model: ${options.modelId}`);
  }

  const apiKey = options.apiKeys[provider];
  if (!apiKey) {
    throw new Error(`No API key found for provider: ${provider}. Please configure your ${provider} API key.`);
  }

  switch (provider) {
    case 'openai':
      return callOpenAI(options, apiKey);
    case 'anthropic':
      return callAnthropic(options, apiKey);
    case 'google':
      return callGoogle(options, apiKey);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(options: AICallOptions, apiKey: string): Promise<AIResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.modelId,
      messages: options.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    content: data.choices[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
    modelId: options.modelId,
  };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(options: AICallOptions, apiKey: string): Promise<AIResponse> {
  // Anthropic uses a different message format
  // System message is separate, and messages must alternate user/assistant
  const systemMessage = options.messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Ensure messages alternate and start with user
  const normalizedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const msg of conversationMessages) {
    if (normalizedMessages.length === 0) {
      if (msg.role === 'assistant') {
        // Insert empty user message if starting with assistant
        normalizedMessages.push({ role: 'user', content: '(continue)' });
      }
    } else {
      const lastRole = normalizedMessages[normalizedMessages.length - 1].role;
      if (lastRole === msg.role) {
        // Combine consecutive same-role messages
        normalizedMessages[normalizedMessages.length - 1].content += '\n\n' + msg.content;
        continue;
      }
    }
    normalizedMessages.push(msg);
  }

  // Ensure at least one user message
  if (normalizedMessages.length === 0) {
    normalizedMessages.push({ role: 'user', content: systemMessage || 'Hello' });
  }

  const modelName = MODEL_API_NAMES[options.modelId] || options.modelId;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: options.maxTokens ?? 4096,
      system: systemMessage || undefined,
      messages: normalizedMessages,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    content: data.content?.[0]?.text || '',
    tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    modelId: options.modelId,
  };
}

/**
 * Call Google Gemini API
 */
async function callGoogle(options: AICallOptions, apiKey: string): Promise<AIResponse> {
  const modelName = MODEL_API_NAMES[options.modelId] || options.modelId;

  // Convert messages to Gemini format
  const systemInstruction = options.messages.find(m => m.role === 'system')?.content;
  const contents = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Ensure at least one message
  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: systemInstruction || 'Hello' }],
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096,
        },
      }),
      signal: options.signal,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Google API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();

  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokensUsed: data.usageMetadata?.totalTokenCount || 0,
    modelId: options.modelId,
  };
}

/**
 * Validate an API key by making a test call
 */
export async function validateApiKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    switch (provider) {
      case 'openai': {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        return response.ok;
      }

      case 'anthropic': {
        // Anthropic doesn't have a simple validation endpoint
        // Try a minimal API call
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        return response.ok;
      }

      case 'google': {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        return response.ok;
      }

      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Get provider for a model
 */
export function getModelProvider(modelId: string): string | null {
  return MODEL_PROVIDERS[modelId] || null;
}

/**
 * Get all supported models
 */
export function getSupportedModels(): Array<{ id: string; name: string; provider: string }> {
  return [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic' },
    { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'anthropic' },
    { id: 'gemini-2-pro', name: 'Gemini 2.0 Pro', provider: 'google' },
    { id: 'gemini-2-flash', name: 'Gemini 2.0 Flash', provider: 'google' },
  ];
}
