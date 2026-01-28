import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth } from './auth.js';
import type {
  ChallengeProblem,
  ChallengeComment,
  ChallengeIdeaLink,
  ChallengeProblemLink,
  ChallengeCurationJob,
  PromotionSuggestion,
  CreateChallengeProblemRequest,
  UpdateChallengeProblemRequest,
  LinkIdeaToQuestionRequest,
  CreateChallengeCommentRequest,
  CreateChallengeProblemLinkRequest,
  PromoteIdeaRequest,
  TriggerCurationRequest,
  ChallengeProblemStatus,
  CrossPaperRelationship,
  CurationJobStatus,
} from '../../shared/types.js';

const router = Router();

// Helper: Convert DB row to ChallengeProblem
function dbRowToChallengeProblem(row: any, user?: any): ChallengeProblem {
  return {
    id: row.id,
    paperId: row.paper_id || undefined,
    paperTitle: row.paper_title || undefined,
    historyId: row.history_id || undefined,
    userId: row.user_id,
    userName: row.user_name || row.display_name,
    userAvatar: row.user_avatar || row.avatar || undefined,
    parentId: row.parent_id || undefined,
    rootId: row.root_id || undefined,
    depth: row.depth || 0,
    orderIndex: row.order_index || 0,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description || undefined,
    context: row.context || undefined,
    methodology: row.methodology || undefined,
    expectedOutcome: row.expected_outcome || undefined,
    feasibility: row.feasibility || undefined,
    novelty: row.novelty || undefined,
    prerequisites: row.prerequisites ? JSON.parse(row.prerequisites) : undefined,
    importance: row.importance || undefined,
    area: row.area || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    solvedBy: row.solved_by || undefined,
    solvedByName: row.solved_by_name || undefined,
    solvedAt: row.solved_at || undefined,
    solutionSummary: row.solution_summary || undefined,
    upvotes: row.upvotes || 0,
    downvotes: row.downvotes || 0,
    commentCount: row.comment_count || 0,
    childCount: row.child_count || 0,
    linkedIdeaCount: row.linked_idea_count || 0,
    // AI-managed fields
    sourceHistoryId: row.source_history_id || undefined,
    sourceType: row.source_type || 'manual',
    aiSuggested: row.ai_suggested === 1,
    promotionScore: row.promotion_score || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: Convert DB row to ChallengeProblemLink
function dbRowToChallengeProblemLink(row: any): ChallengeProblemLink {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    relationship: row.relationship as CrossPaperRelationship,
    confidence: row.confidence || 1.0,
    aiGenerated: row.ai_generated === 1,
    userId: row.user_id || undefined,
    userName: row.user_name || row.display_name || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

// Helper: Convert DB row to ChallengeCurationJob
function dbRowToCurationJob(row: any): ChallengeCurationJob {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || row.display_name || undefined,
    status: row.status as CurationJobStatus,
    scope: row.scope || undefined,
    results: row.results ? JSON.parse(row.results) : undefined,
    ideasAnalyzed: row.ideas_analyzed || 0,
    suggestionsMade: row.suggestions_made || 0,
    errorMessage: row.error_message || undefined,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
    createdAt: row.created_at,
  };
}

// Helper: Convert DB row to ChallengeComment
function dbRowToChallengeComment(row: any): ChallengeComment {
  return {
    id: row.id,
    problemId: row.problem_id,
    userId: row.user_id,
    userName: row.user_name || row.display_name,
    userAvatar: row.user_avatar || row.avatar || undefined,
    parentId: row.parent_id || undefined,
    content: row.content,
    upvotes: row.upvotes || 0,
    downvotes: row.downvotes || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: Build tree structure from flat list
function buildTree(problems: ChallengeProblem[], rootId?: string): ChallengeProblem[] {
  const map = new Map<string, ChallengeProblem>();
  const roots: ChallengeProblem[] = [];

  // First pass: create map
  problems.forEach(p => {
    map.set(p.id, { ...p, children: [] });
  });

  // Second pass: build tree
  problems.forEach(p => {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      const parent = map.get(p.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else if (!p.parentId || p.id === rootId) {
      roots.push(node);
    }
  });

  // Sort children by orderIndex
  const sortChildren = (node: ChallengeProblem) => {
    if (node.children && node.children.length > 0) {
      node.children.sort((a, b) => a.orderIndex - b.orderIndex);
      node.children.forEach(sortChildren);
    }
  };
  roots.forEach(sortChildren);

  return roots;
}

// ============================================================================
// GET /api/challenges/areas - Get distinct areas (must come before /:id)
// ============================================================================
router.get('/areas', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT area FROM challenge_problems WHERE area IS NOT NULL ORDER BY area
    `).all() as any[];

    res.json({ areas: rows.map(r => r.area) });
  } catch (error) {
    console.error('Get areas error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get areas' });
  }
});

// ============================================================================
// GET /api/challenges - List/search challenge problems
// ============================================================================
router.get('/', (req: Request, res: Response) => {
  try {
    const {
      q,
      type,
      status,
      area,
      paperId,
      userId,
      rootOnly = 'true',
      parentId,
      sort = 'recent',
      limit = '20',
      offset = '0',
    } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Filter by root only (default) or by parent
    if (parentId) {
      whereClause += ' AND cp.parent_id = ?';
      params.push(parentId);
    } else if (rootOnly === 'true') {
      whereClause += ' AND cp.parent_id IS NULL';
    }

    // Search query
    if (q) {
      whereClause += ' AND (cp.title LIKE ? OR cp.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    // Filter by type
    if (type && (type === 'open_question' || type === 'research_idea')) {
      whereClause += ' AND cp.type = ?';
      params.push(type);
    }

    // Filter by status
    if (status && ['unsolved', 'investigating', 'solved'].includes(status as string)) {
      whereClause += ' AND cp.status = ?';
      params.push(status);
    }

    // Filter by area
    if (area) {
      whereClause += ' AND cp.area = ?';
      params.push(area);
    }

    // Filter by paper
    if (paperId) {
      whereClause += ' AND cp.paper_id = ?';
      params.push(paperId);
    }

    // Filter by author
    if (userId) {
      whereClause += ' AND cp.user_id = ?';
      params.push(userId);
    }

    // Sort order
    let orderBy = 'ORDER BY cp.created_at DESC';
    if (sort === 'popular') {
      orderBy = 'ORDER BY (cp.upvotes - cp.downvotes) DESC, cp.created_at DESC';
    } else if (sort === 'discussed') {
      orderBy = 'ORDER BY cp.comment_count DESC, cp.created_at DESC';
    } else if (sort === 'tree_progress') {
      orderBy = 'ORDER BY cp.child_count DESC, cp.created_at DESC';
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM challenge_problems cp
      ${whereClause}
    `;
    const { total } = db.prepare(countQuery).get(...params) as { total: number };

    // Get problems with user info
    const query = `
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar,
             p.title as paper_title,
             solver.display_name as solved_by_name
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      LEFT JOIN users solver ON cp.solved_by = solver.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offsetNum);

    const rows = db.prepare(query).all(...params) as any[];
    const problems = rows.map(row => dbRowToChallengeProblem(row));

    res.json({ problems, total });
  } catch (error) {
    console.error('List challenges error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list challenges' });
  }
});

// ============================================================================
// STATIC ROUTES (must come before /:id routes)
// ============================================================================

// GET /api/challenges/suggest-promotions - Get AI suggestions for promoting ideas
router.get('/suggest-promotions', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId, limit = 10 } = req.query;

    // Get user's AI sessions with research ideas
    let sessionsQuery = `
      SELECT h.*, p.title as paper_title
      FROM ai_agent_history h
      LEFT JOIN papers p ON h.paper_id = p.id
      WHERE h.user_id = ? AND h.research_ideas IS NOT NULL AND h.research_ideas != '[]'
    `;
    const params: any[] = [user.id];

    if (paperId) {
      sessionsQuery += ' AND h.paper_id = ?';
      params.push(paperId);
    }
    if (historyId) {
      sessionsQuery += ' AND h.id = ?';
      params.push(historyId);
    }

    sessionsQuery += ' ORDER BY h.created_at DESC LIMIT 20';

    const sessions = db.prepare(sessionsQuery).all(...params) as any[];

    // Get existing challenge problems for deduplication
    const existingProblems = db.prepare(`
      SELECT id, title, source_history_id FROM challenge_problems
    `).all() as any[];

    const existingTitles = new Set(existingProblems.map(p => p.title.toLowerCase()));

    // Collect suggestions
    const suggestions: PromotionSuggestion[] = [];

    for (const session of sessions) {
      const ideas = session.research_ideas ? JSON.parse(session.research_ideas) : [];

      for (const idea of ideas) {
        // Skip if already promoted or similar title exists
        if (existingTitles.has(idea.title?.toLowerCase())) continue;

        // Simple scoring based on idea properties
        let score = 0.5; // Base score
        if (idea.novelty === 'breakthrough') score += 0.3;
        else if (idea.novelty === 'moderate') score += 0.15;
        if (idea.feasibility === 'high') score += 0.1;
        if (idea.methodology) score += 0.05;
        if (idea.expectedOutcome) score += 0.05;

        suggestions.push({
          ideaId: idea.id,
          historyId: session.id,
          paperId: session.paper_id,
          paperTitle: session.paper_title || 'Unknown Paper',
          title: idea.title,
          description: idea.description,
          score: Math.min(score, 1),
          reasoning: `${idea.novelty || 'Unknown'} novelty with ${idea.feasibility || 'unknown'} feasibility`,
          suggestedRelationships: [],
        });
      }
    }

    // Sort by score and limit
    suggestions.sort((a, b) => b.score - a.score);
    const limitedSuggestions = suggestions.slice(0, parseInt(limit as string));

    res.json({
      suggestions: limitedSuggestions,
      existingProblemsCount: existingProblems.length,
    });
  } catch (error) {
    console.error('Suggest promotions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get promotion suggestions' });
  }
});

// POST /api/challenges/suggest-parent - Suggest parent problems for a new challenge using AI
router.post('/suggest-parent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, apiKey, provider = 'openai', customPrompt, candidateIds } = req.body as {
      title: string;
      description: string;
      apiKey: string;
      provider?: 'openai' | 'anthropic';
      customPrompt?: string;
      candidateIds?: string[];
    };

    if (!title || !apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'title and apiKey are required' });
    }

    // Get existing challenge problems (potential parents)
    // If candidateIds are provided, only look at those; otherwise look at all top-level problems
    let existingProblems: any[];
    if (candidateIds && candidateIds.length > 0) {
      const placeholders = candidateIds.map(() => '?').join(',');
      existingProblems = db.prepare(`
        SELECT id, title, description, type, status, area
        FROM challenge_problems
        WHERE id IN (${placeholders})
        ORDER BY upvotes DESC, created_at DESC
      `).all(...candidateIds) as any[];
    } else {
      existingProblems = db.prepare(`
        SELECT id, title, description, type, status, area
        FROM challenge_problems
        WHERE parent_id IS NULL
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `).all() as any[];
    }

    if (existingProblems.length === 0) {
      return res.json({ suggestions: [] });
    }

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt || `You are analyzing research problems to suggest which existing problem should be the parent of a new problem.

NEW PROBLEM TO ADD:
Title: ${title}
Description: ${description || 'Not provided'}

EXISTING TOP-LEVEL PROBLEMS (potential parents):
${existingProblems.slice(0, 30).map((p, i) => `
[${p.id}] ${p.title}
Type: ${p.type}, Status: ${p.status}
Area: ${p.area || 'General'}
Description: ${p.description || 'No description'}
`).join('\n')}

Analyze which existing problems could be suitable parents for the new problem.
A good parent is a broader, more general problem that the new problem is a specific instance or sub-question of.

Return a JSON array of suggested parents (max 3, only confident ones):
[
  {
    "id": "existing-problem-id",
    "title": "Existing Problem Title",
    "confidence": 0.85,
    "reasoning": "Why this is a good parent"
  }
]

Only include suggestions with confidence >= 0.6.
If no existing problem is a good parent, return an empty array [].
Return ONLY valid JSON, no other text.`;

    let response: string;

    if (provider === 'anthropic') {
      // Dynamic import for Anthropic
      let Anthropic: any;
      try {
        Anthropic = require('@anthropic-ai/sdk').default;
      } catch {
        return res.status(400).json({ error: 'Bad Request', message: 'Anthropic SDK not available' });
      }
      const anthropic = new Anthropic({ apiKey });
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      response = result.content[0].type === 'text' ? result.content[0].text : '[]';
    } else {
      const OpenAI = (await import('openai')).default;
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
    if (!jsonMatch) {
      return res.json({ suggestions: [] });
    }

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      title: string;
      confidence: number;
      reasoning: string;
    }>;

    // Validate and enrich suggestions
    const validatedSuggestions = suggestions
      .filter(s => s.confidence >= 0.6 && existingProblems.some(p => p.id === s.id))
      .slice(0, 3)
      .map(s => {
        const problem = existingProblems.find(p => p.id === s.id);
        return {
          id: s.id,
          title: problem?.title || s.title,
          confidence: s.confidence,
          reasoning: s.reasoning,
        };
      });

    res.json({ suggestions: validatedSuggestions });
  } catch (error) {
    console.error('Suggest parent error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to suggest parent problems' });
  }
});

// POST /api/challenges/promote - Promote a research idea to challenge problem
router.post('/promote', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { historyId, ideaId, title, description, area, tags, relationships, parentId, type } = req.body as PromoteIdeaRequest;

    if (!historyId || !ideaId) {
      return res.status(400).json({ error: 'Bad Request', message: 'historyId and ideaId are required' });
    }

    // Get the AI session to find the research idea
    const session = db.prepare(`
      SELECT h.*, p.title as paper_title, p.id as paper_id
      FROM ai_agent_history h
      LEFT JOIN papers p ON h.paper_id = p.id
      WHERE h.id = ? AND h.user_id = ?
    `).get(historyId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found or not owned by you' });
    }

    // Parse both research ideas and open questions from session
    const researchIdeas = session.research_ideas ? JSON.parse(session.research_ideas) : [];
    const openQuestions = session.open_questions ? JSON.parse(session.open_questions) : [];

    // Helper to generate the same ID format used in reorganize endpoint
    const generateIdeaId = (text: string, prefix: string) =>
      `${prefix}-${Buffer.from(text || '').toString('base64').slice(0, 12)}`;

    // Try to find in research ideas first, then open questions
    // 1. First try exact ID match
    // 2. Then try matching by generated ID pattern (for ideas without stored IDs)
    // 3. Finally try title match as fallback
    let idea = researchIdeas.find((i: any) => i.id === ideaId);
    let isOpenQuestion = false;

    if (!idea) {
      idea = openQuestions.find((q: any) => q.id === ideaId);
      if (idea) isOpenQuestion = true;
    }

    // Try matching by generated ID pattern
    if (!idea && ideaId.startsWith('ri-')) {
      idea = researchIdeas.find((i: any) => generateIdeaId(i.title, 'ri') === ideaId);
    }
    if (!idea && ideaId.startsWith('oq-')) {
      idea = openQuestions.find((q: any) => generateIdeaId(q.question, 'oq') === ideaId);
      if (idea) isOpenQuestion = true;
    }

    // Last resort: try to find by title from the request
    if (!idea && title) {
      idea = researchIdeas.find((i: any) => i.title === title);
      if (!idea) {
        idea = openQuestions.find((q: any) => q.question === title);
        if (idea) isOpenQuestion = true;
      }
    }

    if (!idea) {
      return res.status(404).json({ error: 'Not Found', message: 'Idea/question not found in session' });
    }

    // Check for duplicates (same title from same session)
    const existing = db.prepare(`
      SELECT id FROM challenge_problems
      WHERE source_history_id = ? AND title = ?
    `).get(historyId, title || idea.title);

    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'This idea has already been promoted' });
    }

    // If parentId provided, calculate depth and root_id
    let depth = 0;
    let rootId: string | null = null;

    if (parentId) {
      const parentRow = db.prepare('SELECT id, root_id, depth FROM challenge_problems WHERE id = ?').get(parentId) as any;
      if (parentRow) {
        depth = (parentRow.depth || 0) + 1;
        rootId = parentRow.root_id || parentRow.id;
      }
    }

    // Determine the problem type based on source or explicit type
    const problemType = type || (isOpenQuestion ? 'open_question' : 'research_idea');

    // Extract fields based on whether it's an open question or research idea
    const finalTitle = title || (isOpenQuestion ? idea.question : idea.title);
    const finalDescription = description || (isOpenQuestion ? idea.context : idea.description);
    const finalTags = tags || (isOpenQuestion && idea.relatedTopics ? idea.relatedTopics : []);

    // Create the challenge problem
    const problemId = uuidv4();
    db.prepare(`
      INSERT INTO challenge_problems (
        id, paper_id, history_id, user_id, parent_id, root_id, depth,
        type, status, title, description, context,
        methodology, expected_outcome, feasibility, novelty, prerequisites,
        area, tags, source_history_id, source_type, ai_suggested
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      problemId,
      session.paper_id || null,
      historyId,
      user.id,
      parentId || null,
      rootId,
      depth,
      problemType,
      'unsolved',
      finalTitle,
      finalDescription,
      `From paper: ${session.paper_title || 'Unknown'}`,
      isOpenQuestion ? null : (idea.methodology || null),
      isOpenQuestion ? null : (idea.expectedOutcome || null),
      isOpenQuestion ? (idea.importance || null) : (idea.feasibility || null),
      isOpenQuestion ? null : (idea.novelty || null),
      !isOpenQuestion && idea.prerequisites ? JSON.stringify(idea.prerequisites) : null,
      area || null,
      Array.isArray(finalTags) ? JSON.stringify(finalTags) : '[]',
      historyId,
      'promoted',
      0
    );

    // Create cross-paper links if provided
    if (relationships && relationships.length > 0) {
      for (const rel of relationships) {
        const linkId = uuidv4();
        try {
          db.prepare(`
            INSERT INTO challenge_problem_links (id, source_id, target_id, relationship, user_id, ai_generated)
            VALUES (?, ?, ?, ?, ?, 0)
          `).run(linkId, problemId, rel.targetId, rel.relationship, user.id);
        } catch (e) {
          console.warn('Failed to create link:', e);
        }
      }
    }

    // Fetch the created problem
    const createdRow = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar, p.title as paper_title
      FROM challenge_problems cp
      LEFT JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      WHERE cp.id = ?
    `).get(problemId) as any;

    res.status(201).json({ problem: dbRowToChallengeProblem(createdRow) });
  } catch (error) {
    console.error('Promote idea error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to promote idea' });
  }
});

// POST /api/challenges/curate - Trigger an AI curation job
router.post('/curate', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { scope = 'all' } = req.body as TriggerCurationRequest;

    // Check if there's already a running job for this user
    const runningJob = db.prepare(`
      SELECT id FROM challenge_curation_jobs
      WHERE user_id = ? AND status IN ('pending', 'running')
    `).get(user.id);

    if (runningJob) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'You already have a curation job in progress'
      });
    }

    const jobId = uuidv4();
    db.prepare(`
      INSERT INTO challenge_curation_jobs (id, user_id, status, scope)
      VALUES (?, ?, 'pending', ?)
    `).run(jobId, user.id, scope);

    const job = db.prepare(`
      SELECT j.*, u.display_name as user_name
      FROM challenge_curation_jobs j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.id = ?
    `).get(jobId) as any;

    res.status(201).json({ job: dbRowToCurationJob(job) });
  } catch (error) {
    console.error('Create curation job error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create curation job' });
  }
});

// GET /api/challenges/curate - List user's curation jobs
router.get('/curate', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { limit = 10, offset = 0 } = req.query;

    const jobs = db.prepare(`
      SELECT j.*, u.display_name as user_name
      FROM challenge_curation_jobs j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.user_id = ?
      ORDER BY j.created_at DESC
      LIMIT ? OFFSET ?
    `).all(user.id, parseInt(limit as string), parseInt(offset as string)) as any[];

    res.json({ jobs: jobs.map(dbRowToCurationJob) });
  } catch (error) {
    console.error('List curation jobs error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list curation jobs' });
  }
});

// GET /api/challenges/curate/:jobId - Get curation job status
router.get('/curate/:jobId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { jobId } = req.params;

    const job = db.prepare(`
      SELECT j.*, u.display_name as user_name
      FROM challenge_curation_jobs j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.id = ?
    `).get(jobId) as any;

    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Curation job not found' });
    }

    if (job.user_id !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
    }

    res.json({ job: dbRowToCurationJob(job) });
  } catch (error) {
    console.error('Get curation job error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get curation job' });
  }
});

// ============================================================================
// GET /api/challenges/:id - Get single problem with full details
// ============================================================================
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get the main problem
    const row = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar,
             p.title as paper_title,
             solver.display_name as solved_by_name
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      LEFT JOIN users solver ON cp.solved_by = solver.id
      WHERE cp.id = ?
    `).get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }

    const problem = dbRowToChallengeProblem(row);

    // Get the full progress tree (all descendants)
    const rootId = problem.rootId || problem.id;
    const treeRows = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar,
             p.title as paper_title,
             solver.display_name as solved_by_name
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      LEFT JOIN users solver ON cp.solved_by = solver.id
      WHERE cp.root_id = ? OR cp.id = ?
      ORDER BY cp.depth, cp.order_index
    `).all(rootId, rootId) as any[];

    const allProblems = treeRows.map(r => dbRowToChallengeProblem(r));
    const progressTree = buildTree(allProblems, rootId);

    // Get linked ideas for this problem
    const linkRows = db.prepare(`
      SELECT l.*, u.display_name as user_name,
             idea.id as idea_id, idea.title as idea_title, idea.description as idea_description,
             idea.methodology, idea.expected_outcome, idea.feasibility, idea.novelty,
             idea.status as idea_status, idea.user_id as idea_user_id,
             idea_user.display_name as idea_user_name, idea_user.avatar as idea_user_avatar
      FROM challenge_idea_links l
      JOIN users u ON l.user_id = u.id
      JOIN challenge_problems idea ON l.idea_id = idea.id
      JOIN users idea_user ON idea.user_id = idea_user.id
      WHERE l.question_id = ?
      ORDER BY l.created_at DESC
    `).all(id) as any[];

    const linkedIdeas: ChallengeIdeaLink[] = linkRows.map(l => ({
      id: l.id,
      questionId: l.question_id,
      ideaId: l.idea_id,
      idea: {
        id: l.idea_id,
        userId: l.idea_user_id,
        userName: l.idea_user_name,
        userAvatar: l.idea_user_avatar || undefined,
        type: 'research_idea' as const,
        status: l.idea_status,
        title: l.idea_title,
        description: l.idea_description || undefined,
        methodology: l.methodology || undefined,
        expectedOutcome: l.expected_outcome || undefined,
        feasibility: l.feasibility || undefined,
        novelty: l.novelty || undefined,
        depth: 0,
        orderIndex: 0,
        tags: [],
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
        childCount: 0,
        linkedIdeaCount: 0,
        sourceType: 'manual' as const,
        aiSuggested: false,
        createdAt: 0,
        updatedAt: 0,
      },
      userId: l.user_id,
      userName: l.user_name,
      relationship: l.relationship,
      notes: l.notes || undefined,
      createdAt: l.created_at,
    }));

    problem.linkedIdeas = linkedIdeas;

    // Get comments
    const commentRows = db.prepare(`
      SELECT c.*, u.display_name as user_name, u.avatar as user_avatar
      FROM challenge_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.problem_id = ?
      ORDER BY c.created_at ASC
    `).all(id) as any[];

    const comments = commentRows.map(c => dbRowToChallengeComment(c));

    // Build comment tree (nested replies)
    const commentMap = new Map<string, ChallengeComment>();
    const rootComments: ChallengeComment[] = [];

    comments.forEach(c => {
      commentMap.set(c.id, { ...c, replies: [] });
    });

    comments.forEach(c => {
      const node = commentMap.get(c.id)!;
      if (c.parentId && commentMap.has(c.parentId)) {
        const parent = commentMap.get(c.parentId)!;
        if (!parent.replies) parent.replies = [];
        parent.replies.push(node);
      } else {
        rootComments.push(node);
      }
    });

    res.json({
      problem,
      comments: rootComments,
      progressTree: progressTree.length > 0 ? progressTree : [problem],
    });
  } catch (error) {
    console.error('Get challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get challenge' });
  }
});

// ============================================================================
// POST /api/challenges - Create new problem
// ============================================================================
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body = req.body as CreateChallengeProblemRequest;

    if (!body.title || !body.type) {
      return res.status(400).json({ error: 'Bad Request', message: 'Title and type are required' });
    }

    if (!['open_question', 'research_idea'].includes(body.type)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid type' });
    }

    const id = uuidv4();
    let depth = 0;
    let rootId: string | null = null;
    let orderIndex = 0;

    // If parentId provided, this is a sub-question
    if (body.parentId) {
      const parent = db.prepare('SELECT id, depth, root_id FROM challenge_problems WHERE id = ?')
        .get(body.parentId) as any;

      if (!parent) {
        return res.status(404).json({ error: 'Not Found', message: 'Parent problem not found' });
      }

      depth = parent.depth + 1;
      rootId = parent.root_id || parent.id;

      // Get next order index
      const maxOrder = db.prepare(`
        SELECT MAX(order_index) as max_order FROM challenge_problems WHERE parent_id = ?
      `).get(body.parentId) as any;
      orderIndex = (maxOrder?.max_order ?? -1) + 1;

      // Increment parent's child count
      db.prepare('UPDATE challenge_problems SET child_count = child_count + 1, updated_at = unixepoch() WHERE id = ?')
        .run(body.parentId);
    }

    db.prepare(`
      INSERT INTO challenge_problems (
        id, paper_id, history_id, user_id, parent_id, root_id, depth, order_index,
        type, title, description, context,
        methodology, expected_outcome, feasibility, novelty, prerequisites,
        importance, area, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.paperId || null,
      body.historyId || null,
      user.id,
      body.parentId || null,
      rootId,
      depth,
      orderIndex,
      body.type,
      body.title,
      body.description || null,
      body.context || null,
      body.methodology || null,
      body.expectedOutcome || null,
      body.feasibility || null,
      body.novelty || null,
      body.prerequisites ? JSON.stringify(body.prerequisites) : null,
      body.importance || null,
      body.area || null,
      body.tags ? JSON.stringify(body.tags) : '[]'
    );

    // Return the created problem
    const created = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar, p.title as paper_title
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      WHERE cp.id = ?
    `).get(id) as any;

    res.status(201).json({ problem: dbRowToChallengeProblem(created) });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create challenge' });
  }
});

// ============================================================================
// PUT /api/challenges/:id - Update problem
// ============================================================================
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const body = req.body as UpdateChallengeProblemRequest;

    // Check ownership
    const existing = db.prepare('SELECT user_id FROM challenge_problems WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }
    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only edit your own problems' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.status) {
      updates.push('status = ?');
      values.push(body.status);
      if (body.status === 'solved') {
        updates.push('solved_by = ?, solved_at = unixepoch()');
        values.push(user.id);
      }
    }
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description || null);
    }
    if (body.context !== undefined) {
      updates.push('context = ?');
      values.push(body.context || null);
    }
    if (body.methodology !== undefined) {
      updates.push('methodology = ?');
      values.push(body.methodology || null);
    }
    if (body.expectedOutcome !== undefined) {
      updates.push('expected_outcome = ?');
      values.push(body.expectedOutcome || null);
    }
    if (body.solutionSummary !== undefined) {
      updates.push('solution_summary = ?');
      values.push(body.solutionSummary || null);
    }
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(body.tags));
    }
    if (body.orderIndex !== undefined) {
      updates.push('order_index = ?');
      values.push(body.orderIndex);
    }
    if (body.paperId !== undefined) {
      if (body.paperId === null) {
        // Unlink paper
        updates.push('paper_id = NULL');
      } else {
        // Link paper - verify it exists and get title
        const paper = db.prepare('SELECT id, title FROM papers WHERE id = ?').get(body.paperId) as any;
        if (!paper) {
          return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
        }
        updates.push('paper_id = ?');
        values.push(body.paperId);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    updates.push('updated_at = unixepoch()');
    values.push(id);

    db.prepare(`UPDATE challenge_problems SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Return updated problem
    const updated = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar, p.title as paper_title
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      WHERE cp.id = ?
    `).get(id) as any;

    res.json({ problem: dbRowToChallengeProblem(updated) });
  } catch (error) {
    console.error('Update challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update challenge' });
  }
});

// ============================================================================
// DELETE /api/challenges/:id - Delete problem (cascades to children)
// ============================================================================
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const existing = db.prepare('SELECT user_id, parent_id FROM challenge_problems WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }
    if (existing.user_id !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own problems' });
    }

    // Decrement parent's child count if this has a parent
    if (existing.parent_id) {
      db.prepare('UPDATE challenge_problems SET child_count = child_count - 1, updated_at = unixepoch() WHERE id = ?')
        .run(existing.parent_id);
    }

    // Delete (children cascade automatically due to ON DELETE CASCADE)
    db.prepare('DELETE FROM challenge_problems WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete challenge' });
  }
});

// ============================================================================
// POST /api/challenges/:id/vote - Upvote/downvote
// ============================================================================
router.post('/:id/vote', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { isLike } = req.body;

    if (typeof isLike !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', message: 'isLike must be a boolean' });
    }

    const problem = db.prepare('SELECT id, upvotes, downvotes FROM challenge_problems WHERE id = ?').get(id) as any;
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }

    // Use the generic likes table
    const existingVote = db.prepare(`
      SELECT id, is_like FROM likes WHERE user_id = ? AND target_type = 'challenge_problem' AND target_id = ?
    `).get(user.id, id) as any;

    if (existingVote) {
      if ((existingVote.is_like === 1) === isLike) {
        // Same vote - remove it
        db.prepare('DELETE FROM likes WHERE id = ?').run(existingVote.id);
        if (isLike) {
          db.prepare('UPDATE challenge_problems SET upvotes = upvotes - 1 WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE challenge_problems SET downvotes = downvotes - 1 WHERE id = ?').run(id);
        }
      } else {
        // Different vote - switch it
        db.prepare('UPDATE likes SET is_like = ? WHERE id = ?').run(isLike ? 1 : 0, existingVote.id);
        if (isLike) {
          db.prepare('UPDATE challenge_problems SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?').run(id);
        } else {
          db.prepare('UPDATE challenge_problems SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ?').run(id);
        }
      }
    } else {
      // New vote
      db.prepare(`
        INSERT INTO likes (id, user_id, target_type, target_id, is_like)
        VALUES (?, ?, 'challenge_problem', ?, ?)
      `).run(uuidv4(), user.id, id, isLike ? 1 : 0);

      if (isLike) {
        db.prepare('UPDATE challenge_problems SET upvotes = upvotes + 1 WHERE id = ?').run(id);
      } else {
        db.prepare('UPDATE challenge_problems SET downvotes = downvotes + 1 WHERE id = ?').run(id);
      }
    }

    // Return updated counts
    const updated = db.prepare('SELECT upvotes, downvotes FROM challenge_problems WHERE id = ?').get(id) as any;
    res.json({ upvotes: updated.upvotes, downvotes: updated.downvotes });
  } catch (error) {
    console.error('Vote challenge error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to vote' });
  }
});

// ============================================================================
// GET /api/challenges/:id/tree - Get full progress tree
// ============================================================================
router.get('/:id/tree', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const problem = db.prepare('SELECT id, root_id FROM challenge_problems WHERE id = ?').get(id) as any;
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }

    const rootId = problem.root_id || problem.id;

    const rows = db.prepare(`
      SELECT cp.*, u.display_name as user_name, u.avatar as user_avatar, p.title as paper_title
      FROM challenge_problems cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN papers p ON cp.paper_id = p.id
      WHERE cp.root_id = ? OR cp.id = ?
      ORDER BY cp.depth, cp.order_index
    `).all(rootId, rootId) as any[];

    const problems = rows.map(r => dbRowToChallengeProblem(r));
    const tree = buildTree(problems, rootId);

    res.json({ tree });
  } catch (error) {
    console.error('Get progress tree error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get progress tree' });
  }
});

// ============================================================================
// POST /api/challenges/:id/ideas - Link an idea to this question
// ============================================================================
router.post('/:id/ideas', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { ideaId, relationship, notes } = req.body as LinkIdeaToQuestionRequest;

    if (!ideaId || !relationship) {
      return res.status(400).json({ error: 'Bad Request', message: 'ideaId and relationship are required' });
    }

    // Verify question exists and is open_question
    const question = db.prepare('SELECT id, type FROM challenge_problems WHERE id = ?').get(id) as any;
    if (!question) {
      return res.status(404).json({ error: 'Not Found', message: 'Question not found' });
    }
    if (question.type !== 'open_question') {
      return res.status(400).json({ error: 'Bad Request', message: 'Can only link ideas to questions' });
    }

    // Verify idea exists and is research_idea
    const idea = db.prepare('SELECT id, type FROM challenge_problems WHERE id = ?').get(ideaId) as any;
    if (!idea) {
      return res.status(404).json({ error: 'Not Found', message: 'Idea not found' });
    }
    if (idea.type !== 'research_idea') {
      return res.status(400).json({ error: 'Bad Request', message: 'Can only link research ideas' });
    }

    // Check if already linked
    const existing = db.prepare('SELECT id FROM challenge_idea_links WHERE question_id = ? AND idea_id = ?')
      .get(id, ideaId);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Idea already linked to this question' });
    }

    const linkId = uuidv4();
    db.prepare(`
      INSERT INTO challenge_idea_links (id, question_id, idea_id, user_id, relationship, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(linkId, id, ideaId, user.id, relationship, notes || null);

    // Update linked_idea_count
    db.prepare('UPDATE challenge_problems SET linked_idea_count = linked_idea_count + 1 WHERE id = ?').run(id);

    res.status(201).json({ success: true, id: linkId });
  } catch (error) {
    console.error('Link idea error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to link idea' });
  }
});

// ============================================================================
// GET /api/challenges/:id/ideas - Get linked ideas for a question
// ============================================================================
router.get('/:id/ideas', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rows = db.prepare(`
      SELECT l.*, u.display_name as user_name,
             idea.*, idea_user.display_name as idea_user_name, idea_user.avatar as idea_user_avatar
      FROM challenge_idea_links l
      JOIN users u ON l.user_id = u.id
      JOIN challenge_problems idea ON l.idea_id = idea.id
      JOIN users idea_user ON idea.user_id = idea_user.id
      WHERE l.question_id = ?
      ORDER BY l.created_at DESC
    `).all(id) as any[];

    const links = rows.map(l => ({
      id: l.id,
      questionId: l.question_id,
      ideaId: l.idea_id,
      idea: dbRowToChallengeProblem({
        ...l,
        id: l.idea_id,
        user_id: l.user_id,
        user_name: l.idea_user_name,
        user_avatar: l.idea_user_avatar,
      }),
      userId: l.user_id,
      userName: l.user_name,
      relationship: l.relationship,
      notes: l.notes || undefined,
      createdAt: l.created_at,
    }));

    res.json({ links });
  } catch (error) {
    console.error('Get linked ideas error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get linked ideas' });
  }
});

