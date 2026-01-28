import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth } from './auth.js';
import { chatCompletion } from '../lib/ai-providers/index.js';
import type {
  PaperGroup,
  PaperGroupMember,
  PaperGroupWithPapers,
  GroupAiSession,
  CreatePaperGroupRequest,
  AddPapersToGroupRequest,
  StartGroupReadingRequest,
  PaperWithStats,
  AiAgentMessage,
} from '../../shared/types.js';

const router = Router();

// Helper to format paper group from DB row
function formatPaperGroup(row: any): PaperGroup {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatar: row.user_avatar,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    paperCount: row.paper_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper to format paper group member from DB row
function formatPaperGroupMember(row: any): PaperGroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    paperId: row.paper_id,
    addedBy: row.added_by,
    addedByName: row.added_by_name,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    paper: row.paper_title ? {
      id: row.paper_id,
      title: row.paper_title,
      authors: JSON.parse(row.paper_authors || '[]'),
      abstract: row.paper_abstract,
      arxivId: row.paper_arxiv_id,
      tags: JSON.parse(row.paper_tags || '[]'),
      viewCount: row.paper_view_count ?? 0,
      createdAt: row.paper_created_at,
      addedBy: row.paper_added_by,
      addedByName: row.paper_added_by_name,
      annotationCount: row.paper_annotation_count ?? 0,
      readerCount: row.paper_reader_count ?? 0,
      avgRating: row.paper_avg_rating,
      avgNovelty: row.paper_avg_novelty,
      visibility: row.paper_visibility || 'public',
      forkCount: row.paper_fork_count ?? 0,
      activeAvatarUrl: row.paper_active_avatar_url,
      hasAiAnalysis: row.paper_has_ai_analysis ?? false,
    } as PaperWithStats : undefined,
  };
}

