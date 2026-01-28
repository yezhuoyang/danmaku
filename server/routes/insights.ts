import { Router, Request, Response } from 'express';
import db from '../db.js';
import { requireAuth } from './auth.js';
import type { OpenQuestion, ResearchIdea } from '../../shared/types.js';

const router = Router();

// Extended insight types with session/paper context
interface OpenQuestionWithContext extends OpenQuestion {
  sessionId: string;
  paperId?: string;
  paperTitle?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: number;
}

interface ResearchIdeaWithContext extends ResearchIdea {
  sessionId: string;
  paperId?: string;
  paperTitle?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: number;
}

// ============================================================================
// GET /api/insights/open-questions - List all open questions from AI sessions
// ============================================================================
router.get('/open-questions', (req: Request, res: Response) => {
  try {
    const {
      q,
      paperId,
      userId,
      importance,
      publicOnly = 'true',
      sort = 'recent',
      limit = '50',
      offset = '0',
    } = req.query;

    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    // Build WHERE clause
    let whereClause = 'WHERE h.open_questions IS NOT NULL AND h.open_questions != \'[]\'';
    const params: any[] = [];

    if (publicOnly === 'true') {
      whereClause += ' AND h.is_public = 1';
    }

    if (paperId) {
      whereClause += ' AND h.paper_id = ?';
      params.push(paperId);
    }

    if (userId) {
      whereClause += ' AND h.user_id = ?';
      params.push(userId);
    }

    // Get sessions with open questions
    let orderBy = 'ORDER BY h.updated_at DESC';
    if (sort === 'oldest') {
      orderBy = 'ORDER BY h.created_at ASC';
    }

    const query = `
      SELECT h.id as session_id, h.paper_id, h.user_id, h.open_questions, h.created_at, h.updated_at,
             p.title as paper_title,
             u.display_name as user_name, u.avatar as user_avatar
      FROM ai_agent_history h
      LEFT JOIN papers p ON h.paper_id = p.id
      LEFT JOIN users u ON h.user_id = u.id
      ${whereClause}
      ${orderBy}
    `;

    const sessions = db.prepare(query).all(...params) as any[];

    // Extract and flatten all open questions
    const allQuestions: OpenQuestionWithContext[] = [];

    for (const session of sessions) {
      try {
        const questions: OpenQuestion[] = JSON.parse(session.open_questions || '[]');
        for (const question of questions) {
          // Apply filters
          if (q && !question.question.toLowerCase().includes((q as string).toLowerCase())) {
            continue;
          }
          if (importance && question.importance !== importance) {
            continue;
          }

          allQuestions.push({
            ...question,
            sessionId: session.session_id,
            paperId: session.paper_id || undefined,
            paperTitle: session.paper_title || undefined,
            userId: session.user_id,
            userName: session.user_name,
            userAvatar: session.user_avatar || undefined,
            createdAt: session.updated_at || session.created_at,
          });
        }
      } catch (e) {
        console.warn('Failed to parse open_questions for session', session.session_id, e);
      }
    }

    // Sort by importance if requested
    if (sort === 'importance') {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      allQuestions.sort((a, b) => {
        return (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2);
      });
    }

    // Paginate
    const total = allQuestions.length;
    const paginatedQuestions = allQuestions.slice(offsetNum, offsetNum + limitNum);

    res.json({
      questions: paginatedQuestions,
      total,
    });
  } catch (error) {
    console.error('List open questions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list open questions' });
  }
});

