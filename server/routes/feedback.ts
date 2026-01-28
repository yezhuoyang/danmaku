import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { v4 as uuid } from 'uuid';
import { requireAuth, requireAdmin, optionalAuth } from './auth.js';

const router = Router();

// ============================================================================
// PUBLIC ENDPOINTS (no auth required)
// ============================================================================

// GET /api/feedback - List all feedback requests
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { type, status, sort = 'newest', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];

    if (type && (type === 'bug' || type === 'feature')) {
      conditions.push('f.type = ?');
      params.push(type);
    }

    if (status && ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(status as string)) {
      conditions.push('f.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Determine sort order
    let orderClause = 'ORDER BY f.created_at DESC';
    if (sort === 'oldest') {
      orderClause = 'ORDER BY f.created_at ASC';
    } else if (sort === 'most_upvoted') {
      orderClause = 'ORDER BY f.upvotes DESC, f.created_at DESC';
    } else if (sort === 'priority') {
      orderClause = `ORDER BY
        CASE f.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END, f.created_at DESC`;
    }

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM feedback_requests f ${whereClause}
    `).get(...params) as { total: number };

    // Get feedback items with submitter info
    const feedbackItems = db.prepare(`
      SELECT
        f.id,
        f.type,
        f.title,
        f.description,
        f.images,
        f.status,
        f.priority,
        f.submitter_id as submitterId,
        COALESCE(u.display_name, f.submitter_name, 'Anonymous') as submitterName,
        f.submitter_email as submitterEmail,
        f.upvotes,
        f.admin_response as adminResponse,
        f.resolved_at as resolvedAt,
        f.created_at as createdAt,
        f.updated_at as updatedAt
      FROM feedback_requests f
      LEFT JOIN users u ON f.submitter_id = u.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    // Parse images JSON for each item
    feedbackItems.forEach(f => {
      f.images = f.images ? JSON.parse(f.images) : [];
    });

    // Check if current user has upvoted each item
    const userId = (req as any).user?.id;
    let userUpvotes: Set<string> = new Set();

    if (userId && feedbackItems.length > 0) {
      const feedbackIds = feedbackItems.map(f => f.id);
      const placeholders = feedbackIds.map(() => '?').join(',');
      const upvotedItems = db.prepare(`
        SELECT feedback_id FROM feedback_upvotes
        WHERE user_id = ? AND feedback_id IN (${placeholders})
      `).all(userId, ...feedbackIds) as { feedback_id: string }[];

      userUpvotes = new Set(upvotedItems.map(u => u.feedback_id));
    }

    // Add hasUpvoted flag
    const feedbackWithUpvoteStatus = feedbackItems.map(f => ({
      ...f,
      hasUpvoted: userUpvotes.has(f.id),
    }));

    res.json({
      feedback: feedbackWithUpvoteStatus,
      total: countResult.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult.total / limitNum),
    });
  } catch (error) {
    console.error('List feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list feedback' });
  }
});

// GET /api/feedback/:id - Get single feedback item
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const feedback = db.prepare(`
      SELECT
        f.id,
        f.type,
        f.title,
        f.description,
        f.images,
        f.status,
        f.priority,
        f.submitter_id as submitterId,
        COALESCE(u.display_name, f.submitter_name, 'Anonymous') as submitterName,
        f.submitter_email as submitterEmail,
        f.upvotes,
        f.admin_response as adminResponse,
        f.resolved_at as resolvedAt,
        f.created_at as createdAt,
        f.updated_at as updatedAt
      FROM feedback_requests f
      LEFT JOIN users u ON f.submitter_id = u.id
      WHERE f.id = ?
    `).get(id) as any;

    if (!feedback) {
      return res.status(404).json({ error: 'Not Found', message: 'Feedback not found' });
    }

    // Parse images JSON
    feedback.images = feedback.images ? JSON.parse(feedback.images) : [];

    // Check if current user has upvoted
    const userId = (req as any).user?.id;
    let hasUpvoted = false;

    if (userId) {
      const upvote = db.prepare(`
        SELECT 1 FROM feedback_upvotes WHERE feedback_id = ? AND user_id = ?
      `).get(id, userId);
      hasUpvoted = !!upvote;
    }

    res.json({
      ...feedback,
      hasUpvoted,
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get feedback' });
  }
});

