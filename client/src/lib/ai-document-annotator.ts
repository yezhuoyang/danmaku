/**
 * AI Document Annotator Service
 *
 * This service analyzes PDF document content (sentences, figures, tables)
 * sentence-by-sentence to help users review papers for correctness, novelty,
 * and consistency. Each sentence gets a label and optional comment.
 */

import { Sentence, SentenceAnnotation, FigureTableAnnotation } from '@/components/annotations/types';
import { FigureTable } from './figure-table-detector';
import { AIProviderConfig, DEFAULT_CONFIG } from './ai-service';

// ============================================================================
// SENTENCE LABEL TYPES
// ============================================================================

/** Labels for classifying sentences in academic papers */
export type SentenceLabel =
  | 'background'      // Prior work, context, motivation
  | 'objective'       // Research goals, hypotheses
  | 'method'          // Methodology, approach, algorithm
  | 'result'          // Experimental results, findings
  | 'conclusion'      // Summary, takeaways
  | 'claim'           // Novel claims, contributions
  | 'limitation'      // Limitations, future work
  | 'definition'      // Definitions, terminology
  | 'example'         // Examples, illustrations
  | 'comparison';     // Comparisons with other work

/** Labels for figures and tables */
export type FigureTableLabel =
  | 'architecture'    // System/model architecture diagram
  | 'results'         // Experimental results visualization
  | 'comparison'      // Comparison with baselines
  | 'ablation'        // Ablation study results
  | 'example'         // Example inputs/outputs
  | 'methodology'     // Method illustration
  | 'data';           // Dataset statistics

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentContent {
  /** Paper title */
  title?: string;
  /** Paper authors */
  authors?: string[];
  /** Current page number */
  pageNumber: number;
  /** Total pages */
  totalPages: number;
  /** Sentences on this page with section info */
  sentences: SentenceForAI[];
  /** Figures and tables on this page */
  figureTables: FigureTableForAI[];
}

