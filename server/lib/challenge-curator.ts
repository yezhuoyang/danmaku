/**
 * AI Challenge Curator Module
 *
 * This module provides AI-powered analysis for promoting research ideas to challenge problems
 * and suggesting relationships between problems across papers.
 */

import OpenAI from 'openai';
import { ChallengeProblem, PromotionSuggestion, ChallengeProblemLink } from '../../shared/types';

// Dynamic import for Anthropic (optional dependency)
let Anthropic: any = null;
try {
  // @ts-ignore - optional dependency
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  // Anthropic SDK not installed, will fall back to OpenAI
}

interface ResearchIdea {
  id: string;
  title: string;
  description: string;
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'breakthrough' | 'moderate' | 'incremental';
  prerequisites?: string[];
}

interface AISession {
  id: string;
  paperId: string;
  paperTitle: string;
  researchIdeas: ResearchIdea[];
}

interface RelationshipSuggestion {
  targetProblemId: string;
  targetProblemTitle: string;
  relationship: 'extends' | 'contradicts' | 'builds_on' | 'supersedes' | 'related';
  confidence: number;
  reasoning: string;
}

/**
 * Analyze research ideas for potential promotion to challenge problems
 * using AI to evaluate novelty, importance, and uniqueness
 */
export async function analyzeIdeasForPromotion(
  ideas: ResearchIdea[],
  existingProblems: ChallengeProblem[],
  apiKey: string,
  provider: 'openai' | 'anthropic' = 'openai'
): Promise<PromotionSuggestion[]> {
  if (!ideas.length) return [];

  const existingTitles = existingProblems.map(p => p.title).join('\n- ');

  const prompt = `You are an expert research analyst evaluating research ideas for potential promotion to formal Challenge Problems.

EXISTING CHALLENGE PROBLEMS (avoid duplicates):
${existingTitles ? `- ${existingTitles}` : '(none yet)'}

RESEARCH IDEAS TO EVALUATE:
${ideas.map((idea, i) => `
[${i + 1}] Title: ${idea.title}
Description: ${idea.description}
Methodology: ${idea.methodology || 'Not specified'}
Expected Outcome: ${idea.expectedOutcome || 'Not specified'}
Feasibility: ${idea.feasibility || 'Unknown'}
Novelty: ${idea.novelty || 'Unknown'}
`).join('\n')}

For each idea, evaluate:
1. NOVELTY (0-1): How unique and innovative is this compared to existing problems?
2. IMPORTANCE (0-1): How significant would solving this problem be?
3. CLARITY (0-1): Is the problem well-defined enough to be actionable?
4. DUPLICATION (0-1): How different is this from existing challenge problems? (1 = completely unique)

Return a JSON array with scores and reasoning for each idea:
[
  {
    "ideaIndex": 0,
    "promotionScore": 0.85,
    "reasoning": "High novelty approach to X, clearly defined scope, not duplicated",
    "suggestPromotion": true
  }
]

Only include ideas with promotionScore >= 0.6 and suggestPromotion: true.
Return ONLY valid JSON, no other text.`;

  try {
    let response: string;

    if (provider === 'anthropic' && Anthropic) {
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '';
    } else {
      const openai = new OpenAI({ apiKey });
      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      response = result.choices[0]?.message?.content || '[]';
    }

    // Parse the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const evaluations = JSON.parse(jsonMatch[0]) as Array<{
      ideaIndex: number;
      promotionScore: number;
      reasoning: string;
      suggestPromotion: boolean;
    }>;

    // Convert to PromotionSuggestion format
    return evaluations
      .filter(e => e.suggestPromotion && e.promotionScore >= 0.6)
      .map(e => {
        const idea = ideas[e.ideaIndex];
        return {
          ideaId: idea.id,
          historyId: '', // Will be filled by caller
          paperId: '', // Will be filled by caller
          paperTitle: '', // Will be filled by caller
          title: idea.title,
          description: idea.description,
          score: e.promotionScore,
          reasoning: e.reasoning,
          suggestedRelationships: [],
        };
      });
  } catch (error) {
    console.error('AI analysis failed:', error);
    // Fallback to simple heuristic scoring
    return ideas
      .filter(idea => idea.novelty === 'breakthrough' || idea.novelty === 'moderate')
      .map(idea => ({
        ideaId: idea.id,
        historyId: '',
        paperId: '',
        paperTitle: '',
        title: idea.title,
        description: idea.description,
        score: idea.novelty === 'breakthrough' ? 0.8 : 0.6,
        reasoning: `${idea.novelty} novelty with ${idea.feasibility || 'unknown'} feasibility (heuristic)`,
        suggestedRelationships: [],
      }));
  }
}