// POST /api/feedback - Submit new feedback (works for both logged-in and anonymous users)
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { type, title, description, images, submitterName, submitterEmail } = req.body;

    // Validate required fields
    if (!type || !['bug', 'feature'].includes(type)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Type must be "bug" or "feature"' });
    }

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return res.status(400).json({ error: 'Bad Request', message: 'Title must be at least 5 characters' });
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Bad Request', message: 'Description must be at least 10 characters' });
    }

    // Validate images (array of base64 strings, max 5 images, max 5MB each)
    let imagesJson: string | null = null;
    console.log('Images received:', images);
    console.log('Images type:', typeof images);
    console.log('Images is array:', Array.isArray(images));
    if (Array.isArray(images)) {
      console.log('Images length:', images.length);
    }
    if (images && Array.isArray(images)) {
      images.forEach((img: any, idx: number) => {
        const isString = typeof img === 'string';
        const startsWithDataImage = isString && img.startsWith('data:image/');
        const sizeOk = isString && img.length <= 7 * 1024 * 1024;
        console.log(`Image ${idx}: isString=${isString}, startsWithDataImage=${startsWithDataImage}, size=${isString ? img.length : 'N/A'}, sizeOk=${sizeOk}`);
      });
      const validImages = images.slice(0, 5).filter((img: string) => {
        if (typeof img !== 'string') return false;
        // Check if it's a valid data URL (base64)
        if (!img.startsWith('data:image/')) return false;
        // Check size (rough estimate: base64 is ~1.37x original size)
        if (img.length > 7 * 1024 * 1024) return false; // ~5MB limit
        return true;
      });
      console.log('Valid images after filtering:', validImages.length);
      if (validImages.length > 0) {
        imagesJson = JSON.stringify(validImages);
      }
    }

    const userId = (req as any).user?.id || null;
    const id = uuid();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO feedback_requests (
        id, type, title, description, images, submitter_id, submitter_name, submitter_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      type,
      title.trim(),
      description.trim(),
      imagesJson,
      userId,
      submitterName?.trim() || null,
      submitterEmail?.trim() || null,
      now,
      now
    );

    // Fetch the created feedback
    const created = db.prepare(`
      SELECT
        f.id,
        f.type,
        f.title,
        f.description,
        f.images,
        f.status,
        f.priority,
        f.submitter_id as submitterId,
        COALESCE(u.display_name, f.submitter_name, 'Anonymous') as submitterName,
        f.upvotes,
        f.created_at as createdAt
      FROM feedback_requests f
      LEFT JOIN users u ON f.submitter_id = u.id
      WHERE f.id = ?
    `).get(id) as any;

    // Parse images JSON
    created.images = created.images ? JSON.parse(created.images) : [];

    res.status(201).json(created);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create feedback' });
  }
});

// ============================================================================
// AUTHENTICATED ENDPOINTS
// ============================================================================

// POST /api/feedback/:id/upvote - Toggle upvote (requires auth)
router.post('/:id/upvote', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Check feedback exists
    const feedback = db.prepare('SELECT id, upvotes FROM feedback_requests WHERE id = ?').get(id) as any;
    if (!feedback) {
      return res.status(404).json({ error: 'Not Found', message: 'Feedback not found' });
    }

    // Check if already upvoted
    const existingUpvote = db.prepare(`
      SELECT 1 FROM feedback_upvotes WHERE feedback_id = ? AND user_id = ?
    `).get(id, userId);

    if (existingUpvote) {
      // Remove upvote
      db.prepare('DELETE FROM feedback_upvotes WHERE feedback_id = ? AND user_id = ?').run(id, userId);
      db.prepare('UPDATE feedback_requests SET upvotes = upvotes - 1 WHERE id = ?').run(id);

      res.json({ upvoted: false, upvotes: feedback.upvotes - 1 });
    } else {
      // Add upvote
      db.prepare(`
        INSERT INTO feedback_upvotes (feedback_id, user_id) VALUES (?, ?)
      `).run(id, userId);
      db.prepare('UPDATE feedback_requests SET upvotes = upvotes + 1 WHERE id = ?').run(id);

      res.json({ upvoted: true, upvotes: feedback.upvotes + 1 });
    }
  } catch (error) {
    console.error('Upvote feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to upvote feedback' });
  }
});

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

// PATCH /api/feedback/:id - Update feedback (admin only)
router.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, priority, adminResponse } = req.body;

    // Check feedback exists
    const feedback = db.prepare('SELECT id FROM feedback_requests WHERE id = ?').get(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Not Found', message: 'Feedback not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status && ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(status)) {
      updates.push('status = ?');
      params.push(status);

      // Set resolved_at if status is resolved
      if (status === 'resolved' || status === 'closed') {
        updates.push('resolved_at = ?');
        params.push(Math.floor(Date.now() / 1000));
      }
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (adminResponse !== undefined) {
      updates.push('admin_response = ?');
      params.push(adminResponse || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No valid fields to update' });
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id);

    db.prepare(`
      UPDATE feedback_requests SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // Fetch updated feedback
    const updated = db.prepare(`
      SELECT
        f.id,
        f.type,
        f.title,
        f.description,
        f.status,
        f.priority,
        f.submitter_id as submitterId,
        COALESCE(u.display_name, f.submitter_name, 'Anonymous') as submitterName,
        f.upvotes,
        f.admin_response as adminResponse,
        f.resolved_at as resolvedAt,
        f.created_at as createdAt,
        f.updated_at as updatedAt
      FROM feedback_requests f
      LEFT JOIN users u ON f.submitter_id = u.id
      WHERE f.id = ?
    `).get(id);

    res.json(updated);
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update feedback' });
  }
});

// DELETE /api/feedback/:id - Delete feedback (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const feedback = db.prepare('SELECT id FROM feedback_requests WHERE id = ?').get(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Not Found', message: 'Feedback not found' });
    }

    db.prepare('DELETE FROM feedback_requests WHERE id = ?').run(id);

    res.json({ success: true, message: 'Feedback deleted' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete feedback' });
  }
});

// GET /api/feedback/stats - Get feedback statistics (admin only)
router.get('/admin/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN type = 'bug' THEN 1 ELSE 0 END) as bugs,
        SUM(CASE WHEN type = 'feature' THEN 1 ELSE 0 END) as features,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high
      FROM feedback_requests
    `).get() as any;

    res.json(stats);
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get stats' });
  }
});

export default router;
