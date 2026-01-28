import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { COOKIE_NAME, ONE_YEAR_MS } from '../../shared/const.js';
import type { RegisterRequest, LoginRequest, User, UpdateProfileRequest, ChangePasswordRequest, UserWithStats, PaperCollection, UserSummary, Notification, NotificationType } from '../../shared/types.js';

const router = Router();

// Session duration: 30 days
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Helper to get user from session
export function getUserFromSession(sessionId: string | undefined): User | null {
  if (!sessionId) return null;

  const session = db.prepare(`
    SELECT s.*, u.id as user_id, u.username, u.display_name, u.avatar, u.research_interests, u.bio, u.is_admin, u.created_at as user_created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > unixepoch()
  `).get(sessionId) as any;

  if (!session) return null;

  return {
    id: session.user_id,
    username: session.username,
    displayName: session.display_name,
    avatar: session.avatar || undefined,
    researchInterests: session.research_interests ? JSON.parse(session.research_interests) : undefined,
    bio: session.bio || undefined,
    isAdmin: session.is_admin === 1,
    createdAt: session.user_created_at,
  };
}

// Middleware to attach user to request
export function authMiddleware(req: Request, res: Response, next: Function) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  const user = getUserFromSession(sessionId);
  (req as any).user = user;
  next();
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: Function) {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
  }
  next();
}

// Middleware to require admin privileges
export function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
  }
  if (!user.isAdmin) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required' });
  }
  next();
}

// Middleware to optionally attach user (doesn't require auth)
export function optionalAuth(req: Request, res: Response, next: Function) {
  const sessionId = req.cookies?.[COOKIE_NAME];
  const user = getUserFromSession(sessionId);
  (req as any).user = user || null;
  next();
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, displayName } = req.body as RegisterRequest;

    // Validate input
    if (!username || !password || !displayName) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Bad Request', message: 'Username must be 3-30 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 6 characters' });
    }

    // Check if username exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Username already taken' });
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(userId, username, displayName, passwordHash);

    // Create session
    const sessionId = uuidv4();
    const expiresAt = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);

    db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionId, userId, expiresAt);

    // Set cookie
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
    });

    const user: User = {
      id: userId,
      username,
      displayName,
      createdAt: Math.floor(Date.now() / 1000),
    };

    res.status(201).json({ user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing username or password' });
    }

    // Find user
    const user = db.prepare(`
      SELECT id, username, display_name, password_hash, avatar, research_interests, bio, is_admin, created_at
      FROM users WHERE username = ?
    `).get(username) as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    }

    // Create session
    const sessionId = uuidv4();
    const expiresAt = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);

    db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(sessionId, user.id, expiresAt);

    // Set cookie
    res.cookie(COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar || undefined,
        researchInterests: user.research_interests ? JSON.parse(user.research_interests) : undefined,
        bio: user.bio || undefined,
        isAdmin: user.is_admin === 1,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to login' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies?.[COOKIE_NAME];

  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Not logged in' });
  }

  res.json({ user });
});