// Helper to format group AI session from DB row
function formatGroupAiSession(row: any): GroupAiSession {
  const totalTokens = (row.total_prompt_tokens ?? 0) + (row.total_completion_tokens ?? 0);
  const tokenLimit = row.token_limit ?? 100000;
  return {
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    title: row.title,
    modelId: row.model_id,
    messages: JSON.parse(row.messages || '[]'),
    paperSummaries: JSON.parse(row.paper_summaries || '{}'),
    combinedAnalysis: row.combined_analysis,
    apiKeySet: !!row.api_key_encrypted,
    totalPromptTokens: row.total_prompt_tokens ?? 0,
    totalCompletionTokens: row.total_completion_tokens ?? 0,
    tokenLimit: tokenLimit,
    tokenLimitReached: tokenLimit > 0 && totalTokens >= tokenLimit,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Check if user has access to a group
function hasAccessToGroup(groupId: string, userId: string | undefined): boolean {
  if (!userId) return false;
  const group = db.prepare(
    'SELECT user_id, visibility FROM paper_groups WHERE id = ?'
  ).get(groupId) as any;
  if (!group) return false;
  if (group.visibility === 'public') return true;
  return group.user_id === userId;
}

// Check if user owns a group
function isGroupOwner(groupId: string, userId: string): boolean {
  const group = db.prepare(
    'SELECT user_id FROM paper_groups WHERE id = ?'
  ).get(groupId) as any;
  return group?.user_id === userId;
}

// ============================================================================
// GROUP CRUD ENDPOINTS
// ============================================================================

// GET /api/paper-groups - List user's groups and public groups
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { search, includePublic } = req.query;

    let query = `
      SELECT
        pg.*,
        u.display_name as user_name,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM paper_group_members pgm WHERE pgm.group_id = pg.id) as paper_count
      FROM paper_groups pg
      JOIN users u ON pg.user_id = u.id
      WHERE (pg.user_id = ? OR pg.visibility = 'public')
    `;
    const params: any[] = [user.id];

    if (search) {
      query += ` AND (pg.name LIKE ? OR pg.description LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ` ORDER BY pg.updated_at DESC`;

    const groups = db.prepare(query).all(...params) as any[];

    res.json({
      groups: groups.map(formatPaperGroup),
    });
  } catch (error) {
    console.error('Get paper groups error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get paper groups' });
  }
});

// POST /api/paper-groups - Create new group
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name, description, visibility = 'private', paperIds } = req.body as CreatePaperGroupRequest;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'Group name is required' });
    }

    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO paper_groups (id, user_id, name, description, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, user.id, name.trim(), description?.trim() || null, visibility, now, now);

    // Add initial papers if provided
    if (paperIds && paperIds.length > 0) {
      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO paper_group_members (id, group_id, paper_id, added_by, order_index, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      paperIds.forEach((paperId, index) => {
        insertMember.run(uuidv4(), id, paperId, user.id, index, now);
      });
    }

    const group = db.prepare(`
      SELECT
        pg.*,
        u.display_name as user_name,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM paper_group_members pgm WHERE pgm.group_id = pg.id) as paper_count
      FROM paper_groups pg
      JOIN users u ON pg.user_id = u.id
      WHERE pg.id = ?
    `).get(id) as any;

    res.status(201).json({ group: formatPaperGroup(group) });
  } catch (error) {
    console.error('Create paper group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create paper group' });
  }
});

// GET /api/paper-groups/:id - Get group with papers
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasAccessToGroup(id, user.id)) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper group not found' });
    }

    // Get group info
    const group = db.prepare(`
      SELECT
        pg.*,
        u.display_name as user_name,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM paper_group_members pgm WHERE pgm.group_id = pg.id) as paper_count
      FROM paper_groups pg
      JOIN users u ON pg.user_id = u.id
      WHERE pg.id = ?
    `).get(id) as any;

    if (!group) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper group not found' });
    }

    // Get papers in group with full details
    const members = db.prepare(`
      SELECT
        pgm.id,
        pgm.group_id,
        pgm.paper_id,
        pgm.added_by,
        pgm.order_index,
        pgm.created_at,
        adder.display_name as added_by_name,
        p.title as paper_title,
        p.authors as paper_authors,
        p.abstract as paper_abstract,
        p.arxiv_id as paper_arxiv_id,
        p.tags as paper_tags,
        p.view_count as paper_view_count,
        p.created_at as paper_created_at,
        p.added_by as paper_added_by,
        p.visibility as paper_visibility,
        p.fork_count as paper_fork_count,
        p.active_avatar_url as paper_active_avatar_url,
        uploader.display_name as paper_added_by_name,
        (SELECT COUNT(*) FROM annotations a WHERE a.paper_id = p.id) as paper_annotation_count,
        (SELECT COUNT(DISTINCT user_id) FROM reading_sessions rs WHERE rs.paper_id = p.id) as paper_reader_count,
        (SELECT AVG(score) FROM ratings r WHERE r.paper_id = p.id) as paper_avg_rating,
        (SELECT AVG(novelty_score) FROM ratings r WHERE r.paper_id = p.id) as paper_avg_novelty
      FROM paper_group_members pgm
      JOIN papers p ON pgm.paper_id = p.id
      JOIN users adder ON pgm.added_by = adder.id
      LEFT JOIN users uploader ON p.added_by = uploader.id
      WHERE pgm.group_id = ?
      ORDER BY pgm.order_index
    `).all(id) as any[];

    const result: PaperGroupWithPapers = {
      ...formatPaperGroup(group),
      papers: members.map(formatPaperGroupMember),
    };

    res.json({ group: result });
  } catch (error) {
    console.error('Get paper group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get paper group' });
  }
});

// PUT /api/paper-groups/:id - Update group
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, description, visibility } = req.body;

    if (!isGroupOwner(id, user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the group owner can update it' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description?.trim() || null);
    }
    if (visibility !== undefined) {
      updates.push('visibility = ?');
      params.push(visibility);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id);

    db.prepare(`
      UPDATE paper_groups SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    const group = db.prepare(`
      SELECT
        pg.*,
        u.display_name as user_name,
        u.avatar as user_avatar,
        (SELECT COUNT(*) FROM paper_group_members pgm WHERE pgm.group_id = pg.id) as paper_count
      FROM paper_groups pg
      JOIN users u ON pg.user_id = u.id
      WHERE pg.id = ?
    `).get(id) as any;

    res.json({ group: formatPaperGroup(group) });
  } catch (error) {
    console.error('Update paper group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update paper group' });
  }
});