export interface SentenceForAI {
  id: string;
  text: string;
  pageNumber: number;
  section?: {
    number: string;
    title: string;
    fullTitle: string;
  };
  position: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface FigureTableForAI {
  id: string;
  type: 'figure' | 'table';
  label: string;
  caption: string;
  pageNumber: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AIDocumentAnnotationRequest {
  document: DocumentContent;
  /** Language for annotations */
  language?: 'en' | 'zh' | 'auto';
}

export interface AISentenceAnalysis {
  /** Sentence ID */
  sentenceId: string;
  /** Classified label for the sentence */
  label: SentenceLabel;
  /** AI comment/analysis (optional - only for important sentences) */
  comment?: string;
  /** Flags for review */
  flags?: {
    /** Potential correctness issue */
    correctnessIssue?: boolean;
    /** Notable novelty claim */
    novelty?: boolean;
    /** Consistency concern with other parts */
    consistencyIssue?: boolean;
  };
}

export interface AIFigureTableAnalysis {
  /** Figure/Table ID */
  figureTableId: string;
  /** Classified label */
  label: FigureTableLabel;
  /** AI comment/analysis */
  comment?: string;
  /** Flags for review */
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
}

export interface AIDocumentAnnotationResponse {
  sentences: AISentenceAnalysis[];
  figureTables: AIFigureTableAnalysis[];
  /** Overall page summary */
  pageSummary?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Debug info - the prompts and raw response */
  debug?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
  };
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

const PAPER_REVIEW_SYSTEM_PROMPT = `You are an expert AI research assistant helping users review academic papers. Your task is to analyze each sentence and figure/table to help evaluate the paper's correctness, novelty, and consistency.

For EACH sentence, you must:
1. Assign a label from: background, objective, method, result, conclusion, claim, limitation, definition, example, comparison
2. Optionally provide a brief comment for important sentences (key claims, potential issues, notable points)
3. Flag any concerns about correctness, novelty claims, or consistency

For EACH figure/table, you must:
1. Assign a label from: architecture, results, comparison, ablation, example, methodology, data
2. Provide a brief comment explaining what it shows and its significance
3. Flag any concerns

Label definitions for sentences:
- background: Prior work, context, motivation, related work citations
- objective: Research goals, hypotheses, problem statements
- method: Methodology, approach, algorithm description, implementation details
- result: Experimental results, findings, measurements, observations
- conclusion: Summary statements, takeaways, final remarks
- claim: Novel claims, contributions, assertions of novelty or improvement
- limitation: Acknowledged limitations, future work suggestions
- definition: Formal definitions, terminology explanations
- example: Concrete examples, illustrations of concepts
- comparison: Explicit comparisons with other methods/work

Output your analysis in JSON format:
{
  "sentences": [
    {
      "sentenceId": "exact-sentence-id",
      "label": "method|result|claim|...",
      "comment": "optional brief comment for important sentences",
      "flags": {
        "correctnessIssue": false,
        "novelty": false,
        "consistencyIssue": false
      }
    }
  ],
  "figureTables": [
    {
      "figureTableId": "exact-id",
      "label": "results|architecture|...",
      "comment": "what this shows and why it matters",
      "flags": { ... }
    }
  ],
  "pageSummary": "Brief 1-2 sentence summary of this page's content"
}

IMPORTANT GUIDELINES:
- Label EVERY sentence - do not skip any
- Only add comments for sentences that are particularly important, novel, or potentially problematic
- Be critical but fair - flag genuine concerns, not nitpicks
- For claims of novelty or superiority, note if evidence seems sufficient
- Look for inconsistencies between claims and results
- Keep comments concise (1-2 sentences max)`;

function buildPaperReviewPrompt(request: AIDocumentAnnotationRequest): string {
  const { document, language } = request;

  let prompt = `Please analyze the following page from an academic paper sentence-by-sentence.

Paper Information:
- Title: ${document.title || 'Unknown'}
- Authors: ${document.authors?.join(', ') || 'Unknown'}
- Page: ${document.pageNumber} of ${document.totalPages}

Your task: Read through each sentence carefully. For each one:
1. Classify it with the appropriate label
2. Add a comment if it's important or potentially problematic
3. Flag any concerns about correctness, novelty claims, or consistency

=== SENTENCES TO ANALYZE ===
`;

  // Add sentences grouped by section for context
  const sectionGroups = new Map<string, SentenceForAI[]>();
  for (const sentence of document.sentences) {
    const sectionKey = sentence.section?.fullTitle || 'No Section';
    if (!sectionGroups.has(sectionKey)) {
      sectionGroups.set(sectionKey, []);
    }
    sectionGroups.get(sectionKey)!.push(sentence);
  }

  for (const [section, sentences] of sectionGroups) {
    prompt += `\n--- Section: ${section} ---\n`;
    for (const sentence of sentences) {
      prompt += `[${sentence.id}]: "${sentence.text}"\n`;
    }
  }

  if (document.figureTables.length > 0) {
    prompt += `\n=== FIGURES AND TABLES TO ANALYZE ===\n`;
    for (const ft of document.figureTables) {
      prompt += `[${ft.id}] ${ft.type.toUpperCase()}: ${ft.label}\nCaption: "${ft.caption}"\n\n`;
    }
  }

  prompt += `\n=== INSTRUCTIONS ===
Language for comments: ${language === 'zh' ? 'Chinese' : language === 'en' ? 'English' : 'Same as paper'}

Remember:
- Label EVERY sentence listed above
- Add comments only for important/notable sentences
- Be helpful for paper review - highlight strengths and potential issues
- Look for: unsupported claims, missing details, inconsistencies, novel contributions

Provide your analysis in the JSON format specified.`;

  return prompt;
}

// ============================================================================
// AI DOCUMENT ANNOTATOR SERVICE
// ============================================================================

export class AIDocumentAnnotator {
  private config: AIProviderConfig | null = null;

  configure(config: AIProviderConfig): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey;
  }

  async analyzeDocument(
    request: AIDocumentAnnotationRequest,
    includeDebug: boolean = false
  ): Promise<AIDocumentAnnotationResponse> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const userPrompt = buildPaperReviewPrompt(request);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: PAPER_REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: this.config.maxTokens || 4096,
        temperature: this.config.temperature || 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI');
    }

    // Build debug info if requested
    const debugInfo = includeDebug ? {
      systemPrompt: PAPER_REVIEW_SYSTEM_PROMPT,
      userPrompt: userPrompt,
      rawResponse: content,
    } : undefined;

    try {
      // Try direct JSON parse first
      const parsed = JSON.parse(content);
      return {
        sentences: parsed.sentences || [],
        figureTables: parsed.figureTables || [],
        pageSummary: parsed.pageSummary,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        debug: debugInfo,
      };
    } catch {
      // Try to extract JSON from markdown code blocks or partial response
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extracted = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(extracted);
          return {
            sentences: parsed.sentences || [],
            figureTables: parsed.figureTables || [],
            pageSummary: parsed.pageSummary,
            usage: data.usage ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            } : undefined,
            debug: debugInfo,
          };
        } catch {
          // Fall through to error
        }
      }
      console.error('Failed to parse AI response:', content.slice(0, 500));
      throw new Error('Failed to parse AI response - invalid JSON format');
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert sentences to AI-friendly format
 */