// GET /api/auth/profile/:userId/full - Get profile with social stats
// NOTE: This route must come BEFORE /profile/:userId to avoid being shadowed
router.get('/profile/:userId/full', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    const user = db.prepare(`
      SELECT id, username, display_name, avatar, research_interests, bio, created_at
      FROM users WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Get follower count
    const followerCount = (db.prepare(`
      SELECT COUNT(*) as count FROM user_follows WHERE following_id = ?
    `).get(userId) as any).count;

    // Get following count
    const followingCount = (db.prepare(`
      SELECT COUNT(*) as count FROM user_follows WHERE follower_id = ?
    `).get(userId) as any).count;

    // Get collection count
    const collectionCount = (db.prepare(`
      SELECT COUNT(*) as count FROM paper_collections WHERE user_id = ?
    `).get(userId) as any).count;

    // Get upload count (papers added by user)
    const uploadCount = (db.prepare(`
      SELECT COUNT(*) as count FROM papers WHERE added_by = ?
    `).get(userId) as any).count;

    // Check if current user follows this user
    let isFollowing = false;
    if (currentUser && currentUser.id !== userId) {
      const follow = db.prepare(`
        SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?
      `).get(currentUser.id, userId);
      isFollowing = !!follow;
    }

    const result: UserWithStats = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar || undefined,
      researchInterests: user.research_interests ? JSON.parse(user.research_interests) : undefined,
      bio: user.bio || undefined,
      createdAt: user.created_at,
      followerCount,
      followingCount,
      collectionCount,
      uploadCount,
      isFollowing,
    };

    res.json({ user: result });
  } catch (error) {
    console.error('Get profile with stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get profile' });
  }
});

// GET /api/auth/profile/:userId - Get public profile of any user
router.get('/profile/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = db.prepare(`
      SELECT id, username, display_name, avatar, research_interests, bio, created_at
      FROM users WHERE id = ?
    `).get(userId) as any;

    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatar: user.avatar || undefined,
        researchInterests: user.research_interests ? JSON.parse(user.research_interests) : undefined,
        bio: user.bio || undefined,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get profile' });
  }
});

// PUT /api/auth/profile - Update current user's profile
router.put('/profile', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { displayName, avatar, researchInterests, bio } = req.body as UpdateProfileRequest;

    // Validate displayName if provided
    if (displayName !== undefined && (displayName.length < 1 || displayName.length > 100)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Display name must be 1-100 characters' });
    }

    // Validate bio if provided
    if (bio !== undefined && bio.length > 500) {
      return res.status(400).json({ error: 'Bad Request', message: 'Bio must be at most 500 characters' });
    }

    // Validate researchInterests if provided
    if (researchInterests !== undefined && (!Array.isArray(researchInterests) || researchInterests.length > 20)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Research interests must be an array of at most 20 items' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(displayName);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar || null);
    }
    if (researchInterests !== undefined) {
      updates.push('research_interests = ?');
      values.push(JSON.stringify(researchInterests));
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    values.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Fetch updated user
    const updated = db.prepare(`
      SELECT id, username, display_name, avatar, research_interests, bio, created_at
      FROM users WHERE id = ?
    `).get(user.id) as any;

    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        displayName: updated.display_name,
        avatar: updated.avatar || undefined,
        researchInterests: updated.research_interests ? JSON.parse(updated.research_interests) : undefined,
        bio: updated.bio || undefined,
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update profile' });
  }
});

// PUT /api/auth/password - Change password
router.put('/password', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing current or new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Bad Request', message: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const dbUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
    const valid = await bcrypt.compare(currentPassword, dbUser.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Current password is incorrect' });
    }

    // Hash and update new password
    const newHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to change password' });
  }
});

// GET /api/auth/annotations - Get all annotations by current user
router.get('/annotations', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const annotations = db.prepare(`
      SELECT a.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM annotations a
      JOIN papers p ON a.paper_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(user.id) as any[];

    res.json({
      annotations: annotations.map(a => ({
        id: a.id,
        paperId: a.paper_id,
        paperTitle: a.paper_title,
        paperArxivId: a.paper_arxiv_id,
        userId: a.user_id,
        userName: user.displayName,
        pageNumber: a.page_number,
        sentenceId: a.sentence_id,
        content: JSON.parse(a.content),
        createdAt: a.created_at,
      })),
    });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get annotations' });
  }
});