// ============================================================================
// GET /api/insights/research-ideas - List all research ideas from AI sessions
// ============================================================================
router.get('/research-ideas', (req: Request, res: Response) => {
  try {
    const {
      q,
      paperId,
      userId,
      feasibility,
      novelty,
      publicOnly = 'true',
      sort = 'recent',
      limit = '50',
      offset = '0',
    } = req.query;

    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    // Build WHERE clause
    let whereClause = 'WHERE h.research_ideas IS NOT NULL AND h.research_ideas != \'[]\'';
    const params: any[] = [];

    if (publicOnly === 'true') {
      whereClause += ' AND h.is_public = 1';
    }

    if (paperId) {
      whereClause += ' AND h.paper_id = ?';
      params.push(paperId);
    }

    if (userId) {
      whereClause += ' AND h.user_id = ?';
      params.push(userId);
    }

    // Get sessions with research ideas
    let orderBy = 'ORDER BY h.updated_at DESC';
    if (sort === 'oldest') {
      orderBy = 'ORDER BY h.created_at ASC';
    }

    const query = `
      SELECT h.id as session_id, h.paper_id, h.user_id, h.research_ideas, h.created_at, h.updated_at,
             p.title as paper_title,
             u.display_name as user_name, u.avatar as user_avatar
      FROM ai_agent_history h
      LEFT JOIN papers p ON h.paper_id = p.id
      LEFT JOIN users u ON h.user_id = u.id
      ${whereClause}
      ${orderBy}
    `;

    const sessions = db.prepare(query).all(...params) as any[];

    // Extract and flatten all research ideas
    const allIdeas: ResearchIdeaWithContext[] = [];

    for (const session of sessions) {
      try {
        const ideas: ResearchIdea[] = JSON.parse(session.research_ideas || '[]');
        for (const idea of ideas) {
          // Apply filters
          if (q && !idea.title.toLowerCase().includes((q as string).toLowerCase()) &&
              !idea.description.toLowerCase().includes((q as string).toLowerCase())) {
            continue;
          }
          if (feasibility && idea.feasibility !== feasibility) {
            continue;
          }
          if (novelty && idea.novelty !== novelty) {
            continue;
          }

          allIdeas.push({
            ...idea,
            sessionId: session.session_id,
            paperId: session.paper_id || undefined,
            paperTitle: session.paper_title || undefined,
            userId: session.user_id,
            userName: session.user_name,
            userAvatar: session.user_avatar || undefined,
            createdAt: session.updated_at || session.created_at,
          });
        }
      } catch (e) {
        console.warn('Failed to parse research_ideas for session', session.session_id, e);
      }
    }

    // Sort by novelty if requested
    if (sort === 'novelty') {
      const noveltyOrder = { breakthrough: 0, moderate: 1, incremental: 2 };
      allIdeas.sort((a, b) => {
        return (noveltyOrder[a.novelty] || 2) - (noveltyOrder[b.novelty] || 2);
      });
    } else if (sort === 'feasibility') {
      const feasibilityOrder = { high: 0, medium: 1, low: 2 };
      allIdeas.sort((a, b) => {
        return (feasibilityOrder[a.feasibility] || 2) - (feasibilityOrder[b.feasibility] || 2);
      });
    }

    // Paginate
    const total = allIdeas.length;
    const paginatedIdeas = allIdeas.slice(offsetNum, offsetNum + limitNum);

    res.json({
      ideas: paginatedIdeas,
      total,
    });
  } catch (error) {
    console.error('List research ideas error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list research ideas' });
  }
});

// ============================================================================
// GET /api/insights/stats - Get statistics about insights
// ============================================================================
router.get('/stats', (req: Request, res: Response) => {
  try {
    // Get all sessions with open questions to count individual items
    const sessionsWithQuestions = db.prepare(`
      SELECT open_questions FROM ai_agent_history
      WHERE open_questions IS NOT NULL AND open_questions != '[]' AND is_public = 1
    `).all() as { open_questions: string }[];

    // Get all sessions with research ideas to count individual items
    const sessionsWithIdeas = db.prepare(`
      SELECT research_ideas FROM ai_agent_history
      WHERE research_ideas IS NOT NULL AND research_ideas != '[]' AND is_public = 1
    `).all() as { research_ideas: string }[];

    // Count total individual open questions
    let totalOpenQuestions = 0;
    for (const session of sessionsWithQuestions) {
      try {
        const questions = JSON.parse(session.open_questions);
        totalOpenQuestions += Array.isArray(questions) ? questions.length : 0;
      } catch (e) {}
    }

    // Count total individual research ideas
    let totalResearchIdeas = 0;
    for (const session of sessionsWithIdeas) {
      try {
        const ideas = JSON.parse(session.research_ideas);
        totalResearchIdeas += Array.isArray(ideas) ? ideas.length : 0;
      } catch (e) {}
    }

    // Count papers with insights
    const papersWithInsights = db.prepare(`
      SELECT COUNT(DISTINCT paper_id) as count FROM ai_agent_history
      WHERE (open_questions IS NOT NULL AND open_questions != '[]')
         OR (research_ideas IS NOT NULL AND research_ideas != '[]')
    `).get() as { count: number };

    // Count total challenge problems
    const challengeProblems = db.prepare(`
      SELECT COUNT(*) as count FROM challenge_problems
    `).get() as { count: number };

    // Count promoted ideas
    const promotedIdeas = db.prepare(`
      SELECT COUNT(*) as count FROM challenge_problems WHERE source_type = 'promoted'
    `).get() as { count: number };

    res.json({
      // Total individual counts (for display)
      totalOpenQuestions,
      totalResearchIdeas,
      // Session counts (for backwards compatibility)
      openQuestionSessions: sessionsWithQuestions.length,
      researchIdeaSessions: sessionsWithIdeas.length,
      papersWithInsights: papersWithInsights.count,
      totalChallengeProblems: challengeProblems.count,
      promotedIdeas: promotedIdeas.count,
    });
  } catch (error) {
    console.error('Get insights stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get stats' });
  }
});

