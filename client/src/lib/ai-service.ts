/**
 * AI Service API Interface
 * 
 * This module defines the API structure for AI-powered annotation generation.
 * The design is backend-agnostic - you can implement this interface with any AI provider
 * (OpenAI, Anthropic, local models, etc.)
 * 
 * USAGE FOR BACKEND DEVELOPERS:
 * 1. Send paper content + this API structure to your AI model
 * 2. Parse the AI response into AnnotationSuggestion[] format
 * 3. Return the suggestions to the frontend
 */

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface AIProviderConfig {
  /** Provider name: 'openai', 'anthropic', 'custom' */
  provider: 'openai' | 'anthropic' | 'custom';
  /** API key for authentication */
  apiKey: string;
  /** Model identifier (e.g., 'gpt-4', 'gpt-3.5-turbo', 'claude-3-opus') */
  model: string;
  /** Base URL for API calls (optional, for custom endpoints) */
  baseUrl?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for response randomness (0-1) */
  temperature?: number;
}

export const DEFAULT_CONFIG: Partial<AIProviderConfig> = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  maxTokens: 4096,
  temperature: 0.3,
};

// ============================================================================
// PAPER CONTENT TYPES
// ============================================================================

export interface PaperContent {
  /** Paper title */
  title?: string;
  /** Paper authors */
  authors?: string[];
  /** Paper abstract */
  abstract?: string;
  /** Full text content of the current page */
  pageText: string;
  /** Current page number */
  pageNumber: number;
  /** Total pages */
  totalPages: number;
  /** Existing annotations on this page (for context) */
  existingAnnotations?: ExistingAnnotation[];
}

export interface ExistingAnnotation {
  text: string;
  type: 'text' | 'figure' | 'table' | 'equation';
  userName: string;
}

// ============================================================================
// ANNOTATION SUGGESTION TYPES
// ============================================================================

export type AnnotationType = 'equation' | 'conclusion' | 'method' | 'definition' | 'result' | 'insight' | 'question';

export interface AnnotationSuggestion {
  /** Unique identifier for this suggestion */
  id: string;
  /** Type of annotation */
  type: AnnotationType;
  /** The text/region this annotation refers to */
  targetText: string;
  /** The annotation content (can include LaTeX) */
  content: string;
  /** LaTeX formula if applicable */
  latex?: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation of why this annotation was suggested */
  reasoning?: string;
  /** Suggested color for the annotation */
  suggestedColor?: string;
  /** Approximate position hint (percentage from top of page) */
  positionHint?: number;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AIAnnotationRequest {
  /** Paper content to analyze */
  paper: PaperContent;
  /** What types of annotations to generate */
  annotationTypes: AnnotationType[];
  /** User's custom instructions */
  customPrompt?: string;
  /** Language for annotations */
  language?: 'en' | 'zh' | 'auto';
  /** Maximum number of suggestions to return */
  maxSuggestions?: number;
}

export interface AIAnnotationResponse {
  /** Generated annotation suggestions */
  suggestions: AnnotationSuggestion[];
  /** Token usage information */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Any warnings or notes */
  warnings?: string[];
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

export interface StreamingChunk {
  /** Chunk type */
  type: 'start' | 'content' | 'suggestion' | 'done' | 'error';
  /** Partial content for streaming display */
  content?: string;
  /** Complete suggestion when available */
  suggestion?: AnnotationSuggestion;
  /** Error message if type is 'error' */
  error?: string;
}

export type StreamCallback = (chunk: StreamingChunk) => void;

// ============================================================================
// AI SERVICE INTERFACE
// ============================================================================

export interface IAIService {
  /** Configure the AI provider */
  configure(config: AIProviderConfig): void;
  
  /** Check if the service is configured and ready */
  isConfigured(): boolean;
  
  /** Generate annotation suggestions (non-streaming) */
  generateAnnotations(request: AIAnnotationRequest): Promise<AIAnnotationResponse>;
  