// GET /api/auth/danmaku - Get user's danmaku annotations (with highlightRegion)
router.get('/danmaku', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const annotations = db.prepare(`
      SELECT a.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM annotations a
      JOIN papers p ON a.paper_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(user.id) as any[];

    // Filter to only include annotations with highlightRegion (danmaku)
    const danmaku = annotations
      .map(a => ({
        id: a.id,
        paperId: a.paper_id,
        paperTitle: a.paper_title,
        paperArxivId: a.paper_arxiv_id,
        userId: a.user_id,
        userName: user.displayName,
        pageNumber: a.page_number,
        sentenceId: a.sentence_id,
        content: JSON.parse(a.content),
        createdAt: a.created_at,
      }))
      .filter(a => a.content.highlightRegion);

    res.json({ annotations: danmaku });
  } catch (error) {
    console.error('Get danmaku error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get danmaku' });
  }
});

// GET /api/auth/comments - Get user's comments (without highlightRegion)
router.get('/comments', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const annotations = db.prepare(`
      SELECT a.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM annotations a
      JOIN papers p ON a.paper_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(user.id) as any[];

    // Filter to only include annotations without highlightRegion (comments)
    const comments = annotations
      .map(a => ({
        id: a.id,
        paperId: a.paper_id,
        paperTitle: a.paper_title,
        paperArxivId: a.paper_arxiv_id,
        userId: a.user_id,
        userName: user.displayName,
        pageNumber: a.page_number,
        sentenceId: a.sentence_id,
        content: JSON.parse(a.content),
        createdAt: a.created_at,
      }))
      .filter(a => !a.content.highlightRegion);

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get comments' });
  }
});

// GET /api/auth/stats - Get user statistics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    // Count annotations
    const annotationCount = (db.prepare(`
      SELECT COUNT(*) as count FROM annotations WHERE user_id = ?
    `).get(user.id) as any).count;

    // Count papers read
    const papersRead = (db.prepare(`
      SELECT COUNT(*) as count FROM reading_sessions WHERE user_id = ?
    `).get(user.id) as any).count;

    // Count reviews written
    const reviewsWritten = (db.prepare(`
      SELECT COUNT(*) as count FROM user_reviews WHERE user_id = ?
    `).get(user.id) as any).count;

    // Count AI sessions
    const aiSessions = (db.prepare(`
      SELECT COUNT(*) as count FROM ai_agent_history WHERE user_id = ?
    `).get(user.id) as any).count;

    res.json({
      stats: {
        annotationCount,
        papersRead,
        reviewsWritten,
        aiSessions,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get stats' });
  }
});

// ============================================================================
// PAPER COLLECTIONS
// ============================================================================

// GET /api/auth/collections - Get current user's collections
router.get('/collections', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const collections = db.prepare(`
      SELECT c.*, p.title as paper_title, p.authors as paper_authors, p.arxiv_id as paper_arxiv_id
      FROM paper_collections c
      JOIN papers p ON c.paper_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(user.id) as any[];

    res.json({
      collections: collections.map(c => ({
        id: c.id,
        paperId: c.paper_id,
        paperTitle: c.paper_title,
        paperAuthors: c.paper_authors ? JSON.parse(c.paper_authors) : [],
        paperArxivId: c.paper_arxiv_id || undefined,
        note: c.note || undefined,
        createdAt: c.created_at,
      } as PaperCollection)),
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get collections' });
  }
});

// GET /api/auth/collections/check/:paperId - Check if paper is collected
// NOTE: This route must come BEFORE /collections/:userId to avoid being shadowed
router.get('/collections/check/:paperId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.json({ collected: false });
    }

    const { paperId } = req.params;
    const existing = db.prepare(`
      SELECT id FROM paper_collections WHERE user_id = ? AND paper_id = ?
    `).get(user.id, paperId);

    res.json({ collected: !!existing });
  } catch (error) {
    console.error('Check collection error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to check collection' });
  }
});

// GET /api/auth/collections/:userId - Get a user's collections (public)
router.get('/collections/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const collections = db.prepare(`
      SELECT c.*, p.title as paper_title, p.authors as paper_authors, p.arxiv_id as paper_arxiv_id
      FROM paper_collections c
      JOIN papers p ON c.paper_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(userId) as any[];

    res.json({
      collections: collections.map(c => ({
        id: c.id,
        paperId: c.paper_id,
        paperTitle: c.paper_title,
        paperAuthors: c.paper_authors ? JSON.parse(c.paper_authors) : [],
        paperArxivId: c.paper_arxiv_id || undefined,
        note: c.note || undefined,
        createdAt: c.created_at,
      } as PaperCollection)),
    });
  } catch (error) {
    console.error('Get user collections error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get collections' });
  }
});