export function sentencesToAIFormat(sentences: Sentence[]): SentenceForAI[] {
  return sentences.map(s => ({
    id: s.id,
    text: s.text,
    pageNumber: s.pageNumber,
    section: s.section,
    position: {
      minX: s.bounds.minX,
      minY: s.bounds.minY,
      maxX: s.bounds.maxX,
      maxY: s.bounds.maxY,
    },
  }));
}

/**
 * Convert figures/tables to AI-friendly format
 */
export function figureTablesToAIFormat(figureTables: FigureTable[]): FigureTableForAI[] {
  return figureTables.map(ft => ({
    id: ft.id,
    type: ft.type,
    label: ft.label,
    caption: ft.caption,
    pageNumber: ft.pageNumber,
    position: {
      x: ft.boundingRect.x,
      y: ft.boundingRect.y,
      width: ft.boundingRect.width,
      height: ft.boundingRect.height,
    },
  }));
}

/**
 * Convert AI sentence analysis to SentenceAnnotation for the discussion panel
 */
export function aiAnalysisToSentenceAnnotation(
  analysis: AISentenceAnalysis
): Omit<SentenceAnnotation, 'id' | 'timestamp'> | null {
  // Only create annotation if there's a comment
  if (!analysis.comment) {
    return null;
  }

  return {
    sentenceId: analysis.sentenceId,
    text: analysis.comment,
    userName: 'AI Reviewer',
    color: getColorForSentenceLabel(analysis.label),
    replies: [],
    isAI: true,
    aiSentenceLabel: analysis.label,
    aiFlags: analysis.flags,
  };
}

/**
 * Convert AI figure/table analysis to FigureTableAnnotation
 */
export function aiAnalysisToFigureTableAnnotation(
  analysis: AIFigureTableAnalysis
): Omit<FigureTableAnnotation, 'id' | 'timestamp'> | null {
  if (!analysis.comment) {
    return null;
  }

  return {
    figureTableId: analysis.figureTableId,
    text: analysis.comment,
    userName: 'AI Reviewer',
    color: getColorForFigureTableLabel(analysis.label),
    replies: [],
    isAI: true,
    aiFigureTableLabel: analysis.label,
    aiFlags: analysis.flags,
  };
}

/**
 * Get color based on sentence label
 */
export function getColorForSentenceLabel(label: SentenceLabel): string {
  switch (label) {
    case 'background':
      return '#64748B'; // Slate
    case 'objective':
      return '#8B5CF6'; // Purple
    case 'method':
      return '#3B82F6'; // Blue
    case 'result':
      return '#10B981'; // Green
    case 'conclusion':
      return '#6366F1'; // Indigo
    case 'claim':
      return '#EF4444'; // Red
    case 'limitation':
      return '#F59E0B'; // Amber
    case 'definition':
      return '#06B6D4'; // Cyan
    case 'example':
      return '#EC4899'; // Pink
    case 'comparison':
      return '#14B8A6'; // Teal
    default:
      return '#6366F1'; // Indigo
  }
}

/**
 * Get color based on figure/table label
 */
export function getColorForFigureTableLabel(label: FigureTableLabel): string {
  switch (label) {
    case 'architecture':
      return '#3B82F6'; // Blue
    case 'results':
      return '#10B981'; // Green
    case 'comparison':
      return '#14B8A6'; // Teal
    case 'ablation':
      return '#F59E0B'; // Amber
    case 'example':
      return '#EC4899'; // Pink
    case 'methodology':
      return '#8B5CF6'; // Purple
    case 'data':
      return '#64748B'; // Slate
    default:
      return '#6366F1'; // Indigo
  }
}

/**
 * Get human-readable label name
 */
export function getSentenceLabelName(label: SentenceLabel): string {
  switch (label) {
    case 'background': return 'Background';
    case 'objective': return 'Objective';
    case 'method': return 'Method';
    case 'result': return 'Result';
    case 'conclusion': return 'Conclusion';
    case 'claim': return 'Claim';
    case 'limitation': return 'Limitation';
    case 'definition': return 'Definition';
    case 'example': return 'Example';
    case 'comparison': return 'Comparison';
    default: return label;
  }
}

/**
 * Get human-readable figure/table label name
 */
export function getFigureTableLabelName(label: FigureTableLabel): string {
  switch (label) {
    case 'architecture': return 'Architecture';
    case 'results': return 'Results';
    case 'comparison': return 'Comparison';
    case 'ablation': return 'Ablation';
    case 'example': return 'Example';
    case 'methodology': return 'Methodology';
    case 'data': return 'Data';
    default: return label;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const aiDocumentAnnotator = new AIDocumentAnnotator();