/**
 * Suggest relationships between a new problem and existing problems
 * using AI to identify connections
 */
export async function suggestRelationships(
  newProblem: { title: string; description: string; paperId?: string },
  existingProblems: ChallengeProblem[],
  apiKey: string,
  provider: 'openai' | 'anthropic' = 'openai'
): Promise<RelationshipSuggestion[]> {
  if (!existingProblems.length) return [];

  const prompt = `You are an expert at analyzing research problems and their relationships.

NEW PROBLEM:
Title: ${newProblem.title}
Description: ${newProblem.description}
Paper ID: ${newProblem.paperId || 'Unknown'}

EXISTING PROBLEMS:
${existingProblems.slice(0, 20).map(p => `
[${p.id}] Title: ${p.title}
Description: ${p.description}
Area: ${p.area || 'Not specified'}
Status: ${p.status}
`).join('\n')}

Identify relationships between the NEW problem and existing problems.
Relationship types:
- extends: New problem builds on and extends an existing problem
- contradicts: New problem challenges or contradicts existing findings
- builds_on: New problem uses results from existing problem as foundation
- supersedes: New problem makes an existing problem obsolete
- related: Problems are related but don't fit other categories

Return a JSON array of relationships (max 5, only confident ones):
[
  {
    "targetProblemId": "existing-id-here",
    "targetProblemTitle": "Existing Problem Title",
    "relationship": "extends",
    "confidence": 0.85,
    "reasoning": "The new problem extends X by adding Y"
  }
]

Only include relationships with confidence >= 0.7.
Return ONLY valid JSON, no other text.`;

  try {
    let response: string;

    if (provider === 'anthropic' && Anthropic) {
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '';
    } else {
      const openai = new OpenAI({ apiKey });
      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      response = result.choices[0]?.message?.content || '[]';
    }

    // Parse the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const relationships = JSON.parse(jsonMatch[0]) as RelationshipSuggestion[];

    // Filter and validate
    return relationships
      .filter(r => r.confidence >= 0.7 && existingProblems.some(p => p.id === r.targetProblemId))
      .slice(0, 5);
  } catch (error) {
    console.error('AI relationship suggestion failed:', error);
    return [];
  }
}

/**
 * Run a batch curation job to analyze all ideas and organize problems
 */