// POST /api/auth/collections - Add paper to collection
router.post('/collections', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { paperId, note } = req.body;
    if (!paperId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Paper ID is required' });
    }

    // Check if paper exists
    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Check if already collected
    const existing = db.prepare(`
      SELECT id FROM paper_collections WHERE user_id = ? AND paper_id = ?
    `).get(user.id, paperId);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Paper already in collection' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO paper_collections (id, user_id, paper_id, note)
      VALUES (?, ?, ?, ?)
    `).run(id, user.id, paperId, note || null);

    res.status(201).json({ success: true, id });
  } catch (error) {
    console.error('Add to collection error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add to collection' });
  }
});

// DELETE /api/auth/collections/:paperId - Remove paper from collection
router.delete('/collections/:paperId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { paperId } = req.params;

    const result = db.prepare(`
      DELETE FROM paper_collections WHERE user_id = ? AND paper_id = ?
    `).run(user.id, paperId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not in collection' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove from collection error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove from collection' });
  }
});

// ============================================================================
// UPLOADED PAPERS
// ============================================================================

// GET /api/auth/uploads/:userId - Get papers uploaded by a user
router.get('/uploads/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const papers = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM reading_sessions WHERE paper_id = p.id) as reader_count,
        (SELECT COUNT(*) FROM annotations WHERE paper_id = p.id) as annotation_count
      FROM papers p
      WHERE p.added_by = ?
      ORDER BY p.created_at DESC
    `).all(userId) as any[];

    res.json({
      papers: papers.map(p => ({
        id: p.id,
        arxivId: p.arxiv_id || undefined,
        contentHash: p.content_hash || undefined,
        title: p.title,
        authors: p.authors ? JSON.parse(p.authors) : [],
        abstract: p.abstract || undefined,
        addedBy: p.added_by || undefined,
        viewCount: p.view_count,
        createdAt: p.created_at,
        readerCount: p.reader_count,
        annotationCount: p.annotation_count,
      })),
    });
  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get uploads' });
  }
});

// ============================================================================
// USER FOLLOWING
// ============================================================================

// GET /api/auth/following/:userId - Get users that a user follows
router.get('/following/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    const following = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM user_follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `).all(userId) as any[];

    // Check which users the current user follows
    const result: UserSummary[] = following.map(u => {
      let isFollowing = false;
      if (currentUser) {
        const follow = db.prepare(`
          SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?
        `).get(currentUser.id, u.id);
        isFollowing = !!follow;
      }
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatar: u.avatar || undefined,
        bio: u.bio || undefined,
        isFollowing,
      };
    });

    res.json({ users: result });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get following' });
  }
});

// GET /api/auth/followers/:userId - Get users that follow a user
router.get('/followers/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    const followers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM user_follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
    `).all(userId) as any[];

    // Check which users the current user follows
    const result: UserSummary[] = followers.map(u => {
      let isFollowing = false;
      if (currentUser) {
        const follow = db.prepare(`
          SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?
        `).get(currentUser.id, u.id);
        isFollowing = !!follow;
      }
      return {
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatar: u.avatar || undefined,
        bio: u.bio || undefined,
        isFollowing,
      };
    });

    res.json({ users: result });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get followers' });
  }
});

// GET /api/auth/follow/:userId/check - Check if current user follows a user
router.get('/follow/:userId/check', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.json({ isFollowing: false });
    }

    const { userId } = req.params;

    const follow = db.prepare(`
      SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).get(user.id, userId);

    res.json({ isFollowing: !!follow });
  } catch (error) {
    console.error('Check following error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to check following status' });
  }
});

// POST /api/auth/follow/:userId - Follow a user
router.post('/follow/:userId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { userId } = req.params;

    if (user.id === userId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot follow yourself' });
    }

    // Check if target user exists
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Check if already following
    const existing = db.prepare(`
      SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).get(user.id, userId);
    if (existing) {
      return res.status(409).json({ error: 'Conflict', message: 'Already following this user' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO user_follows (id, follower_id, following_id)
      VALUES (?, ?, ?)
    `).run(id, user.id, userId);

    // Notify the followed user
    createNotification({
      userId,
      type: 'follow',
      actorId: user.id,
      targetType: 'user',
      targetId: user.id,
      targetTitle: `${user.displayName} followed you`,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to follow user' });
  }
});