// DELETE /api/paper-groups/:id - Delete group
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!isGroupOwner(id, user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the group owner can delete it' });
    }

    db.prepare('DELETE FROM paper_groups WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete paper group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete paper group' });
  }
});

// ============================================================================
// GROUP MEMBER ENDPOINTS
// ============================================================================

// POST /api/paper-groups/:id/papers - Add papers to group
router.post('/:id/papers', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { paperIds } = req.body as AddPapersToGroupRequest;

    if (!isGroupOwner(id, user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the group owner can add papers' });
    }

    if (!paperIds || paperIds.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Paper IDs required' });
    }

    // Get current max order index
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM paper_group_members WHERE group_id = ?'
    ).get(id) as any;

    const now = Math.floor(Date.now() / 1000);
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO paper_group_members (id, group_id, paper_id, added_by, order_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const addedIds: string[] = [];
    paperIds.forEach((paperId, index) => {
      const memberId = uuidv4();
      const result = insertMember.run(memberId, id, paperId, user.id, maxOrder.max_order + 1 + index, now);
      if (result.changes > 0) {
        addedIds.push(memberId);
      }
    });

    // Update group's updated_at
    db.prepare('UPDATE paper_groups SET updated_at = ? WHERE id = ?').run(now, id);

    // Fetch the added members
    const members = db.prepare(`
      SELECT
        pgm.id,
        pgm.group_id,
        pgm.paper_id,
        pgm.added_by,
        pgm.order_index,
        pgm.created_at,
        adder.display_name as added_by_name,
        p.title as paper_title,
        p.authors as paper_authors,
        p.abstract as paper_abstract,
        p.arxiv_id as paper_arxiv_id
      FROM paper_group_members pgm
      JOIN papers p ON pgm.paper_id = p.id
      JOIN users adder ON pgm.added_by = adder.id
      WHERE pgm.group_id = ? AND pgm.paper_id IN (${paperIds.map(() => '?').join(',')})
    `).all(id, ...paperIds) as any[];

    res.json({ members: members.map(formatPaperGroupMember) });
  } catch (error) {
    console.error('Add papers to group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add papers to group' });
  }
});

// DELETE /api/paper-groups/:id/papers/:paperId - Remove paper from group
router.delete('/:id/papers/:paperId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id, paperId } = req.params;

    if (!isGroupOwner(id, user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the group owner can remove papers' });
    }

    db.prepare('DELETE FROM paper_group_members WHERE group_id = ? AND paper_id = ?').run(id, paperId);

    // Update group's updated_at
    db.prepare('UPDATE paper_groups SET updated_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);

    res.json({ success: true });
  } catch (error) {
    console.error('Remove paper from group error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove paper from group' });
  }
});

// PUT /api/paper-groups/:id/papers/reorder - Reorder papers in group
router.put('/:id/papers/reorder', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { paperIds } = req.body;  // Array of paper IDs in new order

    if (!isGroupOwner(id, user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the group owner can reorder papers' });
    }

    if (!paperIds || !Array.isArray(paperIds)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Paper IDs array required' });
    }

    const updateOrder = db.prepare(
      'UPDATE paper_group_members SET order_index = ? WHERE group_id = ? AND paper_id = ?'
    );

    paperIds.forEach((paperId, index) => {
      updateOrder.run(index, id, paperId);
    });

    // Update group's updated_at
    db.prepare('UPDATE paper_groups SET updated_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reorder papers' });
  }
});

// ============================================================================
// GROUP AI SESSION ENDPOINTS
// ============================================================================