// ============================================================================
// DELETE /api/challenges/:id/ideas/:linkId - Remove idea link
// ============================================================================
router.delete('/:id/ideas/:linkId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id, linkId } = req.params;

    const link = db.prepare('SELECT id, user_id FROM challenge_idea_links WHERE id = ? AND question_id = ?')
      .get(linkId, id) as any;

    if (!link) {
      return res.status(404).json({ error: 'Not Found', message: 'Link not found' });
    }
    if (link.user_id !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only remove your own links' });
    }

    db.prepare('DELETE FROM challenge_idea_links WHERE id = ?').run(linkId);

    // Update linked_idea_count
    db.prepare('UPDATE challenge_problems SET linked_idea_count = linked_idea_count - 1 WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove idea link error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove link' });
  }
});

// ============================================================================
// GET /api/challenges/:id/questions - Get questions this idea addresses
// ============================================================================
router.get('/:id/questions', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rows = db.prepare(`
      SELECT l.*, u.display_name as user_name,
             q.*, q_user.display_name as q_user_name, q_user.avatar as q_user_avatar
      FROM challenge_idea_links l
      JOIN users u ON l.user_id = u.id
      JOIN challenge_problems q ON l.question_id = q.id
      JOIN users q_user ON q.user_id = q_user.id
      WHERE l.idea_id = ?
      ORDER BY l.created_at DESC
    `).all(id) as any[];

    const links = rows.map(l => ({
      id: l.id,
      questionId: l.question_id,
      question: dbRowToChallengeProblem({
        ...l,
        id: l.question_id,
        user_name: l.q_user_name,
        user_avatar: l.q_user_avatar,
      }),
      ideaId: l.idea_id,
      userId: l.user_id,
      userName: l.user_name,
      relationship: l.relationship,
      notes: l.notes || undefined,
      createdAt: l.created_at,
    }));

    res.json({ links });
  } catch (error) {
    console.error('Get questions for idea error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get questions' });
  }
});