// DELETE /api/auth/follow/:userId - Unfollow a user
router.delete('/follow/:userId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { userId } = req.params;

    const result = db.prepare(`
      DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?
    `).run(user.id, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Not following this user' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to unfollow user' });
  }
});

// ============================================================================
// USER'S OWN REVIEWS
// ============================================================================

// GET /api/auth/reviews - Get current user's reviews
router.get('/reviews', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const reviews = db.prepare(`
      SELECT r.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM user_reviews r
      JOIN papers p ON r.paper_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC
    `).all(user.id) as any[];

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        paperId: r.paper_id,
        paperTitle: r.paper_title,
        paperArxivId: r.paper_arxiv_id,
        userId: r.user_id,
        userName: user.displayName,
        paperSummary: r.paper_summary,
        significanceOfProblem: r.significance_of_problem,
        significanceOfProblemText: r.significance_of_problem_text,
        noveltyOfSolution: r.novelty_of_solution,
        noveltyOfSolutionText: r.novelty_of_solution_text,
        correctness: r.correctness,
        correctnessText: r.correctness_text,
        writingQuality: r.writing_quality,
        writingQualityText: r.writing_quality_text,
        relatedWork: r.related_work,
        relatedWorkText: r.related_work_text,
        robustnessOfEvaluation: r.robustness_of_evaluation,
        robustnessOfEvaluationText: r.robustness_of_evaluation_text,
        advancementDisciplines: r.advancement_disciplines ? JSON.parse(r.advancement_disciplines) : undefined,
        strengths: r.strengths,
        weaknesses: r.weaknesses,
        commentsForAuthors: r.comments_for_authors,
        commentsForReaders: r.comments_for_readers || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get reviews' });
  }
});

// ============================================================================
// USER'S OWN AI SESSIONS
// ============================================================================

// GET /api/auth/ai-sessions - Get current user's AI sessions
router.get('/ai-sessions', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const sessions = db.prepare(`
      SELECT h.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM ai_agent_history h
      JOIN papers p ON h.paper_id = p.id
      WHERE h.user_id = ?
      ORDER BY h.updated_at DESC
    `).all(user.id) as any[];

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        paperId: s.paper_id,
        paperTitle: s.paper_title,
        paperArxivId: s.paper_arxiv_id,
        userId: s.user_id,
        userName: user.displayName,
        title: s.title,
        messages: s.messages ? JSON.parse(s.messages) : [],
        isPublic: s.is_public === 1,
        isActive: s.is_active === 1,
        modelUsed: s.model_used,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        sentenceAnalysis: s.sentence_analysis ? JSON.parse(s.sentence_analysis) : undefined,
        figureTableAnalysis: s.figure_table_analysis ? JSON.parse(s.figure_table_analysis) : undefined,
        apiKeySet: !!s.api_key_encrypted,
        totalPromptTokens: s.total_prompt_tokens || 0,
        totalCompletionTokens: s.total_completion_tokens || 0,
        maxContextTokens: s.max_context_tokens || 128000,
        conversationRounds: s.conversation_rounds || 0,
      })),
    });
  } catch (error) {
    console.error('Get user AI sessions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI sessions' });
  }
});

// DELETE /api/auth/ai-sessions/:sessionId - Delete an AI session
router.delete('/ai-sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { sessionId } = req.params;

    // Verify ownership
    const session = db.prepare(`
      SELECT id, user_id FROM ai_agent_history WHERE id = ?
    `).get(sessionId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'Session not found' });
    }

    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own sessions' });
    }

    db.prepare('DELETE FROM ai_agent_history WHERE id = ?').run(sessionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete AI session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete session' });
  }
});