// POST /api/paper-groups/:id/ai-session - Create new AI session for group
router.post('/:id/ai-session', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { modelId, apiKey, title, tokenLimit } = req.body as StartGroupReadingRequest;

    if (!hasAccessToGroup(id, user.id)) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper group not found' });
    }

    if (!modelId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Model ID is required' });
    }

    const sessionId = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const sessionTitle = title || `Reading session - ${new Date().toLocaleDateString()}`;
    const sessionTokenLimit = tokenLimit ?? 100000; // Default 100K tokens

    // Simple base64 encoding for API key (same as debates)
    const apiKeyEncrypted = apiKey ? Buffer.from(apiKey).toString('base64') : null;

    db.prepare(`
      INSERT INTO group_ai_sessions (id, group_id, user_id, title, model_id, api_key_encrypted, token_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, id, user.id, sessionTitle, modelId, apiKeyEncrypted, sessionTokenLimit, now, now);

    const session = db.prepare('SELECT * FROM group_ai_sessions WHERE id = ?').get(sessionId) as any;

    res.status(201).json({ session: formatGroupAiSession(session) });
  } catch (error) {
    console.error('Create group AI session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create AI session' });
  }
});

// GET /api/paper-groups/:id/ai-sessions - List AI sessions for group
router.get('/:id/ai-sessions', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasAccessToGroup(id, user.id)) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper group not found' });
    }

    const sessions = db.prepare(`
      SELECT * FROM group_ai_sessions
      WHERE group_id = ? AND user_id = ?
      ORDER BY updated_at DESC
    `).all(id, user.id) as any[];

    res.json({ sessions: sessions.map(formatGroupAiSession) });
  } catch (error) {
    console.error('Get group AI sessions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI sessions' });
  }
});

// GET /api/paper-groups/:groupId/ai-session/:sessionId - Get session details
router.get('/:groupId/ai-session/:sessionId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { groupId, sessionId } = req.params;

    const session = db.prepare(
      'SELECT * FROM group_ai_sessions WHERE id = ? AND group_id = ? AND user_id = ?'
    ).get(sessionId, groupId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    res.json({ session: formatGroupAiSession(session) });
  } catch (error) {
    console.error('Get group AI session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI session' });
  }
});

// POST /api/paper-groups/:groupId/ai-session/:sessionId/set-api-key - Set API key
router.post('/:groupId/ai-session/:sessionId/set-api-key', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { groupId, sessionId } = req.params;
    const { apiKey } = req.body;

    const session = db.prepare(
      'SELECT * FROM group_ai_sessions WHERE id = ? AND group_id = ? AND user_id = ?'
    ).get(sessionId, groupId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key already set' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key is required' });
    }

    const apiKeyEncrypted = Buffer.from(apiKey).toString('base64');
    db.prepare(
      'UPDATE group_ai_sessions SET api_key_encrypted = ?, updated_at = ? WHERE id = ?'
    ).run(apiKeyEncrypted, Math.floor(Date.now() / 1000), sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Set API key error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to set API key' });
  }
});

// POST /api/paper-groups/:groupId/ai-session/:sessionId/read-papers - Start reading all papers
router.post('/:groupId/ai-session/:sessionId/read-papers', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { groupId, sessionId } = req.params;

    const session = db.prepare(
      'SELECT * FROM group_ai_sessions WHERE id = ? AND group_id = ? AND user_id = ?'
    ).get(sessionId, groupId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key not set' });
    }

    // Get papers in group
    const papers = db.prepare(`
      SELECT p.id, p.title, p.authors, p.abstract
      FROM paper_group_members pgm
      JOIN papers p ON pgm.paper_id = p.id
      WHERE pgm.group_id = ?
      ORDER BY pgm.order_index
    `).all(groupId) as any[];

    if (papers.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No papers in group' });
    }

    // Update status to reading
    db.prepare(
      'UPDATE group_ai_sessions SET status = ?, updated_at = ? WHERE id = ?'
    ).run('reading', Math.floor(Date.now() / 1000), sessionId);

    // Decrypt API key
    const apiKey = Buffer.from(session.api_key_encrypted, 'base64').toString('utf-8');

    // Generate summaries for each paper
    const paperSummaries: Record<string, string> = {};
    let totalPromptTokens = session.total_prompt_tokens || 0;
    let totalCompletionTokens = session.total_completion_tokens || 0;

    for (const paper of papers) {
      try {
        // Build prompt for paper summary
        const prompt = `Summarize this academic paper in 2-3 paragraphs, focusing on:
1. Main contribution and key findings
2. Methodology used
3. Significance and implications

Paper: "${paper.title}"
Authors: ${JSON.parse(paper.authors || '[]').join(', ')}
Abstract: ${paper.abstract || 'No abstract available'}`;

        // Call OpenAI API (or compatible)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: session.model_id.includes('gpt') ? session.model_id : 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert academic paper summarizer. Provide clear, concise summaries.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 1000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to summarize paper ${paper.id}:`, errorText);
          paperSummaries[paper.id] = `[Failed to generate summary: API error]`;
          continue;
        }

        const result = await response.json();
        paperSummaries[paper.id] = result.choices[0]?.message?.content || '[No summary generated]';

        // Track tokens
        if (result.usage) {
          totalPromptTokens += result.usage.prompt_tokens || 0;
          totalCompletionTokens += result.usage.completion_tokens || 0;
        }
      } catch (error) {
        console.error(`Error summarizing paper ${paper.id}:`, error);
        paperSummaries[paper.id] = `[Failed to generate summary: ${error}]`;
      }
    }

    // Generate combined analysis if we have summaries
    let combinedAnalysis = '';
    if (Object.keys(paperSummaries).length > 0) {
      try {
        const summariesText = papers.map(p =>
          `Paper: "${p.title}"\nSummary: ${paperSummaries[p.id] || 'No summary'}`
        ).join('\n\n---\n\n');

        const analysisPrompt = `You've read the following papers. Provide a cross-paper analysis that:
1. Identifies common themes and research directions
2. Notes key differences in approaches or findings
3. Highlights potential research gaps or opportunities
4. Suggests how these papers relate to each other

${summariesText}`;

        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: session.model_id.includes('gpt') ? session.model_id : 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert at synthesizing academic research. Provide insightful cross-paper analysis.' },
              { role: 'user', content: analysisPrompt }
            ],
            max_tokens: 2000,
          }),
        });

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json();
          combinedAnalysis = analysisResult.choices[0]?.message?.content || '';
          if (analysisResult.usage) {
            totalPromptTokens += analysisResult.usage.prompt_tokens || 0;
            totalCompletionTokens += analysisResult.usage.completion_tokens || 0;
          }
        }
      } catch (error) {
        console.error('Error generating combined analysis:', error);
      }
    }

    // Update session with results
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE group_ai_sessions
      SET paper_summaries = ?, combined_analysis = ?, status = ?,
          total_prompt_tokens = ?, total_completion_tokens = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(paperSummaries),
      combinedAnalysis,
      'ready',
      totalPromptTokens,
      totalCompletionTokens,
      now,
      sessionId
    );

    const updatedSession = db.prepare('SELECT * FROM group_ai_sessions WHERE id = ?').get(sessionId) as any;

    res.json({ session: formatGroupAiSession(updatedSession) });
  } catch (error) {
    console.error('Read papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to read papers' });
  }
});