// ============================================================================
// POST /api/challenges/:id/comments - Add comment
// ============================================================================
router.post('/:id/comments', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { content, parentId } = req.body as CreateChallengeCommentRequest;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Content is required' });
    }

    // Verify problem exists
    const problem = db.prepare('SELECT id FROM challenge_problems WHERE id = ?').get(id);
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }

    // Verify parent comment exists if provided
    if (parentId) {
      const parent = db.prepare('SELECT id FROM challenge_comments WHERE id = ? AND problem_id = ?')
        .get(parentId, id);
      if (!parent) {
        return res.status(404).json({ error: 'Not Found', message: 'Parent comment not found' });
      }
    }

    const commentId = uuidv4();
    db.prepare(`
      INSERT INTO challenge_comments (id, problem_id, user_id, parent_id, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(commentId, id, user.id, parentId || null, content.trim());

    // Update comment count
    db.prepare('UPDATE challenge_problems SET comment_count = comment_count + 1 WHERE id = ?').run(id);

    // Return created comment
    const created = db.prepare(`
      SELECT c.*, u.display_name as user_name, u.avatar as user_avatar
      FROM challenge_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId) as any;

    res.status(201).json({ comment: dbRowToChallengeComment(created) });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create comment' });
  }
});

// ============================================================================
// GET /api/challenges/:id/comments - Get comments
// ============================================================================
router.get('/:id/comments', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const rows = db.prepare(`
      SELECT c.*, u.display_name as user_name, u.avatar as user_avatar
      FROM challenge_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.problem_id = ?
      ORDER BY c.created_at ASC
    `).all(id) as any[];

    const comments = rows.map(c => dbRowToChallengeComment(c));

    // Build tree
    const commentMap = new Map<string, ChallengeComment>();
    const rootComments: ChallengeComment[] = [];

    comments.forEach(c => {
      commentMap.set(c.id, { ...c, replies: [] });
    });

    comments.forEach(c => {
      const node = commentMap.get(c.id)!;
      if (c.parentId && commentMap.has(c.parentId)) {
        const parent = commentMap.get(c.parentId)!;
        if (!parent.replies) parent.replies = [];
        parent.replies.push(node);
      } else {
        rootComments.push(node);
      }
    });

    res.json({ comments: rootComments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get comments' });
  }
});