// ============================================================================
// POST /api/insights/reorganize - AI analyzes insights and suggests git tree changes
// ============================================================================
router.post('/reorganize', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { apiKey, provider = 'openai', scope = 'all' } = req.body as {
      apiKey: string;
      provider?: 'openai' | 'anthropic';
      scope?: 'all' | 'new'; // 'new' = only analyze insights created in last 7 days
    };

    if (!apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'apiKey is required' });
    }

    // Get existing challenge problems (the research git tree)
    const existingProblems = db.prepare(`
      SELECT id, title, description, type, status, area, parent_id, depth
      FROM challenge_problems
      ORDER BY depth, created_at
      LIMIT 100
    `).all() as any[];

    // Get recent insights (open questions and research ideas)
    let insightsWhereClause = 'WHERE is_public = 1 AND (open_questions IS NOT NULL OR research_ideas IS NOT NULL)';
    if (scope === 'new') {
      insightsWhereClause += ' AND created_at > unixepoch() - 604800'; // Last 7 days
    }

    const recentSessions = db.prepare(`
      SELECT h.id, h.paper_id, h.open_questions, h.research_ideas, p.title as paper_title
      FROM ai_agent_history h
      LEFT JOIN papers p ON h.paper_id = p.id
      ${insightsWhereClause}
      ORDER BY h.created_at DESC
      LIMIT 50
    `).all() as any[];

    // Extract all insights
    const allInsights: Array<{
      sessionId: string;
      paperTitle?: string;
      type: 'open_question' | 'research_idea';
      ideaId: string;
      title: string;
      description: string;
    }> = [];

    for (const session of recentSessions) {
      if (session.open_questions) {
        try {
          const questions = JSON.parse(session.open_questions);
          for (const q of questions) {
            // Use existing ID or generate one based on the question text
            const qId = q.id || `oq-${Buffer.from(q.question || '').toString('base64').slice(0, 12)}`;
            allInsights.push({
              sessionId: session.id,
              paperTitle: session.paper_title,
              type: 'open_question',
              ideaId: qId,
              title: q.question,
              description: q.context || '',
            });
          }
        } catch (e) {}
      }
      if (session.research_ideas) {
        try {
          const ideas = JSON.parse(session.research_ideas);
          for (const idea of ideas) {
            // Use existing ID or generate one based on the title
            const iId = idea.id || `ri-${Buffer.from(idea.title || '').toString('base64').slice(0, 12)}`;
            allInsights.push({
              sessionId: session.id,
              paperTitle: session.paper_title,
              type: 'research_idea',
              ideaId: iId,
              title: idea.title,
              description: idea.description || '',
            });
          }
        } catch (e) {}
      }
    }

    if (allInsights.length === 0) {
      return res.json({
        suggestions: [],
        message: 'No new insights to analyze',
      });
    }

    // Build the AI prompt
    const prompt = `You are a research curator analyzing open research questions and ideas to suggest how to organize them into a research "git tree" structure.

EXISTING CHALLENGE PROBLEMS (Research Git Tree):
${existingProblems.length === 0 ? 'No existing problems yet - this will be the first organization.' : existingProblems.slice(0, 50).map(p => `
[${p.id}] ${p.title} (${p.type}, ${p.status})
  Area: ${p.area || 'General'}
  Parent: ${p.parent_id || 'ROOT'}
  Description: ${(p.description || '').slice(0, 200)}
`).join('')}

NEW INSIGHTS TO ORGANIZE (from recent paper readings):
${allInsights.slice(0, 30).map((i, idx) => `
[${idx}] ${i.type.toUpperCase()}: ${i.title}
  Paper: ${i.paperTitle || 'Unknown'}
  Context: ${(i.description || '').slice(0, 200)}