// POST /api/paper-groups/:groupId/ai-session/:sessionId/chat - Chat with AI about papers
router.post('/:groupId/ai-session/:sessionId/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { groupId, sessionId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'Message is required' });
    }

    const session = db.prepare(
      'SELECT * FROM group_ai_sessions WHERE id = ? AND group_id = ? AND user_id = ?'
    ).get(sessionId, groupId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key not set' });
    }

    // Check token limit
    const totalTokens = (session.total_prompt_tokens || 0) + (session.total_completion_tokens || 0);
    const tokenLimit = session.token_limit || 100000;
    if (tokenLimit > 0 && totalTokens >= tokenLimit) {
      return res.status(400).json({
        error: 'Token Limit Reached',
        message: `You have reached your token limit of ${tokenLimit.toLocaleString()} tokens. Please increase your limit to continue.`,
        tokenLimitReached: true,
        currentTokens: totalTokens,
        tokenLimit: tokenLimit,
      });
    }

    // Get papers for context
    const papers = db.prepare(`
      SELECT p.id, p.title, p.authors, p.abstract
      FROM paper_group_members pgm
      JOIN papers p ON pgm.paper_id = p.id
      WHERE pgm.group_id = ?
      ORDER BY pgm.order_index
    `).all(groupId) as any[];

    // Build context from summaries and combined analysis
    const paperSummaries = JSON.parse(session.paper_summaries || '{}');
    let context = 'You have read the following papers:\n\n';

    papers.forEach((paper, index) => {
      context += `[${index + 1}] "${paper.title}"\n`;
      context += `Authors: ${JSON.parse(paper.authors || '[]').join(', ')}\n`;
      if (paperSummaries[paper.id]) {
        context += `Summary: ${paperSummaries[paper.id]}\n`;
      }
      context += '\n';
    });

    if (session.combined_analysis) {
      context += `\nCross-Paper Analysis:\n${session.combined_analysis}\n`;
    }

    // Build conversation history
    const messages: AiAgentMessage[] = JSON.parse(session.messages || '[]');
    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Add new user message
    const now = Math.floor(Date.now() / 1000);
    messages.push({ role: 'user', content: message.trim(), timestamp: now });

    // Decrypt API key
    const apiKey = Buffer.from(session.api_key_encrypted, 'base64').toString('utf-8');

    // Call AI using multi-provider system
    let aiResponse;
    try {
      aiResponse = await chatCompletion(
        {
          model: session.model_id || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `You are a research assistant helping analyze academic papers. ${context}` },
            ...conversationHistory,
            { role: 'user', content: message.trim() }
          ],
          maxTokens: 2000,
        },
        { apiKey }
      );
    } catch (aiError: any) {
      console.error('AI provider error:', aiError);
      return res.status(500).json({ error: 'API Error', message: aiError.message || 'Failed to get AI response' });
    }

    const assistantMessage = aiResponse.content || 'I could not generate a response.';

    // Add assistant message to history
    messages.push({ role: 'assistant', content: assistantMessage, timestamp: Math.floor(Date.now() / 1000) });

    // Update token counts
    let totalPromptTokens = session.total_prompt_tokens || 0;
    let totalCompletionTokens = session.total_completion_tokens || 0;
    if (aiResponse.usage) {
      totalPromptTokens += aiResponse.usage.promptTokens || 0;
      totalCompletionTokens += aiResponse.usage.completionTokens || 0;
    }

    // Save to database
    db.prepare(`
      UPDATE group_ai_sessions
      SET messages = ?, total_prompt_tokens = ?, total_completion_tokens = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(messages), totalPromptTokens, totalCompletionTokens, Math.floor(Date.now() / 1000), sessionId);

    const updatedSession = db.prepare('SELECT * FROM group_ai_sessions WHERE id = ?').get(sessionId) as any;

    res.json({
      response: assistantMessage,
      session: formatGroupAiSession(updatedSession),
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process chat' });
  }
});

// PUT /api/paper-groups/:groupId/ai-session/:sessionId/token-limit - Update token limit
router.put('/:groupId/ai-session/:sessionId/token-limit', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { groupId, sessionId } = req.params;
    const { tokenLimit } = req.body;

    if (tokenLimit === undefined || tokenLimit === null) {
      return res.status(400).json({ error: 'Bad Request', message: 'Token limit is required' });
    }

    if (typeof tokenLimit !== 'number' || tokenLimit < 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Token limit must be a positive number' });
    }

    const session = db.prepare(
      'SELECT * FROM group_ai_sessions WHERE id = ? AND group_id = ? AND user_id = ?'
    ).get(sessionId, groupId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE group_ai_sessions
      SET token_limit = ?, updated_at = ?
      WHERE id = ?
    `).run(tokenLimit, now, sessionId);

    const updatedSession = db.prepare('SELECT * FROM group_ai_sessions WHERE id = ?').get(sessionId) as any;

    res.json({ session: formatGroupAiSession(updatedSession) });
  } catch (error) {
    console.error('Update token limit error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update token limit' });
  }
});

export default router;