export async function runCurationJob(
  sessions: AISession[],
  existingProblems: ChallengeProblem[],
  apiKey: string,
  provider: 'openai' | 'anthropic' = 'openai',
  onProgress?: (analyzed: number, total: number) => void
): Promise<{
  suggestions: PromotionSuggestion[];
  duplicateGroups: string[][];
  hierarchyUpdates: { problemId: string; suggestedParentId: string; confidence: number }[];
}> {
  const allIdeas: Array<ResearchIdea & { sessionId: string; paperId: string; paperTitle: string }> = [];

  // Flatten all ideas from sessions
  for (const session of sessions) {
    for (const idea of session.researchIdeas) {
      allIdeas.push({
        ...idea,
        sessionId: session.id,
        paperId: session.paperId,
        paperTitle: session.paperTitle,
      });
    }
  }

  const totalIdeas = allIdeas.length;
  let analyzed = 0;
  const suggestions: PromotionSuggestion[] = [];

  // Process in batches of 10
  const batchSize = 10;
  for (let i = 0; i < allIdeas.length; i += batchSize) {
    const batch = allIdeas.slice(i, i + batchSize);
    const batchIdeas = batch.map(({ sessionId, paperId, paperTitle, ...idea }) => idea);

    const batchSuggestions = await analyzeIdeasForPromotion(
      batchIdeas,
      existingProblems,
      apiKey,
      provider
    );

    // Enrich suggestions with session info
    for (const suggestion of batchSuggestions) {
      const originalIdea = batch.find(b => b.id === suggestion.ideaId);
      if (originalIdea) {
        suggestion.historyId = originalIdea.sessionId;
        suggestion.paperId = originalIdea.paperId;
        suggestion.paperTitle = originalIdea.paperTitle;
      }
    }

    suggestions.push(...batchSuggestions);
    analyzed += batch.length;
    onProgress?.(analyzed, totalIdeas);

    // Rate limiting delay
    if (i + batchSize < allIdeas.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Find duplicate groups (ideas that are very similar)
  const duplicateGroups = findDuplicateGroups(
    suggestions.map(s => ({ id: s.ideaId, title: s.title, description: s.description }))
  );

  // Suggest hierarchy updates based on existing problems
  const hierarchyUpdates = await suggestHierarchyUpdates(suggestions, existingProblems, apiKey, provider);

  return {
    suggestions,
    duplicateGroups,
    hierarchyUpdates,
  };
}

/**
 * Find groups of similar ideas using simple text similarity
 */
function findDuplicateGroups(ideas: { id: string; title: string; description: string }[]): string[][] {
  const groups: string[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < ideas.length; i++) {
    if (used.has(ideas[i].id)) continue;

    const group = [ideas[i].id];
    const titleWords = new Set(ideas[i].title.toLowerCase().split(/\s+/));

    for (let j = i + 1; j < ideas.length; j++) {
      if (used.has(ideas[j].id)) continue;

      const otherTitleWords = new Set(ideas[j].title.toLowerCase().split(/\s+/));
      const intersection = Array.from(titleWords).filter(w => otherTitleWords.has(w) && w.length > 3);
      const similarity = intersection.length / Math.min(titleWords.size, otherTitleWords.size);

      if (similarity > 0.5) {
        group.push(ideas[j].id);
        used.add(ideas[j].id);
      }
    }

    if (group.length > 1) {
      groups.push(group);
      used.add(ideas[i].id);
    }
  }

  return groups;
}

/**
 * Suggest parent-child relationships for hierarchical organization
 */
async function suggestHierarchyUpdates(
  suggestions: PromotionSuggestion[],
  existingProblems: ChallengeProblem[],
  apiKey: string,
  provider: 'openai' | 'anthropic'
): Promise<{ problemId: string; suggestedParentId: string; confidence: number }[]> {
  // Only suggest hierarchy if we have enough problems
  if (existingProblems.length < 3 || suggestions.length === 0) return [];

  const prompt = `You are analyzing research problems to suggest a hierarchical organization.

EXISTING PROBLEMS (potential parents):
${existingProblems.filter(p => !p.parentId).slice(0, 15).map(p => `
[${p.id}] ${p.title}
Area: ${p.area || 'General'}
`).join('\n')}

NEW PROBLEM SUGGESTIONS:
${suggestions.slice(0, 10).map((s, i) => `
[${i}] ${s.title}
Description: ${s.description}
`).join('\n')}

For each new problem, suggest if it should be a child of an existing problem.
Return JSON array:
[
  {
    "suggestionIndex": 0,
    "parentProblemId": "existing-id-here",
    "confidence": 0.8,
    "reasoning": "This is a specific instance of the broader problem X"
  }
]

Only include suggestions with confidence >= 0.7 where there's a clear parent-child relationship.
Return ONLY valid JSON.`;

  try {
    let response: string;

    if (provider === 'anthropic' && Anthropic) {
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '';
    } else {
      const openai = new OpenAI({ apiKey });
      const result = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      response = result.choices[0]?.message?.content || '[]';
    }

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const updates = JSON.parse(jsonMatch[0]) as Array<{
      suggestionIndex: number;
      parentProblemId: string;
      confidence: number;
    }>;

    return updates
      .filter(u => u.confidence >= 0.7 && existingProblems.some(p => p.id === u.parentProblemId))
      .map(u => ({
        problemId: suggestions[u.suggestionIndex]?.ideaId || '',
        suggestedParentId: u.parentProblemId,
        confidence: u.confidence,
      }))
      .filter(u => u.problemId);
  } catch (error) {
    console.error('AI hierarchy suggestion failed:', error);
    return [];
  }
}

export default {
  analyzeIdeasForPromotion,
  suggestRelationships,
  runCurationJob,
};