`).join('')}

Based on the existing tree structure and new insights, provide reorganization suggestions:

1. **Promotion suggestions**: Which insights should be promoted to Challenge Problems?
2. **Parent assignments**: Which existing problems should be parents for new ones?
3. **New branches**: Should any new top-level research areas be created?
4. **Merging/deduplication**: Are any insights duplicates of existing problems?
5. **Relationship suggestions**: What cross-paper relationships should be created?

Return a JSON object with this structure:
{
  "promotions": [
    {
      "insightIndex": 0,
      "suggestedTitle": "Better title if needed",
      "suggestedParentId": "existing-problem-id or null for top-level",
      "reasoning": "Why this should be promoted",
      "confidence": 0.85
    }
  ],
  "newBranches": [
    {
      "title": "New Research Area",
      "description": "Description of this area",
      "reasoning": "Why this branch is needed"
    }
  ],
  "duplicates": [
    {
      "insightIndex": 0,
      "existingProblemId": "id",
      "reasoning": "Why these are duplicates"
    }
  ],
  "relationships": [
    {
      "sourceInsightIndex": 0,
      "targetProblemId": "existing-id",
      "relationship": "extends|builds_on|related",
      "reasoning": "Why this relationship exists"
    }
  ],
  "summary": "Overall summary of suggested changes"
}

Only include high-confidence suggestions (>0.7). Return ONLY valid JSON.`;

    let response: string;

    if (provider === 'anthropic') {
      let Anthropic: any;
      try {
        Anthropic = require('@anthropic-ai/sdk').default;
      } catch {
        return res.status(400).json({ error: 'Bad Request', message: 'Anthropic SDK not available' });
      }
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '{}';
    } else {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
      response = result.choices[0]?.message?.content || '{}';
    }

    // Parse the response
    let suggestions;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      suggestions = { error: 'Failed to parse AI response', raw: response.slice(0, 500) };
    }

    // Enrich suggestions with actual insight data
    if (suggestions.promotions) {
      suggestions.promotions = suggestions.promotions.map((p: any) => ({
        ...p,
        insight: allInsights[p.insightIndex] || null,
      }));
    }

    res.json({
      suggestions,
      insightsAnalyzed: allInsights.length,
      existingProblemsCount: existingProblems.length,
    });
  } catch (error) {
    console.error('Reorganize insights error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reorganize insights' });
  }
});

// ============================================================================
// POST /api/insights/search-papers - Search papers via real APIs (Semantic Scholar, arXiv)
// then use AI to rank and filter results
// ============================================================================

// Helper: Search Semantic Scholar API
async function searchSemanticScholar(query: string, limit: number = 20): Promise<any[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=${limit}&fields=paperId,title,authors,year,abstract,url,externalIds,citationCount`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Semantic Scholar API error:', response.status);
      return [];
    }

    const data = await response.json();
    return (data.data || []).map((paper: any) => ({
      title: paper.title,
      authors: paper.authors?.map((a: any) => a.name).join(', ') || 'Unknown',
      year: paper.year,
      abstract: paper.abstract,
      url: paper.url,
      arxivId: paper.externalIds?.ArXiv,
      doi: paper.externalIds?.DOI,
      citationCount: paper.citationCount,
      source: 'Semantic Scholar',
      semanticScholarId: paper.paperId,
    }));
  } catch (error) {
    console.error('Semantic Scholar search error:', error);
    return [];
  }
}

// Helper: Search arXiv API
async function searchArxiv(query: string, limit: number = 20): Promise<any[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${limit}&sortBy=relevance`
    );

    if (!response.ok) {
      console.error('arXiv API error:', response.status);
      return [];
    }

    const xml = await response.text();
    const papers: any[] = [];

    // Simple XML parsing for arXiv response
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ');
      const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim().replace(/\s+/g, ' ');
      const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1];
      const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1];
      const arxivId = id?.match(/abs\/(.+)$/)?.[1];

      // Extract authors
      const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g);
      const authors = Array.from(authorMatches).map(m => m[1].trim());

      if (title && arxivId) {
        papers.push({
          title,
          authors: authors.join(', ') || 'Unknown',
          year: published ? new Date(published).getFullYear() : null,
          abstract: summary,
          url: `https://arxiv.org/abs/${arxivId}`,
          arxivId,
          source: 'arXiv',
        });
      }
    }

    return papers;
  } catch (error) {
    console.error('arXiv search error:', error);
    return [];
  }
}

