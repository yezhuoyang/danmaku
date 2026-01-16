/**
 * AI Service API Interface
 * 
 * This module defines the API structure for AI-powered annotation generation.
 * The design is backend-agnostic - you can implement this interface with any AI provider
 * (OpenAI, Anthropic, local models, etc.)
 * 
 * KEY DESIGN: The AI must specify EXACT text from the paper that should be annotated.
 * This allows the frontend to search for and highlight the exact text in the PDF.
 * 
 * USAGE FOR BACKEND DEVELOPERS:
 * 1. Send paper content + this API structure to your AI model
 * 2. Parse the AI response into AnnotationSuggestion[] format
 * 3. Return the suggestions to the frontend
 * 4. Frontend will search for exactQuote in the PDF and highlight it
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
  /** 
   * CRITICAL: The EXACT quote from the paper that should be highlighted.
   * This must be a verbatim copy of text from the paper content.
   * The frontend will search for this exact string to find the location.
   */
  exactQuote: string;
  /**
   * A shorter key phrase from exactQuote for fallback matching.
   * Should be 3-10 words that uniquely identify the location.
   */
  keyPhrase: string;
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
  /** Legacy field - kept for compatibility but not used for positioning */
  targetText?: string;
  /** Legacy field - kept for compatibility but not used for positioning */
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
// PROMPT TEMPLATES - REDESIGNED FOR EXACT TEXT MATCHING
// ============================================================================

export const SYSTEM_PROMPT = `You are an AI research assistant helping readers understand academic papers. Your task is to analyze the paper content and suggest helpful annotations.

CRITICAL INSTRUCTION: For each annotation, you MUST provide the EXACT text from the paper that should be highlighted. This text will be used to locate and highlight the specific region in the PDF.

For each annotation, you should:
1. Identify key elements (equations, methods, conclusions, definitions, results)
2. Copy the EXACT text/sentence from the paper that should be annotated (verbatim, character-for-character)
3. Provide a shorter key phrase (3-10 words) from that text for fallback matching
4. Provide clear, concise explanations
5. Use LaTeX for mathematical expressions when appropriate
6. Rate your confidence in each suggestion

Output your suggestions in the following JSON format:
{
  "suggestions": [
    {
      "id": "unique-id-1",
      "type": "equation|conclusion|method|definition|result|insight|question",
      "exactQuote": "THE EXACT SENTENCE OR PHRASE FROM THE PAPER - MUST BE VERBATIM",
      "keyPhrase": "3-10 word key phrase from the quote",
      "content": "your annotation/explanation",
      "latex": "optional LaTeX formula",
      "confidence": 0.0-1.0,
      "reasoning": "why this annotation is helpful"
    }
  ]
}

IMPORTANT RULES:
1. exactQuote MUST be copied EXACTLY from the paper text - do not paraphrase or modify
2. exactQuote should be a complete sentence or meaningful phrase (not too short, not too long)
3. keyPhrase should be a distinctive part of exactQuote that uniquely identifies the location
4. Do not include line breaks or special formatting in exactQuote
5. If the text contains mathematical notation, include it as it appears in the text`;

export function buildUserPrompt(request: AIAnnotationRequest): string {
  const { paper, annotationTypes, customPrompt, language, maxSuggestions } = request;
  
  let prompt = `Please analyze the following paper content and generate annotation suggestions.

IMPORTANT: For each suggestion, you MUST copy the EXACT text from the paper that should be highlighted. The "exactQuote" field must contain verbatim text from the paper content below.

Paper Information:
- Title: ${paper.title || 'Unknown'}
- Authors: ${paper.authors?.join(', ') || 'Unknown'}
- Page: ${paper.pageNumber} of ${paper.totalPages}

=== PAGE CONTENT START ===
${paper.pageText}
=== PAGE CONTENT END ===

Annotation Types to Focus On: ${annotationTypes.join(', ')}
Maximum Suggestions: ${maxSuggestions || 5}
Language for explanations: ${language === 'zh' ? 'Chinese' : language === 'en' ? 'English' : 'Same as paper'}
`;

  if (paper.existingAnnotations && paper.existingAnnotations.length > 0) {
    prompt += `\nExisting Annotations (avoid duplicating these topics):
${paper.existingAnnotations.map(a => `- [${a.type}] ${a.text}`).join('\n')}
`;
  }

  if (customPrompt) {
    prompt += `\nAdditional Instructions: ${customPrompt}`;
  }

  prompt += `

REMINDER: The "exactQuote" field must contain text that appears EXACTLY in the PAGE CONTENT above. The frontend will search for this exact string to highlight it in the PDF.

Please provide your annotation suggestions in the JSON format specified.`;

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
              // Ensure backward compatibility
              if (!suggestion.exactQuote && suggestion.targetText) {
                suggestion.exactQuote = suggestion.targetText;
              }
              if (!suggestion.keyPhrase && suggestion.exactQuote) {
                // Extract first 5-10 words as key phrase
                const words = suggestion.exactQuote.split(/\s+/).slice(0, 8);
                suggestion.keyPhrase = words.join(' ');
              }
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
// TEXT MATCHING UTILITIES
// ============================================================================

/**
 * Find the position of a text quote in the PDF page text.
 * Returns the start and end character indices, or null if not found.
 */
export function findTextInPage(pageText: string, quote: string): { start: number; end: number } | null {
  // Normalize whitespace for matching
  const normalizedPage = pageText.replace(/\s+/g, ' ').toLowerCase();
  const normalizedQuote = quote.replace(/\s+/g, ' ').toLowerCase();
  
  const index = normalizedPage.indexOf(normalizedQuote);
  if (index !== -1) {
    return { start: index, end: index + normalizedQuote.length };
  }
  
  return null;
}

/**
 * Find text using fuzzy matching when exact match fails.
 * Returns the best matching substring and its position.
 */
export function fuzzyFindTextInPage(
  pageText: string, 
  quote: string,
  keyPhrase?: string
): { text: string; start: number; end: number; confidence: number } | null {
  // First try exact match
  const exactMatch = findTextInPage(pageText, quote);
  if (exactMatch) {
    return { text: quote, ...exactMatch, confidence: 1.0 };
  }
  
  // Try key phrase if provided
  if (keyPhrase) {
    const keyMatch = findTextInPage(pageText, keyPhrase);
    if (keyMatch) {
      return { text: keyPhrase, ...keyMatch, confidence: 0.8 };
    }
  }
  
  // Try partial matching - find the longest matching substring
  const words = quote.split(/\s+/);
  for (let len = words.length; len >= 3; len--) {
    for (let start = 0; start <= words.length - len; start++) {
      const partial = words.slice(start, start + len).join(' ');
      const match = findTextInPage(pageText, partial);
      if (match) {
        return { 
          text: partial, 
          ...match, 
          confidence: len / words.length * 0.7 
        };
      }
    }
  }
  
  return null;
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const aiService = new OpenAIService();
