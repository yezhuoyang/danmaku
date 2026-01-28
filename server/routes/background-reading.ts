// Background reading API routes
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth } from './auth.js';
import { cancelBackgroundJob } from '../lib/background-worker.js';

const router = Router();

// POST /api/background-reading/start - Start background reading for a paper
router.post('/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, sessionId, workflowConfig } = req.body;

    if (!paperId || !sessionId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Paper ID and session ID are required' });
    }

    // Verify session exists and belongs to user
    const session = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ? AND user_id = ?
    `).get(sessionId, paperId, user.id) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'Session not found' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no API key set' });
    }

    // Check if paper exists
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (!paper.arxiv_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Paper must have an ArXiv ID for background reading' });
    }

    // Check for existing pending/running job for this session
    const existingJob = db.prepare(`
      SELECT * FROM background_reading_jobs
      WHERE session_id = ? AND status IN ('pending', 'running')
    `).get(sessionId) as any;

    if (existingJob) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A reading job is already in progress for this session',
        jobId: existingJob.id,
      });
    }

    // Create new job
    const jobId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO background_reading_jobs (
        id, paper_id, session_id, user_id, status,
        model_id, api_key_encrypted, workflow_config_snapshot,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(
      jobId,
      paperId,
      sessionId,
      user.id,
      session.model_id || 'gpt-4o-mini',
      session.api_key_encrypted,
      workflowConfig ? JSON.stringify(workflowConfig) : null,
      now,
      now
    );

    // Update session to reference job
    db.prepare(`
      UPDATE ai_agent_history SET background_job_id = ?, updated_at = ? WHERE id = ?
    `).run(jobId, now, sessionId);

    res.status(201).json({
      jobId,
      status: 'pending',
      message: 'Background reading job created and queued',
    });

  } catch (error: any) {
    console.error('Start background reading error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// GET /api/background-reading/status/:jobId - Get job status
router.get('/status/:jobId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { jobId } = req.params;

    const job = db.prepare(`
      SELECT brj.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM background_reading_jobs brj
      JOIN papers p ON brj.paper_id = p.id
      WHERE brj.id = ? AND brj.user_id = ?
    `).get(jobId, user.id) as any;

    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    res.json({
      id: job.id,
      paperId: job.paper_id,
      paperTitle: job.paper_title,
      paperArxivId: job.paper_arxiv_id,
      sessionId: job.session_id,
      status: job.status,
      progress: {
        currentPage: job.current_page || 0,
        totalPages: job.total_pages || 0,
        pagesCompleted: job.pages_completed || 0,
        percentComplete: job.total_pages > 0 ? Math.round((job.pages_completed / job.total_pages) * 100) : 0,
      },
      tokens: {
        promptTokens: job.total_prompt_tokens || 0,
        completionTokens: job.total_completion_tokens || 0,
        total: (job.total_prompt_tokens || 0) + (job.total_completion_tokens || 0),
      },
      timing: {
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        estimatedCompletionAt: job.estimated_completion_at,
      },
      debugEntries: job.debug_entries ? JSON.parse(job.debug_entries) : [],
      error: job.error_message,
      retryCount: job.retry_count || 0,
    });

  } catch (error: any) {
    console.error('Get job status error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// GET /api/background-reading/user-jobs - List user's jobs
router.get('/user-jobs', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, limit = '20' } = req.query;

    let query = `
      SELECT brj.*, p.title as paper_title, p.arxiv_id as paper_arxiv_id
      FROM background_reading_jobs brj
      JOIN papers p ON brj.paper_id = p.id
      WHERE brj.user_id = ?
    `;
    const params: any[] = [user.id];

    if (status) {
      query += ` AND brj.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY brj.created_at DESC LIMIT ?`;
    params.push(parseInt(limit as string));

    const jobs = db.prepare(query).all(...params) as any[];

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        paperId: job.paper_id,
        paperTitle: job.paper_title,
        paperArxivId: job.paper_arxiv_id,
        sessionId: job.session_id,
        status: job.status,
        progress: {
          currentPage: job.current_page || 0,
          totalPages: job.total_pages || 0,
          percentComplete: job.total_pages > 0 ? Math.round((job.pages_completed / job.total_pages) * 100) : 0,
        },
        tokens: {
          promptTokens: job.total_prompt_tokens || 0,
          completionTokens: job.total_completion_tokens || 0,
          total: (job.total_prompt_tokens || 0) + (job.total_completion_tokens || 0),
        },
        timing: {
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          estimatedCompletionAt: job.estimated_completion_at,
        },
        debugEntries: job.debug_entries ? JSON.parse(job.debug_entries) : [],
        createdAt: job.created_at,
        completedAt: job.completed_at,
        error: job.error_message,
      })),
    });

  } catch (error: any) {
    console.error('List user jobs error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// GET /api/background-reading/paper/:paperId - Get jobs for a specific paper
router.get('/paper/:paperId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId } = req.params;

    const jobs = db.prepare(`
      SELECT brj.*, p.title as paper_title
      FROM background_reading_jobs brj
      JOIN papers p ON brj.paper_id = p.id
      WHERE brj.paper_id = ? AND brj.user_id = ?
      ORDER BY brj.created_at DESC
      LIMIT 10
    `).all(paperId, user.id) as any[];

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        paperId: job.paper_id,
        paperTitle: job.paper_title,
        sessionId: job.session_id,
        status: job.status,
        progress: {
          currentPage: job.current_page || 0,
          totalPages: job.total_pages || 0,
          percentComplete: job.total_pages > 0 ? Math.round((job.pages_completed / job.total_pages) * 100) : 0,
        },
        tokens: {
          promptTokens: job.total_prompt_tokens || 0,
          completionTokens: job.total_completion_tokens || 0,
          total: (job.total_prompt_tokens || 0) + (job.total_completion_tokens || 0),
        },
        timing: {
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          estimatedCompletionAt: job.estimated_completion_at,
        },
        debugEntries: job.debug_entries ? JSON.parse(job.debug_entries) : [],
        createdAt: job.created_at,
        completedAt: job.completed_at,
        error: job.error_message,
      })),
    });

  } catch (error: any) {
    console.error('Get paper jobs error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// POST /api/background-reading/cancel/:jobId - Cancel a job
router.post('/cancel/:jobId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { jobId } = req.params;

    const job = db.prepare(`
      SELECT * FROM background_reading_jobs WHERE id = ? AND user_id = ?
    `).get(jobId, user.id) as any;

    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return res.status(400).json({ error: 'Bad Request', message: 'Job already finished' });
    }

    const cancelled = cancelBackgroundJob(jobId);

    if (cancelled) {
      // Update status in DB
      db.prepare(`
        UPDATE background_reading_jobs
        SET status = 'cancelled', updated_at = ?
        WHERE id = ?
      `).run(Math.floor(Date.now() / 1000), jobId);
    }

    res.json({ success: true, message: 'Job cancellation requested' });

  } catch (error: any) {
    console.error('Cancel job error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

// POST /api/background-reading/resume/:jobId - Resume a paused job
router.post('/resume/:jobId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { jobId } = req.params;

    const job = db.prepare(`
      SELECT * FROM background_reading_jobs WHERE id = ? AND user_id = ?
    `).get(jobId, user.id) as any;

    if (!job) {
      return res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    }

    if (job.status !== 'paused' && job.status !== 'failed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Job cannot be resumed from current state' });
    }

    db.prepare(`
      UPDATE background_reading_jobs
      SET status = 'pending', error_message = NULL, updated_at = ?
      WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), jobId);

    res.json({ success: true, message: 'Job queued for resumption' });

  } catch (error: any) {
    console.error('Resume job error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;