router.post('/search-papers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { question, context, apiKey, provider = 'openai', customPrompt } = req.body as {
      question: string;
      context?: string;
      apiKey: string;
      provider?: 'openai' | 'anthropic';
      customPrompt?: string;
    };

    if (!question || !apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'question and apiKey are required' });
    }

    // Step 1: Search real APIs for papers
    console.log('Searching Semantic Scholar and arXiv for:', question);

    const [semanticResults, arxivResults] = await Promise.all([
      searchSemanticScholar(question, 15),
      searchArxiv(question, 15),
    ]);

    // Combine and deduplicate results
    const allPapers: any[] = [];
    const seenTitles = new Set<string>();

    for (const paper of [...semanticResults, ...arxivResults]) {
      const normalizedTitle = paper.title?.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedTitle && !seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        allPapers.push(paper);
      }
    }

    console.log(`Found ${allPapers.length} unique papers from APIs`);

    if (allPapers.length === 0) {
      return res.json({
        papers: [],
        searchSummary: 'No papers found from Semantic Scholar or arXiv APIs.',
        question,
        promptUsed: '',
      });
    }

    // Step 2: Use AI to rank and filter papers by relevance
    const defaultPrompt = `You are a research assistant helping rank academic papers by relevance to a research question.

RESEARCH QUESTION:
${question}

${context ? `ADDITIONAL CONTEXT:\n${context}\n` : ''}

PAPERS FOUND (from Semantic Scholar and arXiv APIs):
${allPapers.slice(0, 20).map((p, i) => `
[${i + 1}] "${p.title}"
Authors: ${p.authors}
Year: ${p.year || 'Unknown'}
Abstract: ${p.abstract?.slice(0, 300) || 'No abstract'}...
`).join('\n')}

For each paper, provide a relevance score (0.0 to 1.0) and a brief explanation of why it's relevant or not relevant to the research question.

Return a JSON object with this structure:
{
  "rankings": [
    { "index": 1, "relevanceScore": 0.95, "explanation": "Directly addresses the research question by..." },
    { "index": 2, "relevanceScore": 0.7, "explanation": "Provides related background on..." }
  ],
  "searchSummary": "Summary of the most relevant findings"
}

Only include papers with relevanceScore >= 0.5. Sort by relevance score descending.
Return ONLY valid JSON, no other text.`;

    const rankingPrompt = customPrompt || defaultPrompt;

    let response: string;

    if (provider === 'anthropic') {
      let Anthropic: any;
      try {
        Anthropic = require('@anthropic-ai/sdk').default;
      } catch {
        return res.status(400).json({ error: 'Bad Request', message: 'Anthropic SDK not available' });
      }
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: rankingPrompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '{}';
    } else {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey });
      const result = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: rankingPrompt }],
        response_format: { type: 'json_object' },
      });
      response = result.choices[0]?.message?.content || '{}';
    }

    // Parse the AI ranking response
    let rankingResults;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      rankingResults = jsonMatch ? JSON.parse(jsonMatch[0]) : { rankings: [] };
    } catch (e) {
      console.error('Failed to parse AI ranking response:', e);
      rankingResults = { rankings: [], error: 'Failed to parse AI response' };
    }

    // Combine API results with AI rankings
    const rankedPapers: any[] = [];
    if (rankingResults.rankings && Array.isArray(rankingResults.rankings)) {
      for (const ranking of rankingResults.rankings) {
        const paperIndex = ranking.index - 1; // 1-indexed to 0-indexed
        if (paperIndex >= 0 && paperIndex < allPapers.length) {
          const paper = allPapers[paperIndex];
          rankedPapers.push({
            ...paper,
            relevanceScore: ranking.relevanceScore,
            relevance: ranking.explanation,
          });
        }
      }
    }

    // Sort by relevance score
    rankedPapers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Check if papers already exist in the platform
    for (const paper of rankedPapers) {
      if (paper.arxivId) {
        const existing = db.prepare(
          `SELECT id, title FROM papers WHERE arxiv_id = ?`
        ).get(paper.arxivId) as any;
        paper.existsInLibrary = !!existing;
        paper.paperId = existing?.id;
      } else {
        // Try to match by title
        const existing = db.prepare(
          `SELECT id, title FROM papers WHERE title LIKE ?`
        ).get(`%${paper.title?.slice(0, 50)}%`) as any;
        paper.existsInLibrary = !!existing;
        paper.paperId = existing?.id;
      }
    }

    res.json({
      papers: rankedPapers.slice(0, 10),
      searchSummary: rankingResults.searchSummary || `Found ${rankedPapers.length} relevant papers from Semantic Scholar and arXiv.`,
      question,
      promptUsed: rankingPrompt,
      apiSources: ['Semantic Scholar', 'arXiv'],
      totalFound: allPapers.length,
    });
  } catch (error) {
    console.error('Search papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to search for papers' });
  }
});

export default router;