// DELETE /api/auth/reviews/:reviewId - Delete a review
router.delete('/reviews/:reviewId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { reviewId } = req.params;

    // Verify ownership
    const review = db.prepare(`
      SELECT id, user_id FROM user_reviews WHERE id = ?
    `).get(reviewId) as any;

    if (!review) {
      return res.status(404).json({ error: 'Not Found', message: 'Review not found' });
    }

    if (review.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own reviews' });
    }

    db.prepare('DELETE FROM user_reviews WHERE id = ?').run(reviewId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete review' });
  }
});

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// Helper function to create a notification
export function createNotification(params: {
  userId: string;           // The user receiving the notification
  type: NotificationType;
  actorId: string;          // The user who performed the action
  targetType?: string;
  targetId?: string;
  targetTitle?: string;
  paperId?: string;
}): void {
  // Don't notify users of their own actions
  if (params.userId === params.actorId) return;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, actor_id, target_type, target_id, target_title, paper_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.userId,
    params.type,
    params.actorId,
    params.targetType || null,
    params.targetId || null,
    params.targetTitle || null,
    params.paperId || null
  );
}

// GET /api/auth/notifications - Get notifications for current user
router.get('/notifications', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    // Get notifications with actor info
    const notifications = db.prepare(`
      SELECT n.*, u.display_name as actor_name, u.avatar as actor_avatar, p.title as paper_title
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN papers p ON n.paper_id = p.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `).all(user.id, limitNum, offsetNum) as any[];

    // Get total and unread counts
    const totalCount = (db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ?
    `).get(user.id) as any).count;

    const unreadCount = (db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(user.id) as any).count;

    res.json({
      notifications: notifications.map(n => ({
        id: n.id,
        userId: n.user_id,
        type: n.type as NotificationType,
        actorId: n.actor_id,
        actorName: n.actor_name,
        actorAvatar: n.actor_avatar || undefined,
        targetType: n.target_type || undefined,
        targetId: n.target_id || undefined,
        targetTitle: n.target_title || undefined,
        paperId: n.paper_id || undefined,
        paperTitle: n.paper_title || undefined,
        isRead: n.is_read === 1,
        createdAt: n.created_at,
      } as Notification)),
      total: totalCount,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get notifications' });
  }
});

// GET /api/auth/notifications/unread-count - Get unread notification count
router.get('/notifications/unread-count', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.json({ count: 0 });
    }

    const result = db.prepare(`
      SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
    `).get(user.id) as any;

    res.json({ count: result.count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get unread count' });
  }
});

// POST /api/auth/notifications/mark-read - Mark notifications as read
router.post('/notifications/mark-read', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { notificationIds } = req.body;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      // Mark all as read
      db.prepare(`
        UPDATE notifications SET is_read = 1 WHERE user_id = ?
      `).run(user.id);
    } else if (notificationIds.length > 0) {
      // Mark specific notifications as read
      const placeholders = notificationIds.map(() => '?').join(',');
      db.prepare(`
        UPDATE notifications SET is_read = 1
        WHERE user_id = ? AND id IN (${placeholders})
      `).run(user.id, ...notificationIds);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to mark notifications as read' });
  }
});

// DELETE /api/auth/notifications/:notificationId - Delete a notification
router.delete('/notifications/:notificationId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { notificationId } = req.params;

    const result = db.prepare(`
      DELETE FROM notifications WHERE id = ? AND user_id = ?
    `).run(notificationId, user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete notification' });
  }
});

// DELETE /api/auth/notifications - Clear all notifications
router.delete('/notifications', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    db.prepare(`DELETE FROM notifications WHERE user_id = ?`).run(user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to clear notifications' });
  }
});

// GET /api/auth/users/search - Search users by username or display name
router.get('/users/search', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in' });
    }

    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({ users: [] });
    }

    const searchTerm = `%${q.trim()}%`;
    const limitNum = Math.min(parseInt(limit as string) || 10, 20);

    // Search by username or display name, exclude current user
    const users = db.prepare(`
      SELECT id, username, display_name, avatar
      FROM users
      WHERE (username LIKE ? OR display_name LIKE ?)
        AND id != ?
      ORDER BY
        CASE WHEN username LIKE ? THEN 0 ELSE 1 END,
        display_name
      LIMIT ?
    `).all(searchTerm, searchTerm, user.id, `${q.trim()}%`, limitNum) as any[];

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatar: u.avatar || undefined,
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to search users' });
  }
});

export default router;