// ============================================================================
// DELETE /api/challenges/comments/:commentId - Delete comment
// ============================================================================
router.delete('/comments/:commentId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { commentId } = req.params;

    const comment = db.prepare('SELECT id, user_id, problem_id FROM challenge_comments WHERE id = ?')
      .get(commentId) as any;

    if (!comment) {
      return res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
    }
    if (comment.user_id !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own comments' });
    }

    db.prepare('DELETE FROM challenge_comments WHERE id = ?').run(commentId);

    // Update comment count
    db.prepare('UPDATE challenge_problems SET comment_count = comment_count - 1 WHERE id = ?')
      .run(comment.problem_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete comment' });
  }
});

// ============================================================================
// CROSS-PAPER RELATIONSHIP LINKS
// ============================================================================

// GET /api/challenges/:id/links - Get all cross-paper links for a problem
router.get('/:id/links', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify problem exists
    const problem = db.prepare('SELECT id FROM challenge_problems WHERE id = ?').get(id);
    if (!problem) {
      return res.status(404).json({ error: 'Not Found', message: 'Problem not found' });
    }

    // Get outgoing links (this problem is source)
    const outgoingRows = db.prepare(`
      SELECT l.*, u.display_name as user_name,
             tp.title as target_title, tp.type as target_type, tp.status as target_status
      FROM challenge_problem_links l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN challenge_problems tp ON l.target_id = tp.id
      WHERE l.source_id = ?
      ORDER BY l.created_at DESC
    `).all(id) as any[];

    // Get incoming links (this problem is target)
    const incomingRows = db.prepare(`
      SELECT l.*, u.display_name as user_name,
             sp.title as source_title, sp.type as source_type, sp.status as source_status
      FROM challenge_problem_links l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN challenge_problems sp ON l.source_id = sp.id
      WHERE l.target_id = ?
      ORDER BY l.created_at DESC
    `).all(id) as any[];

    const outgoingLinks = outgoingRows.map(row => ({
      ...dbRowToChallengeProblemLink(row),
      targetProblemTitle: row.target_title,
      targetProblem: {
        id: row.target_id,
        title: row.target_title,
        type: row.target_type,
        status: row.target_status,
      }
    }));

    const incomingLinks = incomingRows.map(row => ({
      ...dbRowToChallengeProblemLink(row),
      targetProblemTitle: row.source_title, // For incoming, the "target" from our perspective is the source
      sourceProblem: {
        id: row.source_id,
        title: row.source_title,
        type: row.source_type,
        status: row.source_status,
      }
    }));

    // Combine for simple frontend consumption
    const links = [...outgoingLinks, ...incomingLinks];

    res.json({ links, outgoingLinks, incomingLinks });
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get links' });
  }
});

