import { Router, Request, Response } from 'express';
import db from '../db.js';
import type { User } from '../../shared/types.js';

const router = Router();

// Middleware to require admin privileges
export function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user as User | null;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required' });
  }
  next();
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

// GET /api/admin/stats - Get admin dashboard stats
router.get('/stats', requireAdmin, (req: Request, res: Response) => {
  try {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
    const paperCount = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as any).count;
    const annotationCount = (db.prepare('SELECT COUNT(*) as count FROM annotations').get() as any).count;
    const aiSessionCount = (db.prepare('SELECT COUNT(*) as count FROM ai_agent_history').get() as any).count;
    const aiReviewCount = (db.prepare('SELECT COUNT(*) as count FROM ai_reviews').get() as any).count;
    const userReviewCount = (db.prepare('SELECT COUNT(*) as count FROM user_reviews').get() as any).count;

    res.json({
      stats: {
        userCount,
        paperCount,
        annotationCount,
        aiSessionCount,
        aiReviewCount,
        userReviewCount,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get stats' });
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// GET /api/admin/users - List all users
router.get('/users', requireAdmin, (req: Request, res: Response) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT u.*,
        (SELECT COUNT(*) FROM annotations WHERE user_id = u.id) as annotation_count,
        (SELECT COUNT(*) FROM papers WHERE added_by = u.id) as paper_count,
        (SELECT COUNT(*) FROM ai_agent_history WHERE user_id = u.id) as session_count
      FROM users u
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE u.username LIKE ? OR u.display_name LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const users = db.prepare(query).all(...params) as any[];

    const total = (db.prepare(`
      SELECT COUNT(*) as count FROM users
      ${search ? `WHERE username LIKE ? OR display_name LIKE ?` : ''}
    `).get(...(search ? [`%${search}%`, `%${search}%`] : [])) as any).count;

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatar: u.avatar || undefined,
        bio: u.bio || undefined,
        isAdmin: u.is_admin === 1,
        createdAt: u.created_at,
        annotationCount: u.annotation_count,
        paperCount: u.paper_count,
        sessionCount: u.session_count,
      })),
      total,
    });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list users' });
  }
});

// PUT /api/admin/users/:userId/admin - Toggle admin status
router.put('/users/:userId/admin', requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;
    const currentUser = (req as any).user as User;

    // Prevent removing own admin status
    if (userId === currentUser.id && !isAdmin) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot remove your own admin status' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin toggle admin error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update admin status' });
  }
});

// DELETE /api/admin/users/:userId - Delete a user
router.delete('/users/:userId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user as User;

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot delete yourself' });
    }

    const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Delete user (cascades to sessions, annotations, etc.)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user' });
  }
});

// ============================================================================
// PAPER MANAGEMENT
// ============================================================================

// GET /api/admin/papers - List all papers
router.get('/papers', requireAdmin, (req: Request, res: Response) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT p.*,
        u.username as added_by_username,
        u.display_name as added_by_display_name,
        (SELECT COUNT(*) FROM annotations WHERE paper_id = p.id) as annotation_count,
        (SELECT COUNT(*) FROM reading_sessions WHERE paper_id = p.id) as reader_count,
        (SELECT COUNT(*) FROM ai_agent_history WHERE paper_id = p.id) as session_count,
        (SELECT COUNT(*) FROM ai_reviews WHERE paper_id = p.id) as ai_review_count,
        (SELECT COUNT(*) FROM user_reviews WHERE paper_id = p.id) as user_review_count
      FROM papers p
      LEFT JOIN users u ON p.added_by = u.id
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE p.title LIKE ? OR p.arxiv_id LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const papers = db.prepare(query).all(...params) as any[];

    const total = (db.prepare(`
      SELECT COUNT(*) as count FROM papers
      ${search ? `WHERE title LIKE ? OR arxiv_id LIKE ?` : ''}
    `).get(...(search ? [`%${search}%`, `%${search}%`] : [])) as any).count;

    res.json({
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        arxivId: p.arxiv_id || undefined,
        authors: p.authors ? JSON.parse(p.authors) : [],
        viewCount: p.view_count,
        createdAt: p.created_at,
        addedBy: p.added_by ? {
          id: p.added_by,
          username: p.added_by_username,
          displayName: p.added_by_display_name,
        } : undefined,
        annotationCount: p.annotation_count,
        readerCount: p.reader_count,
        sessionCount: p.session_count,
        aiReviewCount: p.ai_review_count,
        userReviewCount: p.user_review_count,
      })),
      total,
    });
  } catch (error) {
    console.error('Admin list papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list papers' });
  }
});