  /** Generate annotation suggestions with streaming */
  generateAnnotationsStream(
    request: AIAnnotationRequest,
    onChunk: StreamCallback
  ): Promise<void>;
  
  /** Test the API connection */
  testConnection(): Promise<{ success: boolean; message: string }>;
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

export const SYSTEM_PROMPT = `You are an AI research assistant helping readers understand academic papers. Your task is to analyze the paper content and suggest helpful annotations.

For each annotation, you should:
1. Identify key elements (equations, methods, conclusions, definitions, results)
2. Provide clear, concise explanations
3. Use LaTeX for mathematical expressions when appropriate
4. Rate your confidence in each suggestion

Output your suggestions in the following JSON format:
{
  "suggestions": [
    {
      "id": "unique-id",
      "type": "equation|conclusion|method|definition|result|insight|question",
      "targetText": "the exact text or equation being annotated",
      "content": "your annotation/explanation",
      "latex": "optional LaTeX formula",
      "confidence": 0.0-1.0,
      "reasoning": "why this annotation is helpful",
      "positionHint": 0.0-1.0 (position from top of page)
    }
  ]
}`;

export function buildUserPrompt(request: AIAnnotationRequest): string {
  const { paper, annotationTypes, customPrompt, language, maxSuggestions } = request;
  
  let prompt = `Please analyze the following paper content and generate annotation suggestions.

Paper Information:
- Title: ${paper.title || 'Unknown'}
- Authors: ${paper.authors?.join(', ') || 'Unknown'}
- Page: ${paper.pageNumber} of ${paper.totalPages}

Page Content:
"""
${paper.pageText}
"""

Annotation Types to Focus On: ${annotationTypes.join(', ')}
Maximum Suggestions: ${maxSuggestions || 5}
Language: ${language === 'zh' ? 'Chinese' : language === 'en' ? 'English' : 'Same as paper'}
`;

  if (paper.existingAnnotations && paper.existingAnnotations.length > 0) {
    prompt += `\nExisting Annotations (avoid duplicating):
${paper.existingAnnotations.map(a => `- [${a.type}] ${a.text}`).join('\n')}
`;
  }

  if (customPrompt) {
    prompt += `\nAdditional Instructions: ${customPrompt}`;
  }

  prompt += `\n\nPlease provide your annotation suggestions in the JSON format specified.`;

  return prompt;
}

// ============================================================================
// OPENAI IMPLEMENTATION
// ============================================================================

export class OpenAIService implements IAIService {
  private config: AIProviderConfig | null = null;

  configure(config: AIProviderConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.config?.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        const error = await response.json();
        return { success: false, message: error.error?.message || 'Connection failed' };
      }
    } catch (error) {
      return { success: false, message: `Connection error: ${error}` };
    }
  }

  async generateAnnotations(request: AIAnnotationRequest): Promise<AIAnnotationResponse> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(request) },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    try {
      const parsed = JSON.parse(content);
      return {
        suggestions: parsed.suggestions || [],
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
      };
    } catch {
      throw new Error('Failed to parse AI response');
    }
  }

  async generateAnnotationsStream(
    request: AIAnnotationRequest,
    onChunk: StreamCallback
  ): Promise<void> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    
    onChunk({ type: 'start' });

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(request) },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      onChunk({ type: 'error', error: error.error?.message || 'API request failed' });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onChunk({ type: 'error', error: 'No response body' });
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk({ type: 'content', content });
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      // Parse the complete response
      try {
        // Find JSON in the response
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.suggestions) {
            for (const suggestion of parsed.suggestions) {
              onChunk({ type: 'suggestion', suggestion });
            }
          }
        }
      } catch {
        onChunk({ type: 'error', error: 'Failed to parse AI response' });
      }

      onChunk({ type: 'done' });
    } catch (error) {
      onChunk({ type: 'error', error: `Stream error: ${error}` });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const aiService = new OpenAIService();