// POST /api/challenges/:id/links - Create a cross-paper relationship link
router.post('/:id/links', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: sourceId } = req.params;
    const { targetId, relationship, notes } = req.body as CreateChallengeProblemLinkRequest;

    // Validate
    if (!targetId || !relationship) {
      return res.status(400).json({ error: 'Bad Request', message: 'targetId and relationship are required' });
    }

    const validRelationships: CrossPaperRelationship[] = ['extends', 'contradicts', 'builds_on', 'supersedes', 'related'];
    if (!validRelationships.includes(relationship)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid relationship type' });
    }

    // Verify both problems exist
    const source = db.prepare('SELECT id FROM challenge_problems WHERE id = ?').get(sourceId);
    const target = db.prepare('SELECT id FROM challenge_problems WHERE id = ?').get(targetId);

    if (!source || !target) {
      return res.status(404).json({ error: 'Not Found', message: 'One or both problems not found' });
    }

    if (sourceId === targetId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot link a problem to itself' });
    }

    // Check if link already exists
    const existing = db.prepare(`
      SELECT id FROM challenge_problem_links
      WHERE source_id = ? AND target_id = ? AND relationship = ?
    `).get(sourceId, targetId, relationship);

    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'This link already exists' });
    }

    const linkId = uuidv4();
    db.prepare(`
      INSERT INTO challenge_problem_links (id, source_id, target_id, relationship, user_id, notes, ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(linkId, sourceId, targetId, relationship, user.id, notes || null);

    const link = db.prepare(`
      SELECT l.*, u.display_name as user_name
      FROM challenge_problem_links l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = ?
    `).get(linkId) as any;

    res.status(201).json({ link: dbRowToChallengeProblemLink(link) });
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create link' });
  }
});

// DELETE /api/challenges/links/:linkId - Delete a cross-paper link
router.delete('/links/:linkId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { linkId } = req.params;

    const link = db.prepare('SELECT id, user_id FROM challenge_problem_links WHERE id = ?').get(linkId) as any;

    if (!link) {
      return res.status(404).json({ error: 'Not Found', message: 'Link not found' });
    }

    // Only link creator or admin can delete
    if (link.user_id !== user.id && !user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own links' });
    }

    db.prepare('DELETE FROM challenge_problem_links WHERE id = ?').run(linkId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete link error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete link' });
  }
});

export default router;