// DELETE /api/admin/papers/:paperId - Delete a paper
router.delete('/papers/:paperId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;

    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Delete paper (cascades to annotations, reviews, etc.)
    db.prepare('DELETE FROM papers WHERE id = ?').run(paperId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete paper error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete paper' });
  }
});

// ============================================================================
// ANNOTATION MANAGEMENT
// ============================================================================

// GET /api/admin/annotations - List all annotations
router.get('/annotations', requireAdmin, (req: Request, res: Response) => {
  try {
    const { search, paperId, userId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT a.*,
        u.username,
        u.display_name,
        p.title as paper_title
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      JOIN papers p ON a.paper_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (paperId) {
      query += ` AND a.paper_id = ?`;
      params.push(paperId);
    }

    if (userId) {
      query += ` AND a.user_id = ?`;
      params.push(userId);
    }

    if (search) {
      query += ` AND a.content LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const annotations = db.prepare(query).all(...params) as any[];

    // Count query
    let countQuery = `SELECT COUNT(*) as count FROM annotations a WHERE 1=1`;
    const countParams: any[] = [];
    if (paperId) {
      countQuery += ` AND a.paper_id = ?`;
      countParams.push(paperId);
    }
    if (userId) {
      countQuery += ` AND a.user_id = ?`;
      countParams.push(userId);
    }
    if (search) {
      countQuery += ` AND a.content LIKE ?`;
      countParams.push(`%${search}%`);
    }
    const total = (db.prepare(countQuery).get(...countParams) as any).count;

    res.json({
      annotations: annotations.map(a => {
        const content = JSON.parse(a.content);
        return {
          id: a.id,
          paperId: a.paper_id,
          paperTitle: a.paper_title,
          userId: a.user_id,
          userName: a.display_name,
          username: a.username,
          pageNumber: a.page_number,
          sentenceId: a.sentence_id,
          content,
          isDanmaku: !!content.highlightRegion,
          createdAt: a.created_at,
        };
      }),
      total,
    });
  } catch (error) {
    console.error('Admin list annotations error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list annotations' });
  }
});

// DELETE /api/admin/annotations/:annotationId - Delete an annotation
router.delete('/annotations/:annotationId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { annotationId } = req.params;

    const annotation = db.prepare('SELECT id FROM annotations WHERE id = ?').get(annotationId);
    if (!annotation) {
      return res.status(404).json({ error: 'Not Found', message: 'Annotation not found' });
    }

    db.prepare('DELETE FROM annotations WHERE id = ?').run(annotationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete annotation error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete annotation' });
  }
});

// ============================================================================
// AI SESSION MANAGEMENT
// ============================================================================

// GET /api/admin/ai-sessions - List all AI sessions
router.get('/ai-sessions', requireAdmin, (req: Request, res: Response) => {
  try {
    const { search, paperId, userId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT h.*,
        u.username,
        u.display_name,
        p.title as paper_title
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      JOIN papers p ON h.paper_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (paperId) {
      query += ` AND h.paper_id = ?`;
      params.push(paperId);
    }

    if (userId) {
      query += ` AND h.user_id = ?`;
      params.push(userId);
    }

    if (search) {
      query += ` AND (h.title LIKE ? OR h.messages LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY h.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const sessions = db.prepare(query).all(...params) as any[];

    // Count query
    let countQuery = `SELECT COUNT(*) as count FROM ai_agent_history h WHERE 1=1`;
    const countParams: any[] = [];
    if (paperId) {
      countQuery += ` AND h.paper_id = ?`;
      countParams.push(paperId);
    }
    if (userId) {
      countQuery += ` AND h.user_id = ?`;
      countParams.push(userId);
    }
    if (search) {
      countQuery += ` AND (h.title LIKE ? OR h.messages LIKE ?)`;
      countParams.push(`%${search}%`, `%${search}%`);
    }
    const total = (db.prepare(countQuery).get(...countParams) as any).count;

    res.json({
      sessions: sessions.map(s => {
        const messages = JSON.parse(s.messages || '[]');
        return {
          id: s.id,
          paperId: s.paper_id,
          paperTitle: s.paper_title,
          userId: s.user_id,
          userName: s.display_name,
          username: s.username,
          title: s.title,
          messageCount: messages.length,
          isPublic: s.is_public === 1,
          isActive: s.is_active === 1,
          modelUsed: s.model_used,
          hasApiKey: !!s.api_key_encrypted,
          hasSentenceAnalysis: !!s.sentence_analysis,
          totalPromptTokens: s.total_prompt_tokens || 0,
          totalCompletionTokens: s.total_completion_tokens || 0,
          conversationRounds: s.conversation_rounds || 0,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        };
      }),
      total,
    });
  } catch (error) {
    console.error('Admin list AI sessions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list AI sessions' });
  }
});

// DELETE /api/admin/ai-sessions/:sessionId - Delete an AI session
router.delete('/ai-sessions/:sessionId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = db.prepare('SELECT id FROM ai_agent_history WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    db.prepare('DELETE FROM ai_agent_history WHERE id = ?').run(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete AI session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete AI session' });
  }
});

// ============================================================================
// AI REVIEW MANAGEMENT
// ============================================================================

// GET /api/admin/ai-reviews - List all AI reviews
router.get('/ai-reviews', requireAdmin, (req: Request, res: Response) => {
  try {
    const { paperId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.*,
        p.title as paper_title
      FROM ai_reviews r
      JOIN papers p ON r.paper_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (paperId) {
      query += ` AND r.paper_id = ?`;
      params.push(paperId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const reviews = db.prepare(query).all(...params) as any[];

    let countQuery = `SELECT COUNT(*) as count FROM ai_reviews WHERE 1=1`;
    const countParams: any[] = [];
    if (paperId) {
      countQuery += ` AND paper_id = ?`;
      countParams.push(paperId);
    }
    const total = (db.prepare(countQuery).get(...countParams) as any).count;

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        paperId: r.paper_id,
        paperTitle: r.paper_title,
        generatedBy: r.generated_by,
        generatedAt: r.generated_at,
        createdAt: r.created_at,
      })),
      total,
    });
  } catch (error) {
    console.error('Admin list AI reviews error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list AI reviews' });
  }
});

// DELETE /api/admin/ai-reviews/:reviewId - Delete an AI review
router.delete('/ai-reviews/:reviewId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = db.prepare('SELECT id FROM ai_reviews WHERE id = ?').get(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Not Found', message: 'AI review not found' });
    }

    db.prepare('DELETE FROM ai_reviews WHERE id = ?').run(reviewId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete AI review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete AI review' });
  }
});

// ============================================================================
// USER REVIEW MANAGEMENT
// ============================================================================

// GET /api/admin/user-reviews - List all user reviews
router.get('/user-reviews', requireAdmin, (req: Request, res: Response) => {
  try {
    const { paperId, userId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT r.*,
        u.username,
        u.display_name,
        p.title as paper_title
      FROM user_reviews r
      JOIN users u ON r.user_id = u.id
      JOIN papers p ON r.paper_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (paperId) {
      query += ` AND r.paper_id = ?`;
      params.push(paperId);
    }

    if (userId) {
      query += ` AND r.user_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const reviews = db.prepare(query).all(...params) as any[];

    let countQuery = `SELECT COUNT(*) as count FROM user_reviews WHERE 1=1`;
    const countParams: any[] = [];
    if (paperId) {
      countQuery += ` AND paper_id = ?`;
      countParams.push(paperId);
    }
    if (userId) {
      countQuery += ` AND user_id = ?`;
      countParams.push(userId);
    }
    const total = (db.prepare(countQuery).get(...countParams) as any).count;

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        paperId: r.paper_id,
        paperTitle: r.paper_title,
        userId: r.user_id,
        userName: r.display_name,
        username: r.username,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total,
    });
  } catch (error) {
    console.error('Admin list user reviews error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list user reviews' });
  }
});

// DELETE /api/admin/user-reviews/:reviewId - Delete a user review
router.delete('/user-reviews/:reviewId', requireAdmin, (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = db.prepare('SELECT id FROM user_reviews WHERE id = ?').get(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Not Found', message: 'User review not found' });
    }

    db.prepare('DELETE FROM user_reviews WHERE id = ?').run(reviewId);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user review' });
  }
});

export default router;
