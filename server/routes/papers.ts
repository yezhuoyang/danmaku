import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth, createNotification } from './auth.js';
import type {
  AddPaperRequest,
  Paper,
  PaperWithStats,
  FigureTableRegion,
  CreateFigureTableRegionRequest,
  UpdateFigureTableRegionRequest,
  AiReview,
  QuizQuestion,
  QuizSession,
  QuizAnswer,
  QuizQuestionResponse,
  SubmitQuizAnswerResponse,
  QuizResultsResponse,
} from '../../shared/types.js';
import { DEFAULT_AI_MODELS } from '../../shared/types.js';

// Helper to decrypt API key (simple base64 decode, matching how it's stored)
function decryptApiKeyForQuiz(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf8');
}
import { chatCompletion, getProviderForModel, AIProviderError } from '../lib/ai-providers/index.js';

const router = Router();

// GET /api/papers/stats/site - Get site-wide statistics
router.get('/stats/site', (_req: Request, res: Response) => {
  try {
    // Get all annotations and count based on content JSON (highlightRegion is stored in content)
    const allAnnotations = db.prepare('SELECT content FROM annotations').all() as any[];
    let annotationCount = 0;
    let commentCount = 0;

    for (const a of allAnnotations) {
      try {
        const content = JSON.parse(a.content);
        if (content.highlightRegion) {
          annotationCount++;
        } else {
          commentCount++;
        }
      } catch {
        commentCount++;
      }
    }

    const stats = {
      userCount: (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count,
      paperCount: (db.prepare('SELECT COUNT(*) as count FROM papers').get() as any).count,
      annotationCount,
      commentCount,
      aiReviewCount: (db.prepare('SELECT COUNT(*) as count FROM ai_reviews').get() as any).count,
      humanReviewCount: (db.prepare('SELECT COUNT(*) as count FROM user_reviews').get() as any).count,
      discussionCount: allAnnotations.length, // Total annotations as discussions
    };
    res.json(stats);
  } catch (error) {
    console.error('Get site stats error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get site stats' });
  }
});

// GET /api/papers/recent/danmaku - Get recent danmaku with user info
router.get('/recent/danmaku', (_req: Request, res: Response) => {
  try {
    // Fetch more than needed since we filter in-memory
    const limit = 50;
    const allRecent = db.prepare(`
      SELECT
        a.id,
        a.paper_id,
        a.page_number,
        a.content,
        a.created_at,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar,
        p.title as paper_title
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      JOIN papers p ON a.paper_id = p.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    // Filter to only include danmaku (has highlightRegion in content)
    const danmaku = allRecent
      .map(d => {
        try {
          const content = JSON.parse(d.content);
          return {
            id: d.id,
            paperId: d.paper_id,
            paperTitle: d.paper_title,
            pageNumber: d.page_number,
            content,
            createdAt: d.created_at,
            user: {
              id: d.user_id,
              username: d.username,
              displayName: d.display_name,
              avatar: d.avatar,
            },
          };
        } catch {
          return null;
        }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null && d.content.highlightRegion)
      .slice(0, 10);

    res.json({ danmaku });
  } catch (error) {
    console.error('Get recent danmaku error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get recent danmaku' });
  }
});

// Helper to get paper with stats
function getPaperWithStats(paperId: string): PaperWithStats | null {
  const paper = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(DISTINCT user_id) FROM reading_sessions WHERE paper_id = p.id) as reader_count,
      (SELECT COUNT(*) FROM annotations WHERE paper_id = p.id) as annotation_count,
      (SELECT 1 FROM ai_analysis WHERE paper_id = p.id) as has_ai_analysis
    FROM papers p
    WHERE p.id = ?
  `).get(paperId) as any;

  if (!paper) return null;

  return {
    id: paper.id,
    arxivId: paper.arxiv_id,
    contentHash: paper.content_hash,
    title: paper.title,
    authors: paper.authors ? JSON.parse(paper.authors) : [],
    abstract: paper.abstract,
    addedBy: paper.added_by,
    viewCount: paper.view_count,
    tags: paper.tags ? JSON.parse(paper.tags) : [],
    createdAt: paper.created_at,
    readerCount: paper.reader_count || 0,
    annotationCount: paper.annotation_count || 0,
    hasAiAnalysis: !!paper.has_ai_analysis,
  };
}

// GET /api/papers - List papers with optional search
router.get('/', (req: Request, res: Response) => {
  try {
    const { q, limit = 20, offset = 0, sort = 'recent' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100);
    const offsetNum = parseInt(offset as string) || 0;

    let whereClause = '';
    const params: any[] = [];

    if (q && typeof q === 'string' && q.trim()) {
      whereClause = 'WHERE p.title LIKE ? OR p.authors LIKE ?';
      const searchTerm = `%${q.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    let orderClause = 'ORDER BY p.created_at DESC';
    if (sort === 'popular') {
      orderClause = 'ORDER BY reader_count DESC, p.created_at DESC';
    }

    const papers = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(DISTINCT user_id) FROM reading_sessions WHERE paper_id = p.id) as reader_count,
        (SELECT COUNT(*) FROM annotations WHERE paper_id = p.id) as annotation_count,
        (SELECT 1 FROM ai_analysis WHERE paper_id = p.id) as has_ai_analysis,
        (SELECT COUNT(*) FROM ai_reviews WHERE paper_id = p.id) as ai_review_count,
        (SELECT AVG((significance_of_problem + novelty_of_solution + correctness + writing_quality + related_work + robustness_of_evaluation) / 6.0) FROM ai_reviews WHERE paper_id = p.id) as ai_review_avg_score
      FROM papers p
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offsetNum) as any[];

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM papers p ${whereClause}
    `).get(...params) as any;

    const papersWithStats: PaperWithStats[] = papers.map(p => ({
      id: p.id,
      arxivId: p.arxiv_id,
      contentHash: p.content_hash,
      title: p.title,
      authors: p.authors ? JSON.parse(p.authors) : [],
      abstract: p.abstract,
      addedBy: p.added_by,
      viewCount: p.view_count,
      tags: p.tags ? JSON.parse(p.tags) : [],
      createdAt: p.created_at,
      readerCount: p.reader_count || 0,
      annotationCount: p.annotation_count || 0,
      hasAiAnalysis: !!p.has_ai_analysis,
      aiReviewCount: p.ai_review_count || 0,
      aiReviewAvgScore: p.ai_review_avg_score || undefined,
    }));

    res.json({ papers: papersWithStats, total: total.count });
  } catch (error) {
    console.error('List papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list papers' });
  }
});

// GET /api/papers/top-contributors - Get top contributors ranked by contribution score
// NOTE: This route MUST be before /:id to avoid being matched as a paper ID
router.get('/top-contributors', (req: Request, res: Response) => {
  try {
    const { limit = '10', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const offsetNum = parseInt(offset as string) || 0;

    // Calculate contribution scores:
    // - Papers uploaded: 10 points each
    // - Reviews written: 5 points each
    // - Public AI sessions: 3 points each
    // - Comments posted: 1 point each
    const contributorsQuery = db.prepare(`
      WITH papers_count AS (
        SELECT added_by as user_id, COUNT(*) as count
        FROM papers
        WHERE added_by IS NOT NULL
        GROUP BY added_by
      ),
      reviews_count AS (
        SELECT user_id, COUNT(*) as count
        FROM user_reviews
        GROUP BY user_id
      ),
      sessions_count AS (
        SELECT user_id, COUNT(*) as count
        FROM ai_agent_history
        WHERE is_public = 1
        GROUP BY user_id
      ),
      comments_count AS (
        SELECT user_id, COUNT(*) as count
        FROM annotations
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      )
      SELECT
        u.id as user_id,
        u.display_name as user_name,
        u.avatar as user_avatar,
        COALESCE(pc.count, 0) as papers_uploaded,
        COALESCE(rc.count, 0) as reviews_written,
        COALESCE(sc.count, 0) as public_ai_sessions,
        COALESCE(cc.count, 0) as comments_posted,
        (COALESCE(pc.count, 0) * 10 + COALESCE(rc.count, 0) * 5 + COALESCE(sc.count, 0) * 3 + COALESCE(cc.count, 0) * 1) as total_score
      FROM users u
      LEFT JOIN papers_count pc ON u.id = pc.user_id
      LEFT JOIN reviews_count rc ON u.id = rc.user_id
      LEFT JOIN sessions_count sc ON u.id = sc.user_id
      LEFT JOIN comments_count cc ON u.id = cc.user_id
      WHERE (COALESCE(pc.count, 0) + COALESCE(rc.count, 0) + COALESCE(sc.count, 0) + COALESCE(cc.count, 0)) > 0
      ORDER BY total_score DESC, u.display_name ASC
      LIMIT ? OFFSET ?
    `);

    const countQuery = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN papers p ON u.id = p.added_by
      LEFT JOIN user_reviews ur ON u.id = ur.user_id
      LEFT JOIN ai_agent_history ah ON u.id = ah.user_id AND ah.is_public = 1
      LEFT JOIN annotations a ON u.id = a.user_id
      WHERE p.id IS NOT NULL OR ur.id IS NOT NULL OR ah.id IS NOT NULL OR a.id IS NOT NULL
    `);

    const contributors = contributorsQuery.all(limitNum, offsetNum) as any[];
    const { total } = countQuery.get() as { total: number };

    res.json({
      contributors: contributors.map((c, index) => ({
        userId: c.user_id,
        userName: c.user_name,
        userAvatar: c.user_avatar,
        papersUploaded: c.papers_uploaded,
        reviewsWritten: c.reviews_written,
        publicAiSessions: c.public_ai_sessions,
        commentsPosted: c.comments_posted,
        totalScore: c.total_score,
        rank: offsetNum + index + 1,
      })),
      totalContributors: total,
    });
  } catch (error) {
    console.error('Get top contributors error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get top contributors' });
  }
});

// ============================================================================
// QUIZ / TEST MY UNDERSTANDING ENDPOINTS
// NOTE: These routes MUST be defined before /:id to avoid route conflicts
// ============================================================================

// GET /api/papers/:paperId/quiz/sessions - Get user's quiz sessions for a paper
router.get('/:paperId/quiz/sessions', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const user = (req as any).user;

    const sessions = db.prepare(`
      SELECT qs.*, h.title as session_title
      FROM quiz_sessions qs
      JOIN ai_agent_history h ON qs.history_id = h.id
      WHERE qs.paper_id = ? AND qs.user_id = ?
      ORDER BY qs.created_at DESC
    `).all(paperId, user.id) as any[];

    const result = sessions.map(s => ({
      id: s.id,
      historyId: s.history_id,
      sessionTitle: s.session_title,
      currentQuestionNumber: s.current_question_number,
      isComplete: s.current_question_number >= 11,
      finalScore: s.final_score,
      createdAt: s.created_at,
      completedAt: s.completed_at,
    }));

    res.json({ sessions: result });
  } catch (error) {
    console.error('Get quiz sessions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get quiz sessions' });
  }
});

// GET /api/papers/:paperId/quiz/:sessionId/results - Get final quiz results
router.get('/:paperId/quiz/:sessionId/results', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId, sessionId } = req.params;
    const user = (req as any).user;

    const quizSession = db.prepare(`
      SELECT * FROM quiz_sessions WHERE id = ? AND paper_id = ?
    `).get(sessionId, paperId) as any;

    if (!quizSession) {
      return res.status(404).json({ error: 'Not Found', message: 'Quiz session not found' });
    }

    if (quizSession.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This is not your quiz session' });
    }

    if (quizSession.current_question_number < 11) {
      return res.status(400).json({ error: 'Bad Request', message: 'Quiz not yet completed' });
    }

    const questions: QuizQuestion[] = JSON.parse(quizSession.questions);
    const answers: QuizAnswer[] = JSON.parse(quizSession.answers);
    const suggestions: string[] = quizSession.suggestions ? JSON.parse(quizSession.suggestions) : [];

    const response: QuizResultsResponse = {
      sessionId,
      finalScore: quizSession.final_score || 0,
      correctAnswers: answers.filter(a => a.isCorrect).length,
      totalQuestions: 10,
      diagnosis: quizSession.final_diagnosis || 'Quiz completed.',
      suggestions,
      questionResults: questions.map(q => {
        const userAnswer = answers.find(a => a.questionId === q.id);
        return {
          questionNumber: q.questionNumber,
          question: q.question,
          userAnswer: userAnswer?.userAnswer || 'N/A',
          correctAnswer: q.correctAnswer,
          isCorrect: userAnswer?.isCorrect || false,
          topic: q.topic,
        };
      }),
    };

    res.json(response);
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get quiz results' });
  }
});

// POST /api/papers/:paperId/quiz/start - Start a new quiz session
router.post('/:paperId/quiz/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const { historyId } = req.body;
    const user = (req as any).user;

    // Validate paper exists
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Validate AI session exists and belongs to user
    const session = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ? AND h.paper_id = ?
    `).get(historyId, paperId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only use your own AI sessions' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'AI session does not have an API key configured' });
    }

    // Check if session has sentence analysis (required for generating questions)
    const sentenceAnalysis = session.sentence_analysis ? JSON.parse(session.sentence_analysis) : {};
    if (Object.keys(sentenceAnalysis).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'You must first use "Let Agent Read" to analyze the paper before taking a quiz'
      });
    }

    // Create a new quiz session
    const quizId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO quiz_sessions (id, paper_id, history_id, user_id, current_question_number, questions, answers, created_at)
      VALUES (?, ?, ?, ?, 0, '[]', '[]', ?)
    `).run(quizId, paperId, historyId, user.id, now);

    // Generate the first question
    const apiKey = decryptApiKeyForQuiz(session.api_key_encrypted);
    const modelId = session.model_id || 'gpt-4o';

    // Build context from paper and analysis
    const paperContext = `Paper: "${paper.title}"
Authors: ${paper.authors ? JSON.parse(paper.authors).join(', ') : 'Unknown'}
Abstract: ${paper.abstract || 'Not available'}

This paper has been analyzed. Key points from the analysis:
${Object.entries(sentenceAnalysis).slice(0, 20).map(([_id, data]: [string, any]) =>
  `- ${data.label}: ${data.comment || ''}`
).join('\n')}`;

    const questionPrompt = `You are creating a quiz to test understanding of an academic paper.

${paperContext}

Generate Question 1 of 10 for testing the reader's understanding of this paper.

REQUIREMENTS:
1. Create a multiple-choice question with exactly 4 options (A, B, C, D)
2. Only ONE answer should be correct
3. The question should test understanding, not just memorization
4. Vary difficulty: some easy, some medium, some hard
5. Cover different aspects: methodology, results, concepts, implications

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use any markdown formatting (no **, no *, no #, no backticks)
- Output ONLY valid JSON, nothing else

Respond with ONLY this JSON format:
{
  "question": "The question text here?",
  "choices": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option",
    "D": "Fourth option"
  },
  "correctAnswer": "A",
  "explanation": "Explanation of why this is correct",
  "difficulty": "easy",
  "topic": "Topic this question covers"
}`;

    const provider = getProviderForModel(modelId);
    if (!provider) {
      return res.status(400).json({ error: 'Bad Request', message: `Unsupported model: ${modelId}` });
    }

    const aiResponse = await chatCompletion(
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a quiz generator. Output only valid JSON, no markdown.' },
          { role: 'user', content: questionPrompt }
        ],
        maxTokens: 1000,
        temperature: 0.7,
      },
      { apiKey }
    );

    // Parse the AI response
    let questionData: any;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = aiResponse.content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      questionData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse quiz question:', aiResponse.content);
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to parse AI response' });
    }

    // Create the question object
    const question: QuizQuestion = {
      id: uuidv4(),
      questionNumber: 1,
      question: questionData.question,
      choices: questionData.choices,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation,
      difficulty: questionData.difficulty || 'medium',
      topic: questionData.topic || 'General',
    };

    // Update quiz session with first question
    db.prepare(`
      UPDATE quiz_sessions
      SET questions = ?, current_question_number = 1, created_at = ?
      WHERE id = ?
    `).run(JSON.stringify([question]), now, quizId);

    // Return response (hide correct answer)
    const quizResponse: QuizQuestionResponse = {
      sessionId: quizId,
      question: {
        id: question.id,
        questionNumber: question.questionNumber,
        question: question.question,
        choices: question.choices,
        difficulty: question.difficulty,
        topic: question.topic,
      },
      totalQuestions: 10,
      answeredCount: 0,
    };

    res.json(quizResponse);
  } catch (error) {
    console.error('Start quiz error:', error);
    if (error instanceof AIProviderError) {
      return res.status(502).json({ error: 'AI Provider Error', message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start quiz' });
  }
});

// POST /api/papers/:paperId/quiz/:sessionId/answer - Submit answer and get next question
router.post('/:paperId/quiz/:sessionId/answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paperId, sessionId } = req.params;
    const { questionId, answer } = req.body;
    const user = (req as any).user;

    // Validate answer
    if (!['A', 'B', 'C', 'D'].includes(answer)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Answer must be A, B, C, or D' });
    }

    // Get quiz session
    const quizSession = db.prepare(`
      SELECT * FROM quiz_sessions WHERE id = ? AND paper_id = ?
    `).get(sessionId, paperId) as any;

    if (!quizSession) {
      return res.status(404).json({ error: 'Not Found', message: 'Quiz session not found' });
    }

    if (quizSession.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This is not your quiz session' });
    }

    if (quizSession.current_question_number >= 11) {
      return res.status(400).json({ error: 'Bad Request', message: 'Quiz already completed' });
    }

    // Get questions and answers
    const questions: QuizQuestion[] = JSON.parse(quizSession.questions);
    const quizAnswers: QuizAnswer[] = JSON.parse(quizSession.answers);

    // Find the current question
    const currentQuestion = questions.find(q => q.id === questionId);
    if (!currentQuestion) {
      return res.status(400).json({ error: 'Bad Request', message: 'Question not found' });
    }

    // Check if already answered
    if (quizAnswers.find(a => a.questionId === questionId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Question already answered' });
    }

    // Record the answer
    const isCorrect = answer === currentQuestion.correctAnswer;
    const newAnswer: QuizAnswer = {
      questionId,
      questionNumber: currentQuestion.questionNumber,
      userAnswer: answer,
      isCorrect,
    };
    quizAnswers.push(newAnswer);

    const currentScore = quizAnswers.filter(a => a.isCorrect).length;
    const totalAnswered = quizAnswers.length;
    const isComplete = totalAnswered >= 10;

    // Update quiz session
    const now = Math.floor(Date.now() / 1000);
    if (isComplete) {
      // Generate final diagnosis
      const aiSession = db.prepare(`
        SELECT h.*, p.title as paper_title
        FROM ai_agent_history h
        JOIN papers p ON h.paper_id = p.id
        WHERE h.id = ?
      `).get(quizSession.history_id) as any;

      const apiKey = decryptApiKeyForQuiz(aiSession.api_key_encrypted);
      const modelId = aiSession.model_id || 'gpt-4o';

      // Build results summary
      const resultsSummary = questions.map((q, i) => {
        const userAns = quizAnswers.find(a => a.questionId === q.id);
        return `Q${i + 1} (${q.topic}): ${userAns?.isCorrect ? 'Correct' : 'Wrong'} - ${q.question.substring(0, 50)}...`;
      }).join('\n');

      const diagnosisPrompt = `A reader just completed a quiz about the paper "${aiSession.paper_title}".

Results: ${currentScore}/10 correct

Question-by-question results:
${resultsSummary}

Topics where they got wrong answers:
${questions.filter(q => {
  const ans = quizAnswers.find(a => a.questionId === q.id);
  return ans && !ans.isCorrect;
}).map(q => `- ${q.topic}`).join('\n') || 'None - all correct!'}

Provide a brief diagnosis (2-3 sentences) of their understanding level and 3-5 specific suggestions for improvement.

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use any markdown formatting (no **, no *, no #, no backticks)
- Output ONLY valid JSON

Respond with ONLY this JSON:
{
  "diagnosis": "Your assessment of their understanding...",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

      try {
        const diagnosisResponse = await chatCompletion(
          {
            model: modelId,
            messages: [
              { role: 'system', content: 'You are an educational assessment expert. Output only valid JSON.' },
              { role: 'user', content: diagnosisPrompt }
            ],
            maxTokens: 500,
            temperature: 0.7,
          },
          { apiKey }
        );

        let diagnosisData: any;
        let jsonStr = diagnosisResponse.content.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        diagnosisData = JSON.parse(jsonStr);

        db.prepare(`
          UPDATE quiz_sessions
          SET answers = ?, current_question_number = 11, final_score = ?,
              final_diagnosis = ?, suggestions = ?, completed_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(quizAnswers),
          currentScore,
          diagnosisData.diagnosis,
          JSON.stringify(diagnosisData.suggestions),
          now,
          sessionId
        );
      } catch (diagError) {
        console.error('Failed to generate diagnosis:', diagError);
        // Still mark as complete even if diagnosis fails
        db.prepare(`
          UPDATE quiz_sessions
          SET answers = ?, current_question_number = 11, final_score = ?, completed_at = ?
          WHERE id = ?
        `).run(JSON.stringify(quizAnswers), currentScore, now, sessionId);
      }

      const answerResponse: SubmitQuizAnswerResponse = {
        isCorrect,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        currentScore,
        totalAnswered,
        isComplete: true,
      };

      return res.json(answerResponse);
    }

    // Generate next question
    const aiSession = db.prepare(`
      SELECT h.*, p.title as paper_title, p.abstract as paper_abstract, p.authors as paper_authors
      FROM ai_agent_history h
      JOIN papers p ON h.paper_id = p.id
      WHERE h.id = ?
    `).get(quizSession.history_id) as any;

    const apiKey = decryptApiKeyForQuiz(aiSession.api_key_encrypted);
    const modelId = aiSession.model_id || 'gpt-4o';
    const sentenceAnalysis = aiSession.sentence_analysis ? JSON.parse(aiSession.sentence_analysis) : {};

    // Topics already covered
    const coveredTopics = questions.map(q => q.topic).join(', ');

    const nextQuestionPrompt = `You are creating a quiz to test understanding of an academic paper.

Paper: "${aiSession.paper_title}"
Authors: ${aiSession.paper_authors ? JSON.parse(aiSession.paper_authors).join(', ') : 'Unknown'}
Abstract: ${aiSession.paper_abstract || 'Not available'}

Key analysis points:
${Object.entries(sentenceAnalysis).slice(0, 15).map(([_id, data]: [string, any]) =>
  `- ${data.label}: ${data.comment || ''}`
).join('\n')}

Previous questions covered these topics: ${coveredTopics}

Generate Question ${totalAnswered + 1} of 10. Try to cover a DIFFERENT topic than previous questions.

REQUIREMENTS:
1. Multiple-choice with exactly 4 options (A, B, C, D)
2. Only ONE correct answer
3. Test understanding, not memorization
4. This is question ${totalAnswered + 1}/10 - adjust difficulty accordingly

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use any markdown formatting
- Output ONLY valid JSON

Respond with ONLY this JSON:
{
  "question": "Question text?",
  "choices": {
    "A": "Option A",
    "B": "Option B",
    "C": "Option C",
    "D": "Option D"
  },
  "correctAnswer": "B",
  "explanation": "Why this is correct",
  "difficulty": "medium",
  "topic": "New topic name"
}`;

    const aiResponse = await chatCompletion(
      {
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a quiz generator. Output only valid JSON, no markdown.' },
          { role: 'user', content: nextQuestionPrompt }
        ],
        maxTokens: 1000,
        temperature: 0.7,
      },
      { apiKey }
    );

    let questionData: any;
    try {
      let jsonStr = aiResponse.content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      questionData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse next question:', aiResponse.content);
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to parse AI response' });
    }

    const nextQuestion: QuizQuestion = {
      id: uuidv4(),
      questionNumber: totalAnswered + 1,
      question: questionData.question,
      choices: questionData.choices,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation,
      difficulty: questionData.difficulty || 'medium',
      topic: questionData.topic || 'General',
    };

    questions.push(nextQuestion);

    // Update session
    db.prepare(`
      UPDATE quiz_sessions
      SET questions = ?, answers = ?, current_question_number = ?
      WHERE id = ?
    `).run(JSON.stringify(questions), JSON.stringify(quizAnswers), totalAnswered + 1, sessionId);

    const answerResponse: SubmitQuizAnswerResponse = {
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation,
      currentScore,
      totalAnswered,
      isComplete: false,
      nextQuestion: {
        id: nextQuestion.id,
        questionNumber: nextQuestion.questionNumber,
        question: nextQuestion.question,
        choices: nextQuestion.choices,
        difficulty: nextQuestion.difficulty,
        topic: nextQuestion.topic,
      },
    };

    res.json(answerResponse);
  } catch (error) {
    console.error('Submit quiz answer error:', error);
    if (error instanceof AIProviderError) {
      return res.status(502).json({ error: 'AI Provider Error', message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process answer' });
  }
});

// ============================================================================
// OPEN QUESTIONS & RESEARCH IDEAS (AI INSIGHTS)
// NOTE: These routes MUST be defined before /:id to avoid route conflicts
// ============================================================================

import type { OpenQuestion, ResearchIdea, GenerateOpenQuestionsResponse, GenerateResearchIdeasResponse } from '../../shared/types.js';

// GET /api/papers/:paperId/insights/:historyId - Get cached insights for a session
router.get('/:paperId/insights/:historyId', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId, historyId } = req.params;
    const user = (req as any).user;

    // Verify the session exists and belongs to the user
    const session = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This is not your AI session' });
    }

    // Parse stored insights from session
    const openQuestions = session.open_questions ? JSON.parse(session.open_questions) : undefined;
    const researchIdeas = session.research_ideas ? JSON.parse(session.research_ideas) : undefined;

    res.json({ openQuestions, researchIdeas });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get insights' });
  }
});

// GET /api/papers/:paperId/insights/public - Get all public insights for a paper
router.get('/:paperId/insights/public', (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;

    // Get all public sessions that have open questions or research ideas
    const sessions = db.prepare(`
      SELECT h.id, h.user_id, h.title, h.model_used, h.is_public, h.open_questions, h.research_ideas, h.updated_at,
             u.display_name as user_name, u.avatar as user_avatar
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.paper_id = ? AND h.is_public = 1
        AND (h.open_questions IS NOT NULL OR h.research_ideas IS NOT NULL)
      ORDER BY h.updated_at DESC
    `).all(paperId) as any[];

    // Parse and format the results
    const publicInsights = sessions.map(session => ({
      sessionId: session.id,
      userId: session.user_id,
      userName: session.user_name,
      userAvatar: session.user_avatar,
      sessionTitle: session.title,
      modelUsed: session.model_used,
      openQuestions: session.open_questions ? JSON.parse(session.open_questions) : undefined,
      researchIdeas: session.research_ideas ? JSON.parse(session.research_ideas) : undefined,
      updatedAt: session.updated_at,
    }));

    res.json({ insights: publicInsights });
  } catch (error) {
    console.error('Get public insights error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get public insights' });
  }
});

// POST /api/papers/:paperId/insights/open-questions - Generate open questions
router.post('/:paperId/insights/open-questions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const { historyId, customPrompt } = req.body;
    const user = (req as any).user;

    // Validate paper exists
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Validate AI session exists and belongs to user
    const session = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This is not your AI session' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'No API key configured for this session' });
    }

    // Parse sentence analysis for context
    const sentenceAnalysis = session.sentence_analysis ? JSON.parse(session.sentence_analysis) : {};
    if (Object.keys(sentenceAnalysis).length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no sentence analysis. Please run "Let Agent Read" first.' });
    }

    // Build context from analysis
    const analysisEntries = Object.entries(sentenceAnalysis)
      .map(([id, data]: [string, any]) => `- ${data.label || 'Info'}: ${data.comment || ''}`)
      .slice(0, 30);

    const defaultPrompt = `Analyze this academic paper and identify unsolved open research questions.
Look for:
- Questions the authors explicitly mention as future work
- Limitations that suggest areas needing more research
- Assumptions that could be challenged
- Extensions or generalizations that haven't been explored
Provide 3-5 well-thought-out open questions with context and importance assessment.`;

    const prompt = customPrompt || defaultPrompt;

    const systemPrompt = `You are a research analyst helping identify open research questions in academic papers.
You will be given information about a paper and its key points. Generate insightful open questions.

Paper Title: ${paper.title}
Authors: ${paper.authors || 'Unknown'}
Abstract: ${paper.abstract || 'Not available'}

Key analysis points from the paper:
${analysisEntries.join('\n')}

IMPORTANT: Respond ONLY with valid JSON, no markdown formatting. The response must be a JSON array of objects with this exact structure:
[
  {
    "id": "unique-id",
    "question": "The open research question",
    "context": "Where this is mentioned or implied in the paper",
    "importance": "high" | "medium" | "low",
    "relatedTopics": ["topic1", "topic2"]
  }
]`;

    // Decrypt API key and make request
    const apiKey = Buffer.from(session.api_key_encrypted, 'base64').toString('utf8');
    const modelId = session.model_id || 'gpt-4o';

    const aiResponse = await chatCompletion(
      {
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        maxTokens: 3000,  // Open questions need sufficient tokens for context and related topics
        temperature: 0.7,
      },
      { apiKey }
    );

    // Parse response
    let questions: OpenQuestion[];
    try {
      const content = aiResponse.content.trim();
      // Handle potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      let jsonStr: string;
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        jsonStr = content;
      }

      // Try to parse, if incomplete JSON, try to fix it
      try {
        questions = JSON.parse(jsonStr);
      } catch {
        // If JSON is truncated, try to close it properly
        const lastCompleteObj = jsonStr.lastIndexOf('},');
        if (lastCompleteObj > 0) {
          const fixedJson = jsonStr.substring(0, lastCompleteObj + 1) + ']';
          questions = JSON.parse(fixedJson);
          console.log('Fixed truncated JSON for open questions');
        } else {
          throw new Error('Cannot fix truncated JSON');
        }
      }

      // Add IDs if missing
      questions = questions.map((q, i) => ({
        ...q,
        id: q.id || `oq-${Date.now()}-${i}`,
        relatedTopics: q.relatedTopics || []
      }));
    } catch (parseError) {
      console.error('Failed to parse open questions:', parseError);
      console.error('Raw AI response:', aiResponse.content.substring(0, 500));
      return res.status(500).json({ error: 'AI Response Error', message: 'Failed to parse AI response as valid JSON. The response may have been truncated.' });
    }

    // Store in database
    db.prepare(`
      UPDATE ai_agent_history
      SET open_questions = ?, updated_at = unixepoch()
      WHERE id = ?
    `).run(JSON.stringify(questions), historyId);

    const response: GenerateOpenQuestionsResponse = {
      questions,
      promptUsed: prompt
    };

    res.json(response);
  } catch (error) {
    console.error('Generate open questions error:', error);
    if (error instanceof AIProviderError) {
      return res.status(502).json({ error: 'AI Provider Error', message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate open questions' });
  }
});

// POST /api/papers/:paperId/insights/research-ideas - Generate research ideas
router.post('/:paperId/insights/research-ideas', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    const { historyId, customPrompt } = req.body;
    const user = (req as any).user;

    // Validate paper exists
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Validate AI session exists and belongs to user
    const session = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'AI session not found' });
    }

    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'This is not your AI session' });
    }

    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'No API key configured for this session' });
    }

    // Parse sentence analysis for context
    const sentenceAnalysis = session.sentence_analysis ? JSON.parse(session.sentence_analysis) : {};
    if (Object.keys(sentenceAnalysis).length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no sentence analysis. Please run "Let Agent Read" first.' });
    }

    // Build context from analysis
    const analysisEntries = Object.entries(sentenceAnalysis)
      .map(([id, data]: [string, any]) => `- ${data.label || 'Info'}: ${data.comment || ''}`)
      .slice(0, 30);

    const defaultPrompt = `Based on this academic paper, propose feasible research ideas that could extend or build upon the work.
For each idea, consider:
- What makes it novel compared to existing work
- A practical methodology to pursue it
- Expected outcomes and impact
- Prerequisites and feasibility
Provide 3-5 concrete, actionable research ideas suitable for graduate students or researchers.`;

    const prompt = customPrompt || defaultPrompt;

    const systemPrompt = `You are a research mentor helping propose feasible research ideas based on academic papers.
You will be given information about a paper and its key points. Generate actionable research ideas.

Paper Title: ${paper.title}
Authors: ${paper.authors || 'Unknown'}
Abstract: ${paper.abstract || 'Not available'}

Key analysis points from the paper:
${analysisEntries.join('\n')}

IMPORTANT: Respond ONLY with valid JSON, no markdown formatting. The response must be a JSON array of objects with this exact structure:
[
  {
    "id": "unique-id",
    "title": "Brief title of the idea",
    "description": "Detailed description of the research idea",
    "methodology": "Suggested approach to pursue this research",
    "expectedOutcome": "What success would look like",
    "feasibility": "high" | "medium" | "low",
    "novelty": "incremental" | "moderate" | "breakthrough",
    "prerequisites": ["prerequisite1", "prerequisite2"]
  }
]`;

    // Decrypt API key and make request
    const apiKey = Buffer.from(session.api_key_encrypted, 'base64').toString('utf8');
    const modelId = session.model_id || 'gpt-4o';

    const aiResponse = await chatCompletion(
      {
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        maxTokens: 4000,  // Research ideas need more tokens due to multiple detailed fields
        temperature: 0.7,
      },
      { apiKey }
    );

    // Parse response
    let ideas: ResearchIdea[];
    try {
      const content = aiResponse.content.trim();
      // Handle potential markdown code blocks
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      let jsonStr: string;
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        jsonStr = content;
      }

      // Try to parse, if incomplete JSON, try to fix it
      try {
        ideas = JSON.parse(jsonStr);
      } catch {
        // If JSON is truncated, try to close it properly
        // Find the last complete object by looking for the last "},"
        const lastCompleteObj = jsonStr.lastIndexOf('},');
        if (lastCompleteObj > 0) {
          const fixedJson = jsonStr.substring(0, lastCompleteObj + 1) + ']';
          ideas = JSON.parse(fixedJson);
          console.log('Fixed truncated JSON for research ideas');
        } else {
          throw new Error('Cannot fix truncated JSON');
        }
      }

      // Add IDs if missing
      ideas = ideas.map((idea, i) => ({
        ...idea,
        id: idea.id || `ri-${Date.now()}-${i}`,
        prerequisites: idea.prerequisites || []
      }));
    } catch (parseError) {
      console.error('Failed to parse research ideas:', parseError);
      console.error('Raw AI response:', aiResponse.content.substring(0, 500));
      return res.status(500).json({ error: 'AI Response Error', message: 'Failed to parse AI response as valid JSON. The response may have been truncated.' });
    }

    // Store in database
    db.prepare(`
      UPDATE ai_agent_history
      SET research_ideas = ?, updated_at = unixepoch()
      WHERE id = ?
    `).run(JSON.stringify(ideas), historyId);

    const response: GenerateResearchIdeasResponse = {
      ideas,
      promptUsed: prompt
    };

    res.json(response);
  } catch (error) {
    console.error('Generate research ideas error:', error);
    if (error instanceof AIProviderError) {
      return res.status(502).json({ error: 'AI Provider Error', message: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate research ideas' });
  }
});

// ============================================================================
// AI MODEL ARENA / RANKINGS
// NOTE: These routes MUST be defined before /:id to avoid route conflicts
// ============================================================================

import type { AiModelRanking, ModelRankingResponse, AiModelProvider } from '../../shared/types.js';

// GET /api/papers/model-rankings - Get AI model rankings based on likes/dislikes
router.get('/model-rankings', (req: Request, res: Response) => {
  try {
    const { limit = '10', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const offsetNum = parseInt(offset as string) || 0;

    // Get all unique models with their like/dislike counts from multiple sources:
    // 1. Likes on AI sessions (target_type = 'ai_session')
    // 2. Likes on AI reviews (target_type = 'ai_review') - matched by generated_by field
    const rankingsQuery = db.prepare(`
      WITH session_likes AS (
        -- Likes on AI sessions
        SELECT
          COALESCE(h.model_id, 'unknown') as model_id,
          h.model_used as model_name,
          h.id as session_id,
          l.is_like
        FROM ai_agent_history h
        LEFT JOIN likes l ON l.target_type = 'ai_session' AND l.target_id = h.id
        WHERE h.model_id IS NOT NULL OR h.model_used IS NOT NULL
      ),
      review_likes AS (
        -- Likes on AI reviews (extract model from generated_by field)
        SELECT
          CASE
            WHEN r.generated_by LIKE 'gpt-4o%' THEN 'gpt-4o'
            WHEN r.generated_by LIKE 'gpt-4%' THEN 'gpt-4'
            WHEN r.generated_by LIKE 'GPT-5.2%' OR r.generated_by LIKE 'gpt-5.2%' THEN 'gpt-5.2'
            WHEN r.generated_by LIKE 'claude%' OR r.generated_by LIKE 'Claude%' THEN 'claude-3-5-sonnet'
            WHEN r.generated_by LIKE 'gemini%' OR r.generated_by LIKE 'Gemini%' THEN 'gemini-2.0-flash'
            WHEN r.generated_by LIKE 'Grok%' OR r.generated_by LIKE 'grok%' THEN 'grok-4-1-fast-reasoning'
            ELSE 'unknown'
          END as model_id,
          CASE
            WHEN r.generated_by LIKE 'gpt-4o%' THEN 'GPT-4o'
            WHEN r.generated_by LIKE 'gpt-4%' THEN 'gpt-4'
            WHEN r.generated_by LIKE 'GPT-5.2%' OR r.generated_by LIKE 'gpt-5.2%' THEN 'GPT-5.2'
            WHEN r.generated_by LIKE 'claude%' OR r.generated_by LIKE 'Claude%' THEN 'Claude 3.5 Sonnet'
            WHEN r.generated_by LIKE 'gemini%' OR r.generated_by LIKE 'Gemini%' THEN 'Gemini 2.0 Flash'
            WHEN r.generated_by LIKE 'Grok%' OR r.generated_by LIKE 'grok%' THEN 'Grok 4.1 Fast (Reasoning)'
            ELSE r.generated_by
          END as model_name,
          l.is_like
        FROM ai_reviews r
        LEFT JOIN likes l ON l.target_type = 'ai_review' AND l.target_id = r.id
      ),
      all_models AS (
        SELECT model_id, model_name, session_id, is_like FROM session_likes
        UNION ALL
        SELECT model_id, model_name, NULL as session_id, is_like FROM review_likes
      )
      SELECT
        model_id,
        MAX(model_name) as model_name,
        COUNT(DISTINCT session_id) as session_count,
        COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END), 0) as like_count,
        COALESCE(SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END), 0) as dislike_count,
        COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 WHEN is_like = 0 THEN -1 ELSE 0 END), 0) as score
      FROM all_models
      GROUP BY model_id
      ORDER BY score DESC, like_count DESC, session_count DESC
      LIMIT ? OFFSET ?
    `);

    const rows = rankingsQuery.all(limitNum, offsetNum) as any[];

    // Get total count of unique models
    const totalCountResult = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(model_id, model_used)) as count
      FROM ai_agent_history
      WHERE model_id IS NOT NULL OR model_used IS NOT NULL
    `).get() as { count: number };

    // Map to response format
    const rankings: AiModelRanking[] = rows.map((row, index) => {
      // Try to find model info from default list
      const defaultModel = DEFAULT_AI_MODELS.find(m => m.id === row.model_id);

      return {
        modelId: row.model_id,
        modelName: row.model_name || defaultModel?.name || row.model_id,
        provider: (defaultModel?.provider || 'custom') as AiModelProvider,
        likeCount: row.like_count || 0,
        dislikeCount: row.dislike_count || 0,
        score: row.score || 0,
        sessionCount: row.session_count || 0,
        rank: offsetNum + index + 1,
      };
    });

    const response: ModelRankingResponse = {
      rankings,
      totalModels: totalCountResult.count,
    };

    res.json(response);
  } catch (error) {
    console.error('Get model rankings error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get model rankings' });
  }
});

// GET /api/papers/model-rankings/:modelId - Get details for a specific model
router.get('/model-rankings/:modelId', (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;

    // Get sessions using this model
    const sessions = db.prepare(`
      SELECT
        h.id,
        h.paper_id,
        h.title,
        h.model_used,
        h.created_at,
        p.title as paper_title,
        u.display_name as user_name
      FROM ai_agent_history h
      JOIN papers p ON h.paper_id = p.id
      JOIN users u ON h.user_id = u.id
      WHERE h.model_id = ?
      ORDER BY h.created_at DESC
      LIMIT 50
    `).all(modelId) as any[];

    // Get like/dislike totals from both AI sessions AND AI reviews for this model
    // This matches the logic in the main model-rankings endpoint
    const likeStats = db.prepare(`
      WITH session_likes AS (
        -- Likes on AI sessions
        SELECT l.is_like
        FROM likes l
        JOIN ai_agent_history h ON l.target_id = h.id AND l.target_type = 'ai_session'
        WHERE h.model_id = ?
      ),
      review_likes AS (
        -- Likes on AI reviews generated by this model
        SELECT l.is_like
        FROM likes l
        JOIN ai_reviews r ON l.target_id = r.id AND l.target_type = 'ai_review'
        WHERE (
          (? = 'gpt-4o' AND r.generated_by LIKE 'gpt-4o%') OR
          (? = 'gpt-4' AND r.generated_by LIKE 'gpt-4%' AND r.generated_by NOT LIKE 'gpt-4o%') OR
          (? = 'gpt-5.2' AND (r.generated_by LIKE 'GPT-5.2%' OR r.generated_by LIKE 'gpt-5.2%')) OR
          (? = 'claude-3-5-sonnet' AND (r.generated_by LIKE 'claude%' OR r.generated_by LIKE 'Claude%')) OR
          (? = 'gemini-2.0-flash' AND (r.generated_by LIKE 'gemini%' OR r.generated_by LIKE 'Gemini%')) OR
          (? = 'grok-4-1-fast-reasoning' AND (r.generated_by LIKE 'Grok%' OR r.generated_by LIKE 'grok%'))
        )
      ),
      all_likes AS (
        SELECT is_like FROM session_likes WHERE is_like IS NOT NULL
        UNION ALL
        SELECT is_like FROM review_likes WHERE is_like IS NOT NULL
      )
      SELECT
        COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END), 0) as like_count,
        COALESCE(SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END), 0) as dislike_count
      FROM all_likes
    `).get(modelId, modelId, modelId, modelId, modelId, modelId, modelId) as { like_count: number; dislike_count: number } | undefined;

    // Find model info
    const defaultModel = DEFAULT_AI_MODELS.find(m => m.id === modelId);

    res.json({
      modelId,
      modelName: defaultModel?.name || modelId,
      provider: defaultModel?.provider || 'custom',
      description: defaultModel?.description,
      contextWindow: defaultModel?.contextWindow,
      likeCount: likeStats?.like_count || 0,
      dislikeCount: likeStats?.dislike_count || 0,
      score: (likeStats?.like_count || 0) - (likeStats?.dislike_count || 0),
      sessionCount: sessions.length,
      recentSessions: sessions.map(s => ({
        id: s.id,
        paperId: s.paper_id,
        title: s.title,
        paperTitle: s.paper_title,
        userName: s.user_name,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error('Get model details error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get model details' });
  }
});

// GET /api/papers/available-models - Get list of available AI models
router.get('/available-models', (_req: Request, res: Response) => {
  try {
    res.json({ models: DEFAULT_AI_MODELS });
  } catch (error) {
    console.error('Get available models error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get available models' });
  }
});

// ============================================================================
// LIKE/DISLIKE ENDPOINTS
// NOTE: These routes MUST be defined before /:id to avoid route conflicts
// ============================================================================

import type { LikeTargetType, LikeResponse } from '../../shared/types.js';

// Helper to get like counts for a target
function getLikeCounts(targetType: LikeTargetType, targetId: string, userId?: string): { likeCount: number; dislikeCount: number; userVote: 'like' | 'dislike' | null } {
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END) as like_count,
      SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END) as dislike_count
    FROM likes
    WHERE target_type = ? AND target_id = ?
  `).get(targetType, targetId) as any;

  let userVote: 'like' | 'dislike' | null = null;
  if (userId) {
    const vote = db.prepare(`
      SELECT is_like FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?
    `).get(userId, targetType, targetId) as any;
    if (vote) {
      userVote = vote.is_like === 1 ? 'like' : 'dislike';
    }
  }

  return {
    likeCount: counts?.like_count || 0,
    dislikeCount: counts?.dislike_count || 0,
    userVote
  };
}

// POST /api/papers/likes - Like or dislike a target
router.post('/likes', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targetType, targetId, isLike } = req.body;

    // Validate target type
    const validTargetTypes: LikeTargetType[] = ['annotation', 'comment', 'user_review', 'ai_review', 'necessary_background', 'ai_session'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid target type' });
    }

    if (!targetId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing target ID' });
    }

    if (typeof isLike !== 'boolean') {
      return res.status(400).json({ error: 'Bad Request', message: 'isLike must be a boolean' });
    }

    // Check if user already has a vote on this target
    const existing = db.prepare(`
      SELECT id, is_like FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?
    `).get(user.id, targetType, targetId) as any;

    let isNewLike = false;  // Track if this is a new like (not toggle off or dislike)

    if (existing) {
      if ((existing.is_like === 1) === isLike) {
        // Same vote - remove it (toggle off)
        db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
      } else {
        // Different vote - update it
        db.prepare('UPDATE likes SET is_like = ?, created_at = unixepoch() WHERE id = ?').run(isLike ? 1 : 0, existing.id);
        if (isLike) isNewLike = true;  // Changing from dislike to like
      }
    } else {
      // New vote
      const id = uuidv4();
      db.prepare(`
        INSERT INTO likes (id, user_id, target_type, target_id, is_like)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, user.id, targetType, targetId, isLike ? 1 : 0);
      if (isLike) isNewLike = true;  // New like
    }

    // Send notification for likes (not dislikes, not toggle-off)
    if (isNewLike) {
      // Find the owner of the content to notify
      let ownerId: string | null = null;
      let paperId: string | null = null;
      let targetTitle: string | null = null;

      if (targetType === 'annotation' || targetType === 'comment') {
        const annotation = db.prepare(`
          SELECT user_id, paper_id, content FROM annotations WHERE id = ?
        `).get(targetId) as any;
        if (annotation) {
          ownerId = annotation.user_id;
          paperId = annotation.paper_id;
          try {
            const content = JSON.parse(annotation.content);
            targetTitle = content.text?.slice(0, 50) || 'Your annotation';
          } catch {
            targetTitle = 'Your annotation';
          }
        }
      } else if (targetType === 'user_review') {
        const review = db.prepare(`
          SELECT user_id, paper_id FROM user_reviews WHERE id = ?
        `).get(targetId) as any;
        if (review) {
          ownerId = review.user_id;
          paperId = review.paper_id;
          targetTitle = 'Your review';
        }
      } else if (targetType === 'ai_session') {
        const session = db.prepare(`
          SELECT user_id, paper_id, title FROM ai_agent_history WHERE id = ?
        `).get(targetId) as any;
        if (session) {
          ownerId = session.user_id;
          paperId = session.paper_id;
          targetTitle = session.title || 'Your AI session';
        }
      } else if (targetType === 'necessary_background') {
        const bg = db.prepare(`
          SELECT nb.paper_id, ah.user_id FROM necessary_background nb
          JOIN ai_agent_history ah ON nb.session_id = ah.id
          WHERE nb.id = ?
        `).get(targetId) as any;
        if (bg) {
          ownerId = bg.user_id;
          paperId = bg.paper_id;
          targetTitle = 'Your background concepts';
        }
      }

      if (ownerId && ownerId !== user.id) {
        createNotification({
          userId: ownerId,
          type: 'like',
          actorId: user.id,
          targetType,
          targetId,
          targetTitle: targetTitle || undefined,
          paperId: paperId || undefined,
        });
      }
    }

    // Get updated counts
    const counts = getLikeCounts(targetType, targetId, user.id);

    const response: LikeResponse = {
      success: true,
      ...counts
    };

    res.json(response);
  } catch (error) {
    console.error('Like/dislike error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process vote' });
  }
});

// DELETE /api/papers/likes - Remove like/dislike
router.delete('/likes', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targetType, targetId } = req.body;

    // Validate target type
    const validTargetTypes: LikeTargetType[] = ['annotation', 'comment', 'user_review', 'ai_review', 'necessary_background', 'ai_session'];
    if (!validTargetTypes.includes(targetType)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid target type' });
    }

    if (!targetId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing target ID' });
    }

    db.prepare(`
      DELETE FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?
    `).run(user.id, targetType, targetId);

    // Get updated counts
    const counts = getLikeCounts(targetType, targetId, user.id);

    const response: LikeResponse = {
      success: true,
      ...counts
    };

    res.json(response);
  } catch (error) {
    console.error('Remove like error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove vote' });
  }
});

// GET /api/papers/likes/:targetType/:targetId - Get like status for a target
router.get('/likes/:targetType/:targetId', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targetType, targetId } = req.params;

    // Validate target type
    const validTargetTypes: LikeTargetType[] = ['annotation', 'comment', 'user_review', 'ai_review', 'necessary_background', 'ai_session'];
    if (!validTargetTypes.includes(targetType as LikeTargetType)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid target type' });
    }

    const counts = getLikeCounts(targetType as LikeTargetType, targetId, user?.id);

    res.json(counts);
  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get like status' });
  }
});

// POST /api/papers/likes/batch - Get like status for multiple targets (for bulk loading)
router.post('/likes/batch', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { targets } = req.body;  // Array of { targetType, targetId }

    if (!Array.isArray(targets)) {
      return res.status(400).json({ error: 'Bad Request', message: 'targets must be an array' });
    }

    const results: Record<string, { likeCount: number; dislikeCount: number; userVote: 'like' | 'dislike' | null }> = {};

    for (const target of targets) {
      const key = `${target.targetType}:${target.targetId}`;
      results[key] = getLikeCounts(target.targetType, target.targetId, user?.id);
    }

    res.json({ results });
  } catch (error) {
    console.error('Batch get like status error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get like statuses' });
  }
});

// GET /api/papers/:id - Get single paper with stats
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Increment view count
    db.prepare('UPDATE papers SET view_count = view_count + 1 WHERE id = ?').run(id);

    const paper = getPaperWithStats(id);

    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    res.json({ paper });
  } catch (error) {
    console.error('Get paper error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get paper' });
  }
});

// POST /api/papers - Add a new paper
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { arxivId, contentHash, title, authors, abstract, tags } = req.body as AddPaperRequest;

    if (!title) {
      return res.status(400).json({ error: 'Bad Request', message: 'Title is required' });
    }

    if (!arxivId && !contentHash) {
      return res.status(400).json({ error: 'Bad Request', message: 'Either arxivId or contentHash is required' });
    }

    // Check if paper already exists
    if (arxivId) {
      const existing = db.prepare('SELECT id FROM papers WHERE arxiv_id = ?').get(arxivId);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'Paper already exists', paperId: (existing as any).id });
      }
    }

    if (contentHash) {
      const existing = db.prepare('SELECT id FROM papers WHERE content_hash = ?').get(contentHash);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'Paper already exists', paperId: (existing as any).id });
      }
    }

    // Create paper
    const paperId = uuidv4();

    db.prepare(`
      INSERT INTO papers (id, arxiv_id, content_hash, title, authors, abstract, added_by, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paperId, arxivId || null, contentHash || null, title, JSON.stringify(authors || []), abstract || null, user.id, JSON.stringify(tags || []));

    const paper = getPaperWithStats(paperId);

    res.status(201).json({ paper });
  } catch (error) {
    console.error('Add paper error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add paper' });
  }
});

// PATCH /api/papers/:id/tags - Update paper tags (only maintainer/uploader can edit)
router.patch('/:id/tags', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { tags } = req.body as { tags: string[] };

    // Validate tags
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Tags must be an array' });
    }

    // Check if paper exists and user is the uploader
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(id) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Only the paper uploader can edit tags
    if (paper.added_by !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the paper uploader can edit tags' });
    }

    // Validate each tag (max 50 chars, max 10 tags)
    if (tags.length > 10) {
      return res.status(400).json({ error: 'Bad Request', message: 'Maximum 10 tags allowed' });
    }

    const cleanedTags = tags
      .map(t => t.trim())
      .filter(t => t.length > 0 && t.length <= 50)
      .slice(0, 10);

    // Update tags
    db.prepare('UPDATE papers SET tags = ? WHERE id = ?').run(JSON.stringify(cleanedTags), id);

    res.json({ success: true, tags: cleanedTags });
  } catch (error) {
    console.error('Update paper tags error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update tags' });
  }
});

// GET /api/papers/:id/annotations - Get annotations for a paper
router.get('/:id/annotations', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const annotations = db.prepare(`
      SELECT a.*, u.username, u.display_name, u.avatar
      FROM annotations a
      JOIN users u ON a.user_id = u.id
      WHERE a.paper_id = ?
      ORDER BY a.created_at DESC
    `).all(id) as any[];

    const formatted = annotations.map(a => ({
      id: a.id,
      paperId: a.paper_id,
      userId: a.user_id,
      userName: a.display_name || a.username,
      userAvatar: a.avatar || null,
      pageNumber: a.page_number,
      sentenceId: a.sentence_id,
      content: JSON.parse(a.content),
      createdAt: a.created_at,
    }));

    res.json({ annotations: formatted });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get annotations' });
  }
});

// POST /api/papers/:id/annotations - Add annotation
router.post('/:id/annotations', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const { pageNumber, sentenceId, content, clientId } = req.body;

    if (!pageNumber || !content) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    // Check paper exists and get uploader info
    const paper = db.prepare('SELECT id, title, added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Use client-provided ID if available, otherwise generate a new one
    const annotationId = clientId || uuidv4();

    db.prepare(`
      INSERT INTO annotations (id, paper_id, user_id, page_number, sentence_id, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(annotationId, paperId, user.id, pageNumber, sentenceId || null, JSON.stringify(content));

    // Notify paper uploader about new annotation (if different user)
    if (paper.added_by && paper.added_by !== user.id) {
      const hasHighlightRegion = content && content.highlightRegion;
      createNotification({
        userId: paper.added_by,
        type: hasHighlightRegion ? 'annotation' : 'comment',
        actorId: user.id,
        targetType: 'annotation',
        targetId: annotationId,
        targetTitle: content.text?.slice(0, 100) || 'New annotation',
        paperId,
      });
    }

    res.status(201).json({
      annotation: {
        id: annotationId,
        paperId,
        userId: user.id,
        userName: user.displayName,
        pageNumber,
        sentenceId,
        content,
        createdAt: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    console.error('Add annotation error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to add annotation' });
  }
});

// DELETE /api/papers/:paperId/annotations/:annotationId - Delete annotation
router.delete('/:paperId/annotations/:annotationId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, annotationId } = req.params;

    // Check if annotation exists and belongs to user
    const annotation = db.prepare(`
      SELECT * FROM annotations WHERE id = ? AND paper_id = ?
    `).get(annotationId, paperId) as any;

    if (!annotation) {
      return res.status(404).json({ error: 'Not Found', message: 'Annotation not found' });
    }

    // Only allow user to delete their own annotations
    if (annotation.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own annotations' });
    }

    db.prepare('DELETE FROM annotations WHERE id = ?').run(annotationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete annotation' });
  }
});

// PATCH /api/papers/:paperId/annotations/:annotationId - Update annotation
router.patch('/:paperId/annotations/:annotationId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, annotationId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Bad Request', message: 'Content is required' });
    }

    // Check if annotation exists and belongs to user
    const annotation = db.prepare(`
      SELECT * FROM annotations WHERE id = ? AND paper_id = ?
    `).get(annotationId, paperId) as any;

    if (!annotation) {
      return res.status(404).json({ error: 'Not Found', message: 'Annotation not found' });
    }

    // Only allow user to edit their own annotations
    if (annotation.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only edit your own annotations' });
    }

    db.prepare('UPDATE annotations SET content = ? WHERE id = ?').run(JSON.stringify(content), annotationId);

    res.json({
      annotation: {
        id: annotationId,
        paperId,
        userId: user.id,
        userName: user.displayName,
        pageNumber: annotation.page_number,
        sentenceId: annotation.sentence_id,
        content,
        createdAt: annotation.created_at,
      },
    });
  } catch (error) {
    console.error('Update annotation error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update annotation' });
  }
});

// GET /api/papers/:id/ai-analysis - Get AI analysis for a paper
router.get('/:id/ai-analysis', (req: Request, res: Response) => {
  try {
    const { id: paperId } = req.params;

    const analysis = db.prepare(`
      SELECT * FROM ai_analysis WHERE paper_id = ?
    `).get(paperId) as any;

    if (!analysis) {
      return res.json({ analysis: null });
    }

    res.json({
      analysis: {
        paperId: analysis.paper_id,
        summary: analysis.summary,
        sentenceLabels: analysis.sentence_labels ? JSON.parse(analysis.sentence_labels) : {},
        figureLabels: analysis.figure_labels ? JSON.parse(analysis.figure_labels) : {},
        noveltyCount: analysis.novelty_count,
        analyzedBy: analysis.analyzed_by,
        createdAt: analysis.created_at,
      },
    });
  } catch (error) {
    console.error('Get AI analysis error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI analysis' });
  }
});

// POST /api/papers/:id/ai-analysis - Save AI analysis
router.post('/:id/ai-analysis', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const { summary, sentenceLabels, figureLabels, noveltyCount } = req.body;

    // Upsert AI analysis
    db.prepare(`
      INSERT INTO ai_analysis (paper_id, summary, sentence_labels, figure_labels, novelty_count, analyzed_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(paper_id) DO UPDATE SET
        summary = excluded.summary,
        sentence_labels = excluded.sentence_labels,
        figure_labels = excluded.figure_labels,
        novelty_count = excluded.novelty_count,
        analyzed_by = excluded.analyzed_by,
        created_at = unixepoch()
    `).run(
      paperId,
      summary || null,
      JSON.stringify(sentenceLabels || {}),
      JSON.stringify(figureLabels || {}),
      noveltyCount || 0,
      user.id
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save AI analysis error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save AI analysis' });
  }
});

// POST /api/papers/:id/reading-session - Update reading session
router.post('/:id/reading-session', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const { lastPage, timeSpent } = req.body;

    // Upsert reading session
    db.prepare(`
      INSERT INTO reading_sessions (id, paper_id, user_id, last_page, total_time_seconds)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(paper_id, user_id) DO UPDATE SET
        last_page = COALESCE(excluded.last_page, last_page),
        total_time_seconds = total_time_seconds + COALESCE(excluded.total_time_seconds, 0),
        updated_at = unixepoch()
    `).run(uuidv4(), paperId, user.id, lastPage || 1, timeSpent || 0);

    res.json({ success: true });
  } catch (error) {
    console.error('Update reading session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update reading session' });
  }
});

// GET /api/papers/arxiv/:arxivId/pdf - Proxy ArXiv PDF to avoid CORS
router.get('/arxiv/:arxivId/pdf', async (req: Request, res: Response) => {
  try {
    const { arxivId } = req.params;
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch PDF' });
    }

    // Set appropriate headers for PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${arxivId}.pdf"`);

    // Stream the response
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Fetch ArXiv PDF error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch PDF' });
  }
});

// GET /api/papers/arxiv/:arxivId - Fetch ArXiv metadata (proxy to avoid CORS)
router.get('/arxiv/:arxivId', async (req: Request, res: Response) => {
  try {
    const { arxivId } = req.params;

    // Fetch from ArXiv API
    const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
    const text = await response.text();

    // Parse XML
    const entryMatch = text.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found on ArXiv' });
    }

    const entry = entryMatch[1];

    // Extract title
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : 'Untitled';

    // Extract abstract
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const abstract = summaryMatch ? summaryMatch[1].trim() : '';

    // Extract authors
    const authorMatches = entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g);
    const authors = Array.from(authorMatches).map(m => m[1].trim());

    res.json({
      title,
      authors,
      abstract,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
    });
  } catch (error) {
    console.error('Fetch ArXiv metadata error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch ArXiv metadata' });
  }
});

// ============================================================================
// FIGURE/TABLE REGION ENDPOINTS
// ============================================================================

// GET /api/papers/:id/regions - Get all figure/table regions for a paper
router.get('/:id/regions', (req: Request, res: Response) => {
  try {
    const { id: paperId } = req.params;

    const regions = db.prepare(`
      SELECT * FROM figure_table_regions
      WHERE paper_id = ?
      ORDER BY page_number, label
    `).all(paperId) as any[];

    const formatted: FigureTableRegion[] = regions.map(r => ({
      id: r.id,
      paperId: r.paper_id,
      pageNumber: r.page_number,
      type: r.type,
      label: r.label,
      caption: r.caption,
      boundingRect: JSON.parse(r.bounding_rect),
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ regions: formatted });
  } catch (error) {
    console.error('Get regions error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get regions' });
  }
});

// POST /api/papers/:id/regions - Create a new figure/table region (only paper uploader)
router.post('/:id/regions', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const { pageNumber, type, label, caption, boundingRect } = req.body as CreateFigureTableRegionRequest;

    // Check paper exists and user is the uploader
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (paper.added_by !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the paper uploader can add figure/table regions' });
    }

    // Validate required fields
    if (!pageNumber || !type || !label || !boundingRect) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    if (type !== 'figure' && type !== 'table') {
      return res.status(400).json({ error: 'Bad Request', message: 'Type must be "figure" or "table"' });
    }

    const regionId = uuidv4();

    db.prepare(`
      INSERT INTO figure_table_regions (id, paper_id, page_number, type, label, caption, bounding_rect, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(regionId, paperId, pageNumber, type, label, caption || null, JSON.stringify(boundingRect), user.id);

    const region: FigureTableRegion = {
      id: regionId,
      paperId,
      pageNumber,
      type,
      label,
      caption,
      boundingRect,
      createdBy: user.id,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    };

    res.status(201).json({ region });
  } catch (error) {
    console.error('Create region error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create region' });
  }
});

// PUT /api/papers/:paperId/regions/:regionId - Update a figure/table region (only paper uploader)
router.put('/:paperId/regions/:regionId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, regionId } = req.params;
    const { label, caption, boundingRect } = req.body as UpdateFigureTableRegionRequest;

    // Check paper exists and user is the uploader
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (paper.added_by !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the paper uploader can edit figure/table regions' });
    }

    // Check region exists
    const existing = db.prepare('SELECT * FROM figure_table_regions WHERE id = ? AND paper_id = ?').get(regionId, paperId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Region not found' });
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const params: any[] = [];

    if (label !== undefined) {
      updates.push('label = ?');
      params.push(label);
    }
    if (caption !== undefined) {
      updates.push('caption = ?');
      params.push(caption);
    }
    if (boundingRect !== undefined) {
      updates.push('bounding_rect = ?');
      params.push(JSON.stringify(boundingRect));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    updates.push('updated_at = unixepoch()');
    params.push(regionId, paperId);

    db.prepare(`
      UPDATE figure_table_regions
      SET ${updates.join(', ')}
      WHERE id = ? AND paper_id = ?
    `).run(...params);

    // Fetch updated region
    const updated = db.prepare('SELECT * FROM figure_table_regions WHERE id = ?').get(regionId) as any;

    const region: FigureTableRegion = {
      id: updated.id,
      paperId: updated.paper_id,
      pageNumber: updated.page_number,
      type: updated.type,
      label: updated.label,
      caption: updated.caption,
      boundingRect: JSON.parse(updated.bounding_rect),
      createdBy: updated.created_by,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    res.json({ region });
  } catch (error) {
    console.error('Update region error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update region' });
  }
});

// DELETE /api/papers/:paperId/regions/:regionId - Delete a figure/table region (only paper uploader)
router.delete('/:paperId/regions/:regionId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, regionId } = req.params;

    // Check paper exists and user is the uploader
    const paper = db.prepare('SELECT added_by FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (paper.added_by !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Only the paper uploader can delete figure/table regions' });
    }

    // Check region exists
    const existing = db.prepare('SELECT id FROM figure_table_regions WHERE id = ? AND paper_id = ?').get(regionId, paperId);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Region not found' });
    }

    db.prepare('DELETE FROM figure_table_regions WHERE id = ?').run(regionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete region error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete region' });
  }
});

// ============================================================================
// AI REVIEW ENDPOINTS
// ============================================================================

// Helper to convert db row to AiReview
function dbRowToAiReview(row: any): AiReview {
  return {
    id: row.id,
    paperId: row.paper_id,
    reviewerExpertise: row.reviewer_expertise,
    reviewerExpertiseText: row.reviewer_expertise_text,
    reviewerConfidence: row.reviewer_confidence,
    reviewerConfidenceText: row.reviewer_confidence_text,
    paperSummary: row.paper_summary,
    significanceOfProblem: row.significance_of_problem,
    significanceOfProblemText: row.significance_of_problem_text,
    noveltyOfSolution: row.novelty_of_solution,
    noveltyOfSolutionText: row.novelty_of_solution_text,
    correctness: row.correctness,
    correctnessText: row.correctness_text,
    writingQuality: row.writing_quality,
    writingQualityText: row.writing_quality_text,
    relatedWork: row.related_work,
    relatedWorkText: row.related_work_text,
    robustnessOfEvaluation: row.robustness_of_evaluation,
    robustnessOfEvaluationText: row.robustness_of_evaluation_text,
    advancementDisciplines: row.advancement_disciplines ? JSON.parse(row.advancement_disciplines) : undefined,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    commentsForAuthors: row.comments_for_authors,
    commentsForPC: row.comments_for_pc,
    generatedBy: row.generated_by,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
  };
}

// GET /api/papers/:id/ai-reviews - Get all AI reviews for a paper
router.get('/:id/ai-reviews', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check paper exists
    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(id);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    const rows = db.prepare(`
      SELECT * FROM ai_reviews
      WHERE paper_id = ?
      ORDER BY created_at DESC
    `).all(id) as any[];

    const reviews = rows.map(dbRowToAiReview);

    res.json({ reviews });
  } catch (error) {
    console.error('Get AI reviews error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI reviews' });
  }
});

// POST /api/papers/:id/ai-reviews - Save a new AI review
router.post('/:id/ai-reviews', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const review = req.body as Omit<AiReview, 'id' | 'paperId' | 'createdAt'>;
    const user = (req as any).user;

    // Check paper exists and get uploader info
    const paper = db.prepare('SELECT id, added_by, title FROM papers WHERE id = ?').get(id) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    const reviewId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO ai_reviews (
        id, paper_id, reviewer_expertise, reviewer_expertise_text,
        reviewer_confidence, reviewer_confidence_text, paper_summary,
        significance_of_problem, significance_of_problem_text,
        novelty_of_solution, novelty_of_solution_text,
        correctness, correctness_text,
        writing_quality, writing_quality_text,
        related_work, related_work_text,
        robustness_of_evaluation, robustness_of_evaluation_text,
        advancement_disciplines, strengths, weaknesses,
        comments_for_authors, comments_for_pc,
        generated_by, generated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId, id,
      review.reviewerExpertise, review.reviewerExpertiseText,
      review.reviewerConfidence, review.reviewerConfidenceText,
      review.paperSummary,
      review.significanceOfProblem, review.significanceOfProblemText,
      review.noveltyOfSolution, review.noveltyOfSolutionText,
      review.correctness, review.correctnessText,
      review.writingQuality, review.writingQualityText,
      review.relatedWork, review.relatedWorkText,
      review.robustnessOfEvaluation, review.robustnessOfEvaluationText,
      review.advancementDisciplines ? JSON.stringify(review.advancementDisciplines) : null,
      review.strengths, review.weaknesses,
      review.commentsForAuthors, review.commentsForPC || null,
      review.generatedBy, review.generatedAt, now
    );

    const savedReview = db.prepare('SELECT * FROM ai_reviews WHERE id = ?').get(reviewId) as any;

    // Notify paper uploader about new AI review
    if (paper.added_by && user && paper.added_by !== user.id) {
      createNotification({
        userId: paper.added_by,
        type: 'ai_review',
        actorId: user.id,
        targetType: 'ai_review',
        targetId: reviewId,
        targetTitle: `AI Review by ${review.generatedBy}`,
        paperId: id,
      });
    }

    res.status(201).json({ review: dbRowToAiReview(savedReview) });
  } catch (error) {
    console.error('Save AI review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save AI review' });
  }
});

// DELETE /api/papers/:paperId/ai-reviews/:reviewId - Delete an AI review
router.delete('/:paperId/ai-reviews/:reviewId', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId, reviewId } = req.params;

    // Check review exists
    const existing = db.prepare('SELECT id FROM ai_reviews WHERE id = ? AND paper_id = ?').get(reviewId, paperId);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Review not found' });
    }

    db.prepare('DELETE FROM ai_reviews WHERE id = ?').run(reviewId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete AI review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete AI review' });
  }
});

// ============================================================================
// USER REVIEW ENDPOINTS
// ============================================================================

import type { UserReview, CreateUserReviewRequest, UpdateUserReviewRequest } from '../../shared/types.js';

// Helper to convert db row to UserReview
function dbRowToUserReview(row: any, userName: string, userAvatar?: string): UserReview {
  return {
    id: row.id,
    paperId: row.paper_id,
    userId: row.user_id,
    userName: userName,
    userAvatar: userAvatar || undefined,
    paperSummary: row.paper_summary,
    significanceOfProblem: row.significance_of_problem,
    significanceOfProblemText: row.significance_of_problem_text,
    noveltyOfSolution: row.novelty_of_solution,
    noveltyOfSolutionText: row.novelty_of_solution_text,
    correctness: row.correctness,
    correctnessText: row.correctness_text,
    writingQuality: row.writing_quality,
    writingQualityText: row.writing_quality_text,
    relatedWork: row.related_work,
    relatedWorkText: row.related_work_text,
    robustnessOfEvaluation: row.robustness_of_evaluation,
    robustnessOfEvaluationText: row.robustness_of_evaluation_text,
    advancementDisciplines: row.advancement_disciplines ? JSON.parse(row.advancement_disciplines) : undefined,
    strengths: row.strengths,
    weaknesses: row.weaknesses,
    commentsForAuthors: row.comments_for_authors,
    commentsForReaders: row.comments_for_readers || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/papers/:id/user-reviews - Get all user reviews for a paper
router.get('/:id/user-reviews', (req: Request, res: Response) => {
  try {
    const { id: paperId } = req.params;

    const rows = db.prepare(`
      SELECT r.*, u.display_name as user_name, u.avatar as user_avatar
      FROM user_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.paper_id = ?
      ORDER BY r.updated_at DESC
    `).all(paperId) as any[];

    const reviews = rows.map(row => dbRowToUserReview(row, row.user_name, row.user_avatar));

    res.json({ reviews });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get user reviews' });
  }
});

// GET /api/papers/:id/user-reviews/my - Get current user's review for a paper
router.get('/:id/user-reviews/my', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;

    const row = db.prepare(`
      SELECT r.*, u.display_name as user_name, u.avatar as user_avatar
      FROM user_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.paper_id = ? AND r.user_id = ?
    `).get(paperId, user.id) as any;

    if (!row) {
      return res.json({ review: null });
    }

    res.json({ review: dbRowToUserReview(row, row.user_name, row.user_avatar) });
  } catch (error) {
    console.error('Get my user review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get user review' });
  }
});

// POST /api/papers/:id/user-reviews - Create or update user review
router.post('/:id/user-reviews', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const data = req.body as CreateUserReviewRequest;

    // Validate required fields
    if (!data.paperSummary || !data.strengths || !data.weaknesses || !data.commentsForAuthors) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required fields' });
    }

    const now = Math.floor(Date.now() / 1000);

    // Check if user already has a review for this paper
    const existing = db.prepare('SELECT id FROM user_reviews WHERE paper_id = ? AND user_id = ?').get(paperId, user.id) as any;

    if (existing) {
      // Update existing review
      db.prepare(`
        UPDATE user_reviews SET
          paper_summary = ?,
          significance_of_problem = ?,
          significance_of_problem_text = ?,
          novelty_of_solution = ?,
          novelty_of_solution_text = ?,
          correctness = ?,
          correctness_text = ?,
          writing_quality = ?,
          writing_quality_text = ?,
          related_work = ?,
          related_work_text = ?,
          robustness_of_evaluation = ?,
          robustness_of_evaluation_text = ?,
          advancement_disciplines = ?,
          strengths = ?,
          weaknesses = ?,
          comments_for_authors = ?,
          comments_for_readers = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        data.paperSummary,
        data.significanceOfProblem,
        data.significanceOfProblemText,
        data.noveltyOfSolution,
        data.noveltyOfSolutionText,
        data.correctness,
        data.correctnessText,
        data.writingQuality,
        data.writingQualityText,
        data.relatedWork,
        data.relatedWorkText,
        data.robustnessOfEvaluation,
        data.robustnessOfEvaluationText,
        data.advancementDisciplines ? JSON.stringify(data.advancementDisciplines) : null,
        data.strengths,
        data.weaknesses,
        data.commentsForAuthors,
        data.commentsForReaders || null,
        now,
        existing.id
      );

      const updated = db.prepare(`
        SELECT r.*, u.display_name as user_name, u.avatar as user_avatar
        FROM user_reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `).get(existing.id) as any;

      return res.json({ review: dbRowToUserReview(updated, updated.user_name, updated.user_avatar) });
    }

    // Create new review
    const reviewId = uuidv4();
    db.prepare(`
      INSERT INTO user_reviews (
        id, paper_id, user_id, paper_summary,
        significance_of_problem, significance_of_problem_text,
        novelty_of_solution, novelty_of_solution_text,
        correctness, correctness_text,
        writing_quality, writing_quality_text,
        related_work, related_work_text,
        robustness_of_evaluation, robustness_of_evaluation_text,
        advancement_disciplines, strengths, weaknesses,
        comments_for_authors, comments_for_readers,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      paperId,
      user.id,
      data.paperSummary,
      data.significanceOfProblem,
      data.significanceOfProblemText,
      data.noveltyOfSolution,
      data.noveltyOfSolutionText,
      data.correctness,
      data.correctnessText,
      data.writingQuality,
      data.writingQualityText,
      data.relatedWork,
      data.relatedWorkText,
      data.robustnessOfEvaluation,
      data.robustnessOfEvaluationText,
      data.advancementDisciplines ? JSON.stringify(data.advancementDisciplines) : null,
      data.strengths,
      data.weaknesses,
      data.commentsForAuthors,
      data.commentsForReaders || null,
      now,
      now
    );

    const newReview = db.prepare(`
      SELECT r.*, u.display_name as user_name, u.avatar as user_avatar
      FROM user_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(reviewId) as any;

    // Notify paper uploader about new review
    const paper = db.prepare('SELECT added_by, title FROM papers WHERE id = ?').get(paperId) as any;
    if (paper && paper.added_by && paper.added_by !== user.id) {
      createNotification({
        userId: paper.added_by,
        type: 'user_review',
        actorId: user.id,
        targetType: 'user_review',
        targetId: reviewId,
        targetTitle: `Review on "${paper.title?.slice(0, 50)}"`,
        paperId,
      });
    }

    res.status(201).json({ review: dbRowToUserReview(newReview, newReview.user_name, newReview.user_avatar) });
  } catch (error) {
    console.error('Create/update user review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save user review' });
  }
});

// DELETE /api/papers/:paperId/user-reviews/:reviewId - Delete user review
router.delete('/:paperId/user-reviews/:reviewId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, reviewId } = req.params;

    // Check review exists and belongs to user
    const existing = db.prepare('SELECT id, user_id FROM user_reviews WHERE id = ? AND paper_id = ?').get(reviewId, paperId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Review not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own reviews' });
    }

    db.prepare('DELETE FROM user_reviews WHERE id = ?').run(reviewId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user review error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete user review' });
  }
});

// ============================================================================
// AI AGENT HISTORY ENDPOINTS
// ============================================================================

import type { AiAgentHistory, AiAgentMessage, CreateAiAgentHistoryRequest, UpdateAiAgentHistoryRequest } from '../../shared/types.js';

// Helper to convert db row to AiAgentHistory
function dbRowToAiAgentHistory(row: any, userName: string): AiAgentHistory {
  return {
    id: row.id,
    paperId: row.paper_id,
    userId: row.user_id,
    userName: userName,
    title: row.title,
    messages: JSON.parse(row.messages),
    isPublic: !!row.is_public,
    isActive: !!row.is_active,
    modelUsed: row.model_used,
    modelId: row.model_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sentenceAnalysis: row.sentence_analysis ? JSON.parse(row.sentence_analysis) : undefined,
    figureTableAnalysis: row.figure_table_analysis ? JSON.parse(row.figure_table_analysis) : undefined,
    apiKeySet: !!row.api_key_encrypted,  // Boolean flag - key itself is never exposed
    // Token usage tracking
    totalPromptTokens: row.total_prompt_tokens || 0,
    totalCompletionTokens: row.total_completion_tokens || 0,
    maxContextTokens: row.max_context_tokens || 128000,
    conversationRounds: row.conversation_rounds || 0,
  };
}

// GET /api/papers/:id/agent-history - Get all AI agent histories for a paper (own + public)
router.get('/:id/agent-history', (req: Request, res: Response) => {
  try {
    const { id: paperId } = req.params;
    const user = (req as any).user;

    // Check paper exists
    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    let rows: any[];
    if (user) {
      // Logged in: get own histories + public histories from others
      rows = db.prepare(`
        SELECT h.*, u.display_name as user_name
        FROM ai_agent_history h
        JOIN users u ON h.user_id = u.id
        WHERE h.paper_id = ? AND (h.user_id = ? OR h.is_public = 1)
        ORDER BY h.updated_at DESC
      `).all(paperId, user.id) as any[];
    } else {
      // Not logged in: only public histories
      rows = db.prepare(`
        SELECT h.*, u.display_name as user_name
        FROM ai_agent_history h
        JOIN users u ON h.user_id = u.id
        WHERE h.paper_id = ? AND h.is_public = 1
        ORDER BY h.updated_at DESC
      `).all(paperId) as any[];
    }

    const histories = rows.map(row => dbRowToAiAgentHistory(row, row.user_name));

    res.json({ histories });
  } catch (error) {
    console.error('Get AI agent histories error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI agent histories' });
  }
});

// GET /api/papers/:paperId/agent-history/:historyId - Get a specific history
router.get('/:paperId/agent-history/:historyId', (req: Request, res: Response) => {
  try {
    const { paperId, historyId } = req.params;
    const user = (req as any).user;

    const row = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ? AND h.paper_id = ?
    `).get(historyId, paperId) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    // Check access: owner or public
    if (!row.is_public && (!user || row.user_id !== user.id)) {
      return res.status(403).json({ error: 'Forbidden', message: 'This history is private' });
    }

    res.json({ history: dbRowToAiAgentHistory(row, row.user_name) });
  } catch (error) {
    console.error('Get AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get AI agent history' });
  }
});

// POST /api/papers/:id/agent-history - Create a new AI agent history
router.post('/:id/agent-history', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id: paperId } = req.params;
    const { title, isPublic, apiKey, maxContextTokens, modelId, customModelName } = req.body as CreateAiAgentHistoryRequest;

    // Check paper exists
    const paper = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'Title is required' });
    }

    // Determine model name and ID
    let finalModelId = modelId || 'gpt-4o'; // Default model
    let finalModelName = 'GPT-4o'; // Default name

    if (modelId === 'custom' && customModelName) {
      // Custom model provided by user
      finalModelId = 'custom';
      finalModelName = customModelName.trim();
    } else if (modelId) {
      // Find model in default list
      const modelInfo = DEFAULT_AI_MODELS.find((m: any) => m.id === modelId);
      if (modelInfo) {
        finalModelName = modelInfo.name;
      } else {
        // If not found, treat as custom
        finalModelId = modelId;
        finalModelName = modelId;
      }
    }

    const historyId = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const contextLimit = maxContextTokens || 128000; // Default for gpt-4o

    // Deactivate all other histories for this user on this paper
    db.prepare(`
      UPDATE ai_agent_history SET is_active = 0
      WHERE paper_id = ? AND user_id = ?
    `).run(paperId, user.id);

    // Create new history (active by default)
    // If API key is provided, encrypt it (using base64 for simplicity - in production use proper encryption)
    const encryptedApiKey = apiKey ? Buffer.from(apiKey).toString('base64') : null;

    db.prepare(`
      INSERT INTO ai_agent_history (id, paper_id, user_id, title, messages, is_public, is_active, model_used, model_id, api_key_encrypted, max_context_tokens, total_prompt_tokens, total_completion_tokens, conversation_rounds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `).run(historyId, paperId, user.id, title.trim(), '[]', isPublic ? 1 : 0, finalModelName, finalModelId, encryptedApiKey, contextLimit, now, now);

    const history: AiAgentHistory = {
      id: historyId,
      paperId,
      userId: user.id,
      userName: user.displayName,
      title: title.trim(),
      messages: [],
      isPublic: !!isPublic,
      isActive: true,
      modelUsed: finalModelName,
      modelId: finalModelId,
      createdAt: now,
      updatedAt: now,
      apiKeySet: !!apiKey,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      maxContextTokens: contextLimit,
      conversationRounds: 0,
    };

    res.status(201).json({ history });
  } catch (error) {
    console.error('Create AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create AI agent history' });
  }
});

// PUT /api/papers/:paperId/agent-history/:historyId - Update a history
router.put('/:paperId/agent-history/:historyId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { title, isPublic, isActive, messages, sentenceAnalysis, figureTableAnalysis } = req.body as UpdateAiAgentHistoryRequest;

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only edit your own history' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (isPublic !== undefined) {
      updates.push('is_public = ?');
      params.push(isPublic ? 1 : 0);
    }
    if (messages !== undefined) {
      updates.push('messages = ?');
      params.push(JSON.stringify(messages));
    }
    if (sentenceAnalysis !== undefined) {
      updates.push('sentence_analysis = ?');
      params.push(JSON.stringify(sentenceAnalysis));
    }
    if (figureTableAnalysis !== undefined) {
      updates.push('figure_table_analysis = ?');
      params.push(JSON.stringify(figureTableAnalysis));
    }
    if (isActive !== undefined) {
      if (isActive) {
        // Deactivate all other histories for this user on this paper first
        db.prepare(`
          UPDATE ai_agent_history SET is_active = 0
          WHERE paper_id = ? AND user_id = ? AND id != ?
        `).run(paperId, user.id, historyId);
      }
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
    }

    updates.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(historyId);

    db.prepare(`
      UPDATE ai_agent_history SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    // Fetch updated history
    const updated = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).get(historyId) as any;

    res.json({ history: dbRowToAiAgentHistory(updated, updated.user_name) });
  } catch (error) {
    console.error('Update AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update AI agent history' });
  }
});

// DELETE /api/papers/:paperId/agent-history/:historyId - Delete a history
router.delete('/:paperId/agent-history/:historyId', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only delete your own history' });
    }

    db.prepare('DELETE FROM ai_agent_history WHERE id = ?').run(historyId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete AI agent history' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/activate - Activate a history
router.post('/:paperId/agent-history/:historyId/activate', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only activate your own history' });
    }

    // Deactivate all other histories for this user on this paper
    db.prepare(`
      UPDATE ai_agent_history SET is_active = 0
      WHERE paper_id = ? AND user_id = ?
    `).run(paperId, user.id);

    // Activate this history
    db.prepare(`
      UPDATE ai_agent_history SET is_active = 1, updated_at = ?
      WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), historyId);

    // Fetch updated history
    const updated = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).get(historyId) as any;

    res.json({ history: dbRowToAiAgentHistory(updated, updated.user_name) });
  } catch (error) {
    console.error('Activate AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to activate AI agent history' });
  }
});

// POST /api/papers/:paperId/agent-history/deactivate-all - Deactivate all sessions for this user on this paper
router.post('/:paperId/agent-history/deactivate-all', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId } = req.params;

    // Deactivate all histories for this user on this paper
    db.prepare(`
      UPDATE ai_agent_history SET is_active = 0
      WHERE paper_id = ? AND user_id = ?
    `).run(paperId, user.id);

    res.json({ success: true, message: 'All sessions deactivated' });
  } catch (error) {
    console.error('Deactivate all AI agent history error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to deactivate AI agent histories' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/generate-review - Generate a review from session AI analysis
router.post('/:paperId/agent-history/:historyId/generate-review', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { customPrompt } = req.body || {};

    // Get the paper info
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return res.status(404).json({ error: 'Not Found', message: 'Paper not found' });
    }

    // Get the session
    const session = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!session) {
      return res.status(404).json({ error: 'Not Found', message: 'Session not found' });
    }

    // Check if user owns the session
    if (session.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only generate reviews from your own sessions' });
    }

    // Check if session has analysis data
    if (!session.sentence_analysis) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no AI analysis data. Please run "Let Agent Read" first.' });
    }

    const sentenceAnalysis = JSON.parse(session.sentence_analysis);
    const figureTableAnalysis = session.figure_table_analysis ? JSON.parse(session.figure_table_analysis) : {};

    if (Object.keys(sentenceAnalysis).length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no AI analysis data. Please run "Let Agent Read" first.' });
    }

    // Prepare the analysis summary for the AI
    const analysisEntries = Object.entries(sentenceAnalysis) as [string, any][];
    const labelCounts: Record<string, number> = {};
    const noveltyPoints: string[] = [];
    const correctnessIssues: string[] = [];
    const consistencyIssues: string[] = [];

    analysisEntries.forEach(([id, data]: [string, any]) => {
      const label = data.label || 'unknown';
      labelCounts[label] = (labelCounts[label] || 0) + 1;

      if (data.flags?.novelty && data.comment) {
        noveltyPoints.push(data.comment);
      }
      if (data.flags?.correctnessIssue && data.comment) {
        correctnessIssues.push(data.comment);
      }
      if (data.flags?.consistencyIssue && data.comment) {
        consistencyIssues.push(data.comment);
      }
    });

    const analysisReport = `
Paper Title: ${paper.title}
Authors: ${paper.authors || 'Unknown'}
Abstract: ${paper.abstract || 'Not available'}

AI Analysis Summary:
- Total sentences analyzed: ${analysisEntries.length}
- Label distribution: ${JSON.stringify(labelCounts)}
- Novelty points identified: ${noveltyPoints.length}
- Potential correctness issues: ${correctnessIssues.length}
- Potential consistency issues: ${consistencyIssues.length}

${noveltyPoints.length > 0 ? `Novelty highlights:\n${noveltyPoints.slice(0, 5).map(p => `- ${p}`).join('\n')}` : ''}

${correctnessIssues.length > 0 ? `Correctness concerns:\n${correctnessIssues.slice(0, 5).map(p => `- ${p}`).join('\n')}` : ''}

${consistencyIssues.length > 0 ? `Consistency concerns:\n${consistencyIssues.slice(0, 5).map(p => `- ${p}`).join('\n')}` : ''}

Figure/Table Analysis:
${Object.entries(figureTableAnalysis).slice(0, 10).map(([id, data]: [string, any]) =>
  `- ${id}: ${data.label}${data.comment ? ` - ${data.comment}` : ''}`
).join('\n') || 'No figure/table analysis available'}
`.trim();

    // Check if session has an API key
    if (!session.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Session has no API key configured. Please add your OpenAI API key to the session.' });
    }

    // Decode the API key from base64
    const apiKey = Buffer.from(session.api_key_encrypted, 'base64').toString('utf8');

    // Get the model ID from the session
    const modelId = session.model_id || 'gpt-4o';

    // Check if the model is supported
    const provider = getProviderForModel(modelId);
    if (!provider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Model "${modelId}" is not supported. Please select a different model.`,
      });
    }

    // Default prompt template (user can provide custom prompt via {ANALYSIS_REPORT} placeholder)
    const defaultPromptTemplate = `Based on the following AI analysis of an academic paper, please generate a comprehensive conference-style peer review. The review should be critical, balanced, and constructive.

{ANALYSIS_REPORT}

IMPORTANT GUIDELINES FOR EVIDENCE-BASED REVIEW:
- Every judgment must be supported by specific evidence from the paper
- Cite concrete examples: mention specific sections, paragraphs, figures, tables, equations, or data points
- Avoid vague or high-level comments like "the paper is well-written" or "the methodology is sound"
- Instead, be explicit: "In Section 3.2, Equation (5) appears to have a sign error because..." or "Table 2 shows a 15% improvement, but the baseline comparison in Section 4.1 does not account for..."
- When identifying weaknesses, specify exactly where the issue occurs (e.g., "The claim in paragraph 2 of Section 5 that X leads to Y contradicts the data shown in Figure 3")
- When praising strengths, point to specific contributions (e.g., "The novel attention mechanism described in Section 3.3 achieves state-of-the-art results as demonstrated in Table 4")
- For technical concerns, reference specific equations, algorithms, or experimental setups
- All criticisms and praise should be traceable to concrete content in the paper

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use any markdown formatting (no **, no *, no #, no backticks)
- Use ONLY plain text
- Each field must start with its exact label followed by a colon
- Each field's content must be on the same line or immediately following lines until the next field label

Generate a review with the following EXACT structure and format. Each rating should be a number from 1-4:

PAPER_SUMMARY: [2-3 paragraph summary of what this paper does, its main contributions, and methodology]

SIGNIFICANCE_OF_PROBLEM: [1-4]
SIGNIFICANCE_OF_PROBLEM_TEXT: [One sentence. 1=minor problem, 2=important but studied, 3=important and emerging, 4=fundamental and critical]

NOVELTY_OF_SOLUTION: [1-4]
NOVELTY_OF_SOLUTION_TEXT: [One sentence. 1=incremental, 2=some novelty, 3=significant novelty, 4=highly novel]

CORRECTNESS: [1-4]
CORRECTNESS_TEXT: [One sentence. 1=major errors, 2=minor errors, 3=no factual mistakes, 4=rigorous proofs]

WRITING_QUALITY: [1-4]
WRITING_QUALITY_TEXT: [One sentence. 1=hard to read, 2=reasonable, 3=well-written, 4=excellent]

RELATED_WORK: [1-4]
RELATED_WORK_TEXT: [One sentence. 1=not up-to-date, 2=adequate, 3=comprehensive, 4=exemplary]

ROBUSTNESS_OF_EVALUATION: [1-4]
ROBUSTNESS_OF_EVALUATION_TEXT: [One sentence. 1=missing experiments, 2=basic evaluation, 3=well-executed, 4=comprehensive]

ADVANCEMENT_DISCIPLINES: [comma-separated list of relevant fields, e.g., Computer Architecture, Machine Learning]

STRENGTHS:
[Bullet points of 3-5 key strengths, each starting with a dash on a new line]

WEAKNESSES:
[Bullet points of 3-5 key weaknesses, each starting with a dash on a new line]

COMMENTS_FOR_AUTHORS:
[2-3 paragraphs with detailed, constructive feedback for the authors. Include specific questions, suggestions for improvement, and comments on technical aspects.]

COMMENTS_FOR_READERS:
[1-2 paragraphs with meta-comments about the paper's contribution to the field, potential impact, and any concerns about the review process or scope.]`;

    // Use custom prompt if provided, replacing {ANALYSIS_REPORT} placeholder
    const promptTemplate = customPrompt || defaultPromptTemplate;
    const reviewPrompt = promptTemplate.replace('{ANALYSIS_REPORT}', analysisReport);

    const systemPromptContent = 'You are an experienced academic peer reviewer. Generate thorough, fair, and constructive reviews. Be critical but supportive. Focus on scientific merit, methodology, and contribution.';

    // Call AI using the provider system
    let reviewResponse;
    try {
      reviewResponse = await chatCompletion(
        {
          model: modelId,
          messages: [
            { role: 'system', content: systemPromptContent },
            { role: 'user', content: reviewPrompt },
          ],
          maxTokens: 3000,
          temperature: 0.7,
        },
        { apiKey }
      );
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error(`${error.provider} API error:`, error.message);
        return res.status(error.statusCode || 500).json({
          error: 'AI Error',
          message: error.message,
          provider: error.provider,
        });
      }
      throw error;
    }

    const reviewText = reviewResponse.content || '';

    // Store the review generation conversation in the session messages for debugging
    const existingMessages = session.messages ? JSON.parse(session.messages) : [];
    const msgNow = Math.floor(Date.now() / 1000);

    // Add system context if not already present
    if (existingMessages.length === 0 || existingMessages[0].role !== 'system') {
      existingMessages.unshift({
        role: 'system',
        content: `[System Context for Review Generation]\n${systemPromptContent}`,
        timestamp: msgNow,
      });
    }

    // Add the user request (review prompt)
    existingMessages.push({
      role: 'user',
      content: `[Generate Review Request]\n${reviewPrompt}`,
      timestamp: msgNow,
    });

    // Add the AI response
    existingMessages.push({
      role: 'assistant',
      content: `[Generated Review]\n${reviewText}`,
      timestamp: msgNow,
    });

    // Update token usage from the provider response
    const promptTokens = reviewResponse.usage.promptTokens;
    const completionTokens = reviewResponse.usage.completionTokens;
    const newTotalPromptTokens = (session.total_prompt_tokens || 0) + promptTokens;
    const newTotalCompletionTokens = (session.total_completion_tokens || 0) + completionTokens;
    const newConversationRounds = (session.conversation_rounds || 0) + 1;

    // Update the session with messages and token usage
    db.prepare(`
      UPDATE ai_agent_history
      SET messages = ?,
          total_prompt_tokens = ?,
          total_completion_tokens = ?,
          conversation_rounds = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(existingMessages),
      newTotalPromptTokens,
      newTotalCompletionTokens,
      newConversationRounds,
      msgNow,
      historyId
    );

    // Parse the review text
    const parseField = (fieldName: string, defaultValue: string = ''): string => {
      const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, 's');
      const match = reviewText.match(regex);
      return match ? match[1].trim() : defaultValue;
    };

    const parseNumber = (fieldName: string, defaultValue: number = 2): number => {
      const regex = new RegExp(`${fieldName}:\\s*(\\d)`);
      const match = reviewText.match(regex);
      return match ? parseInt(match[1], 10) : defaultValue;
    };

    const reviewId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Extract disciplines
    const advancementDisciplinesText = parseField('ADVANCEMENT_DISCIPLINES');
    const advancementDisciplines = advancementDisciplinesText
      .split(',')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    // Create the review object
    const review = {
      id: reviewId,
      paperId,
      reviewerExpertise: parseNumber('REVIEWER_EXPERTISE'),
      reviewerExpertiseText: parseField('REVIEWER_EXPERTISE_TEXT', 'I read papers in this area'),
      reviewerConfidence: parseNumber('REVIEWER_CONFIDENCE'),
      reviewerConfidenceText: parseField('REVIEWER_CONFIDENCE_TEXT', 'I understood the main idea'),
      paperSummary: parseField('PAPER_SUMMARY', 'Summary not available'),
      significanceOfProblem: parseNumber('SIGNIFICANCE_OF_PROBLEM'),
      significanceOfProblemText: parseField('SIGNIFICANCE_OF_PROBLEM_TEXT', 'Important problem'),
      noveltyOfSolution: parseNumber('NOVELTY_OF_SOLUTION'),
      noveltyOfSolutionText: parseField('NOVELTY_OF_SOLUTION_TEXT', 'Some novelty'),
      correctness: parseNumber('CORRECTNESS'),
      correctnessText: parseField('CORRECTNESS_TEXT', 'No major errors'),
      writingQuality: parseNumber('WRITING_QUALITY'),
      writingQualityText: parseField('WRITING_QUALITY_TEXT', 'Reasonable quality'),
      relatedWork: parseNumber('RELATED_WORK'),
      relatedWorkText: parseField('RELATED_WORK_TEXT', 'Adequate coverage'),
      robustnessOfEvaluation: parseNumber('ROBUSTNESS_OF_EVALUATION'),
      robustnessOfEvaluationText: parseField('ROBUSTNESS_OF_EVALUATION_TEXT', 'Basic evaluation'),
      advancementDisciplines: advancementDisciplines.length > 0 ? JSON.stringify(advancementDisciplines) : null,
      strengths: parseField('STRENGTHS', 'Strengths not specified'),
      weaknesses: parseField('WEAKNESSES', 'Weaknesses not specified'),
      commentsForAuthors: parseField('COMMENTS_FOR_AUTHORS', 'No specific comments'),
      commentsForPC: parseField('COMMENTS_FOR_READERS'),
      generatedBy: `${session.model_used || modelId} (session-based)`,
      generatedAt: now,
    };

    // Save to database
    db.prepare(`
      INSERT INTO ai_reviews (
        id, paper_id, reviewer_expertise, reviewer_expertise_text, reviewer_confidence, reviewer_confidence_text,
        paper_summary, significance_of_problem, significance_of_problem_text, novelty_of_solution, novelty_of_solution_text,
        correctness, correctness_text, writing_quality, writing_quality_text, related_work, related_work_text,
        robustness_of_evaluation, robustness_of_evaluation_text, advancement_disciplines, strengths, weaknesses,
        comments_for_authors, comments_for_pc, generated_by, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      review.id, review.paperId, review.reviewerExpertise, review.reviewerExpertiseText,
      review.reviewerConfidence, review.reviewerConfidenceText, review.paperSummary,
      review.significanceOfProblem, review.significanceOfProblemText, review.noveltyOfSolution, review.noveltyOfSolutionText,
      review.correctness, review.correctnessText, review.writingQuality, review.writingQualityText,
      review.relatedWork, review.relatedWorkText, review.robustnessOfEvaluation, review.robustnessOfEvaluationText,
      review.advancementDisciplines, review.strengths, review.weaknesses, review.commentsForAuthors,
      review.commentsForPC, review.generatedBy, review.generatedAt
    );

    // Return the review in the expected format
    res.json({
      review: {
        id: review.id,
        paperId: review.paperId,
        reviewerExpertise: review.reviewerExpertise,
        reviewerExpertiseText: review.reviewerExpertiseText,
        reviewerConfidence: review.reviewerConfidence,
        reviewerConfidenceText: review.reviewerConfidenceText,
        paperSummary: review.paperSummary,
        significanceOfProblem: review.significanceOfProblem,
        significanceOfProblemText: review.significanceOfProblemText,
        noveltyOfSolution: review.noveltyOfSolution,
        noveltyOfSolutionText: review.noveltyOfSolutionText,
        correctness: review.correctness,
        correctnessText: review.correctnessText,
        writingQuality: review.writingQuality,
        writingQualityText: review.writingQualityText,
        relatedWork: review.relatedWork,
        relatedWorkText: review.relatedWorkText,
        robustnessOfEvaluation: review.robustnessOfEvaluation,
        robustnessOfEvaluationText: review.robustnessOfEvaluationText,
        advancementDisciplines: advancementDisciplines.length > 0 ? advancementDisciplines : undefined,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        commentsForAuthors: review.commentsForAuthors,
        commentsForPC: review.commentsForPC || undefined,
        generatedBy: review.generatedBy,
        generatedAt: review.generatedAt,
        createdAt: now,
      }
    });
  } catch (error) {
    console.error('Generate AI review from session error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate AI review' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/set-api-key - Set API key (one-time only)
router.post('/:paperId/agent-history/:historyId/set-api-key', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key is required' });
    }

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only modify your own history' });
    }

    // Check if API key is already set
    if (existing.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key is already set and cannot be changed' });
    }

    // Encrypt and store the API key (using base64 for simplicity - in production use proper encryption)
    const encryptedApiKey = Buffer.from(apiKey.trim()).toString('base64');

    db.prepare(`
      UPDATE ai_agent_history SET api_key_encrypted = ?, updated_at = ? WHERE id = ?
    `).run(encryptedApiKey, Math.floor(Date.now() / 1000), historyId);

    // Fetch updated history
    const updated = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).get(historyId) as any;

    res.json({ history: dbRowToAiAgentHistory(updated, updated.user_name) });
  } catch (error) {
    console.error('Set API key error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to set API key' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/chat - Chat with the AI agent
router.post('/:paperId/agent-history/:historyId/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { message, context } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'Message is required' });
    }

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only chat in your own history' });
    }

    // Check if API key is set
    if (!existing.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Please set an API key first' });
    }

    // Decrypt the API key
    const apiKey = Buffer.from(existing.api_key_encrypted, 'base64').toString('utf8');

    // Get paper info for context
    const paper = db.prepare('SELECT title, abstract FROM papers WHERE id = ?').get(paperId) as any;

    // Parse existing messages
    const messages: AiAgentMessage[] = JSON.parse(existing.messages);
    const now = Math.floor(Date.now() / 1000);

    // Add user message
    const userMessage: AiAgentMessage = {
      role: 'user',
      content: message.trim(),
      timestamp: now,
    };
    messages.push(userMessage);

    // Build analysis summary if available
    let analysisSummary = '';
    if (existing.sentence_analysis) {
      try {
        const analysis = JSON.parse(existing.sentence_analysis);
        const sentences = Object.entries(analysis);

        // Group by label
        const byLabel: Record<string, Array<{ text: string; comment: string; novelty?: boolean }>> = {};
        sentences.forEach(([, data]: [string, any]) => {
          const label = data.label || 'Unknown';
          if (!byLabel[label]) byLabel[label] = [];
          byLabel[label].push({
            text: data.text?.slice(0, 200) || '',
            comment: data.comment || '',
            novelty: data.flags?.novelty || false,
          });
        });

        // Build summary with key insights
        const labelSummaries = Object.entries(byLabel).map(([label, items]) => {
          const noveltyItems = items.filter(i => i.novelty);
          const sampleComments = items.slice(0, 3).map(i => i.comment).filter(c => c).join('; ');
          return `- ${label}: ${items.length} sentences${noveltyItems.length > 0 ? ` (${noveltyItems.length} marked as novel)` : ''}${sampleComments ? `\n  Key points: ${sampleComments}` : ''}`;
        }).join('\n');

        // Get all novelty-flagged comments
        const noveltyComments = sentences
          .filter(([, data]: [string, any]) => data.flags?.novelty && data.comment)
          .map(([, data]: [string, any]) => `- ${data.comment}`)
          .slice(0, 10)
          .join('\n');

        analysisSummary = `
=== AI ANALYSIS SUMMARY ===
You have previously analyzed this paper. Here is what you found:

Sentence Analysis by Category:
${labelSummaries}

${noveltyComments ? `Key Novel Contributions Identified:\n${noveltyComments}` : ''}

Total sentences analyzed: ${sentences.length}
=== END ANALYSIS SUMMARY ===
`;
      } catch (e) {
        analysisSummary = `\nNote: Paper has been analyzed but summary could not be generated.`;
      }
    }

    // Prepare conversation for OpenAI
    const systemPrompt = `You are an AI research assistant who has thoroughly read and analyzed an academic paper.

Paper Title: ${paper?.title || 'Unknown'}
${paper?.abstract ? `Abstract: ${paper.abstract}` : ''}
${analysisSummary}

IMPORTANT: You have read this paper. When users ask what paper you read or what it's about, refer to your analysis above. Be helpful, concise, and academic in your responses. You can discuss specific findings, methodology, contributions, and insights from the paper based on your analysis.

When users ask questions about specific sentences or sections, pay careful attention to the context they provide. Always reference the specific sentence and section in your answer.`;

    // If context is provided (e.g., for @AI questions about specific sentences),
    // prepend it to the user message so the AI has full context
    const effectiveMessage = context
      ? `${context}\n\nUser's question: ${message.trim()}`
      : message.trim();

    // Store system prompt as first message if not already present (for debugging)
    // Check if we already have a system message at the start
    const hasSystemMessage = messages.length > 0 && messages[0].role === 'system';
    if (!hasSystemMessage) {
      // Insert system message at the beginning of stored messages
      const systemMessage: AiAgentMessage = {
        role: 'system',
        content: `[System Context]\n${systemPrompt}`,
        timestamp: now,
      };
      messages.unshift(systemMessage);
    } else {
      // Update the existing system message with current context
      messages[0] = {
        role: 'system',
        content: `[System Context - Updated]\n${systemPrompt}`,
        timestamp: now,
      };
    }

    // Build chat messages for the API call
    // The last user message should include the context if provided
    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.slice(1).map((m, idx, arr) => {
        // For the last message (the current user question), include context if provided
        if (idx === arr.length - 1 && m.role === 'user' && context) {
          return {
            role: m.role as 'user' | 'assistant' | 'system',
            content: effectiveMessage, // Use the context-enhanced message
          };
        }
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        };
      }),
    ];

    // Get the model ID from the session
    const modelId = existing.model_id || 'gpt-4o';

    // Debug logging for @AI follow-up questions
    if (context) {
      console.log('[Chat API] Context-enhanced message being sent to AI:');
      console.log('[Chat API] Original message:', message.trim());
      console.log('[Chat API] Context:', context.substring(0, 200) + '...');
      console.log('[Chat API] Effective message:', effectiveMessage.substring(0, 300) + '...');
    }

    // Check if the model is supported
    const provider = getProviderForModel(modelId);
    if (!provider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Model "${modelId}" is not supported. Please select a different model.`,
      });
    }

    // Call AI using the provider system
    let chatResponse;
    try {
      chatResponse = await chatCompletion(
        {
          model: modelId,
          messages: chatMessages,
          maxTokens: 1000,
          temperature: 0.7,
        },
        { apiKey }
      );
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error(`${error.provider} API error:`, error.message);
        return res.status(error.statusCode || 500).json({
          error: 'AI Error',
          message: error.message,
          provider: error.provider,
        });
      }
      throw error;
    }

    const aiResponseText = chatResponse.content || 'No response generated';

    // Extract token usage from provider response
    const promptTokens = chatResponse.usage.promptTokens;
    const completionTokens = chatResponse.usage.completionTokens;

    // Add assistant message
    const assistantMessage: AiAgentMessage = {
      role: 'assistant',
      content: aiResponseText,
      timestamp: Math.floor(Date.now() / 1000),
    };
    messages.push(assistantMessage);

    // Update the history with new messages and token usage
    db.prepare(`
      UPDATE ai_agent_history
      SET messages = ?,
          updated_at = ?,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          conversation_rounds = conversation_rounds + 1
      WHERE id = ?
    `).run(JSON.stringify(messages), Math.floor(Date.now() / 1000), promptTokens, completionTokens, historyId);

    // Fetch updated history
    const updated = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).get(historyId) as any;

    res.json({
      response: aiResponseText,
      updatedHistory: dbRowToAiAgentHistory(updated, updated.user_name),
    });
  } catch (error) {
    console.error('Chat with agent error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to chat with agent' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/generate-background - Generate necessary background
router.post('/:paperId/agent-history/:historyId/generate-background', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { customPrompt } = req.body || {};

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only generate background for your own history' });
    }

    // Check if API key is set
    if (!existing.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Please set an API key first' });
    }

    // Check if AI has read the paper
    if (!existing.sentence_analysis) {
      return res.status(400).json({ error: 'Bad Request', message: 'AI must read the paper first' });
    }

    // Decrypt the API key
    const apiKey = Buffer.from(existing.api_key_encrypted, 'base64').toString('utf8');

    // Get paper info
    const paper = db.prepare('SELECT title, abstract FROM papers WHERE id = ?').get(paperId) as any;

    // Parse sentence analysis to understand the paper content
    const sentenceAnalysis = JSON.parse(existing.sentence_analysis);

    // Create a summary of what's in the paper for context
    const labelCounts: Record<string, number> = {};
    const noveltyPoints: string[] = [];
    Object.values(sentenceAnalysis).forEach((data: any) => {
      labelCounts[data.label] = (labelCounts[data.label] || 0) + 1;
      if (data.flags?.novelty && data.comment) {
        noveltyPoints.push(data.comment);
      }
    });

    // Build the context strings for placeholder replacement
    const paperTitle = paper?.title || 'Unknown';
    const paperAbstract = paper?.abstract ? `Abstract: ${paper.abstract}` : '';
    const labelCountsStr = Object.entries(labelCounts).map(([label, count]) => `- ${count} sentences labeled as "${label}"`).join('\n');
    const noveltyPointsStr = noveltyPoints.length > 0 ? `Key novel contributions identified:\n${noveltyPoints.slice(0, 5).map(p => `- ${p}`).join('\n')}` : '';

    // Default prompt template
    const defaultPromptTemplate = `You are an academic expert analyzing a research paper to identify necessary background knowledge.

Paper Title: {PAPER_TITLE}
{PAPER_ABSTRACT}

This paper contains:
{LABEL_COUNTS}

{NOVELTY_POINTS}

Please identify 5-10 background concepts that a reader should understand before reading this paper.

IMPORTANT GUIDELINES FOR EVIDENCE-BASED RECOMMENDATIONS:
- Every concept you recommend must be directly tied to specific content in the paper
- In your explanation, cite concrete examples from the paper that require this background knowledge
- Be specific: instead of "understanding neural networks is helpful", say "Section 3.1 describes a transformer architecture with multi-head attention (Equation 4), which requires understanding of attention mechanisms and matrix operations"
- Reference specific sections, equations, figures, or terminology from the paper that would be unclear without this background
- Explain exactly which parts of the paper become inaccessible without each concept
- Prioritize concepts based on how many sections/equations/figures in the paper depend on them

Format your response as a JSON array with this structure:
[
  {
    "concept": "Concept Name",
    "explanation": "Why this concept is necessary, with specific references to sections/equations/figures in the paper that require it...",
    "importance": "critical" | "important" | "helpful"
  },
  ...
]

Only output the JSON array, no other text.`;

    // Use custom prompt if provided, replacing placeholders
    const promptTemplate = customPrompt || defaultPromptTemplate;
    const prompt = promptTemplate
      .replace('{PAPER_TITLE}', paperTitle)
      .replace('{PAPER_ABSTRACT}', paperAbstract)
      .replace('{LABEL_COUNTS}', labelCountsStr)
      .replace('{NOVELTY_POINTS}', noveltyPointsStr);

    // Get the model ID from the session
    const modelId = existing.model_id || 'gpt-4o';

    // Check if the model is supported
    const provider = getProviderForModel(modelId);
    if (!provider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Model "${modelId}" is not supported. Please select a different model.`,
      });
    }

    // Call AI using the provider system
    let backgroundResponse;
    try {
      backgroundResponse = await chatCompletion(
        {
          model: modelId,
          messages: [
            { role: 'system', content: 'You are an academic expert. Output only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          maxTokens: 2000,
          temperature: 0.7,
        },
        { apiKey }
      );
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error(`${error.provider} API error:`, error.message);
        return res.status(error.statusCode || 500).json({
          error: 'AI Error',
          message: error.message,
          provider: error.provider,
        });
      }
      throw error;
    }

    const aiResponse = backgroundResponse.content || '[]';

    // Store the background generation conversation in the session messages for debugging
    const existingMessages = existing.messages ? JSON.parse(existing.messages) : [];
    const msgNow = Math.floor(Date.now() / 1000);

    const systemPromptContent = 'You are an academic expert. Output only valid JSON.';

    // Add system context if not already present
    if (existingMessages.length === 0 || existingMessages[0].role !== 'system') {
      existingMessages.unshift({
        role: 'system',
        content: `[System Context for Background Generation]\n${systemPromptContent}`,
        timestamp: msgNow,
      });
    }

    // Add the user request (background prompt)
    existingMessages.push({
      role: 'user',
      content: `[Generate Background Knowledge Request]\n${prompt}`,
      timestamp: msgNow,
    });

    // Add the AI response
    existingMessages.push({
      role: 'assistant',
      content: `[Generated Background Knowledge]\n${aiResponse}`,
      timestamp: msgNow,
    });

    // Update token usage from the provider response
    const promptTokens = backgroundResponse.usage.promptTokens;
    const completionTokens = backgroundResponse.usage.completionTokens;
    const newTotalPromptTokens = (existing.total_prompt_tokens || 0) + promptTokens;
    const newTotalCompletionTokens = (existing.total_completion_tokens || 0) + completionTokens;
    const newConversationRounds = (existing.conversation_rounds || 0) + 1;

    // Update the session with messages and token usage
    db.prepare(`
      UPDATE ai_agent_history
      SET messages = ?,
          total_prompt_tokens = ?,
          total_completion_tokens = ?,
          conversation_rounds = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(existingMessages),
      newTotalPromptTokens,
      newTotalCompletionTokens,
      newConversationRounds,
      msgNow,
      historyId
    );

    // Parse the concepts from the response
    let concepts;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      concepts = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      console.error('Failed to parse concepts:', e);
      concepts = [];
    }

    const now = Math.floor(Date.now() / 1000);
    const backgroundId = uuidv4();

    // Save to database
    db.prepare(`
      INSERT INTO necessary_background (id, paper_id, session_id, concepts, generated_by, generated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(backgroundId, paperId, historyId, JSON.stringify(concepts), 'gpt-4o', now);

    res.json({
      background: {
        id: backgroundId,
        paperId,
        sessionId: historyId,
        concepts,
        generatedBy: 'gpt-4o',
        generatedAt: now,
        createdAt: now,
      }
    });
  } catch (error) {
    console.error('Generate background error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate background' });
  }
});

// GET /api/papers/:paperId/backgrounds - Get all necessary backgrounds for a paper
router.get('/:paperId/backgrounds', (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;

    const rows = db.prepare(`
      SELECT * FROM necessary_background WHERE paper_id = ? ORDER BY created_at DESC
    `).all(paperId) as any[];

    const backgrounds = rows.map(row => ({
      id: row.id,
      paperId: row.paper_id,
      sessionId: row.session_id,
      concepts: JSON.parse(row.concepts),
      generatedBy: row.generated_by,
      generatedAt: row.generated_at,
      createdAt: row.created_at,
    }));

    res.json({ backgrounds });
  } catch (error) {
    console.error('Get backgrounds error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get backgrounds' });
  }
});

// DELETE /api/papers/:paperId/backgrounds/:backgroundId - Delete a background
router.delete('/:paperId/backgrounds/:backgroundId', requireAuth, (req: Request, res: Response) => {
  try {
    const { paperId, backgroundId } = req.params;

    // Check background exists
    const existing = db.prepare('SELECT id FROM necessary_background WHERE id = ? AND paper_id = ?').get(backgroundId, paperId);
    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'Background not found' });
    }

    db.prepare('DELETE FROM necessary_background WHERE id = ?').run(backgroundId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete background error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete background' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/analyze-page - Analyze a page of the paper
// This endpoint proxies OpenAI calls using the session's encrypted API key
router.post('/:paperId/agent-history/:historyId/analyze-page', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { sentences, figureTables, pageNumber, totalPages } = req.body;

    if (!sentences || !Array.isArray(sentences)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Sentences array is required' });
    }

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only analyze pages in your own history' });
    }

    // Check if API key is set
    if (!existing.api_key_encrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Please set an API key first' });
    }

    // Decrypt the API key
    const apiKey = Buffer.from(existing.api_key_encrypted, 'base64').toString('utf8');

    // Get paper info for context
    const paper = db.prepare('SELECT title, abstract FROM papers WHERE id = ?').get(paperId) as any;

    // Build the analysis prompt
    const sentenceList = sentences.map((s: any, i: number) =>
      `[${i + 1}] ${s.section ? `(${s.section.fullTitle || s.section.title}) ` : ''}${s.text}`
    ).join('\n');

    const figureTableList = figureTables && figureTables.length > 0
      ? figureTables.map((ft: any) => `[${ft.type.toUpperCase()}: ${ft.label}] ${ft.caption || 'No caption'}`).join('\n')
      : '';

    const systemPrompt = `You are an AI research assistant analyzing an academic paper page by page.
Your task is to label each sentence with ONE of these categories:
- "Background": General context, prior work, or foundational concepts
- "Method": Technical approach, methodology, or algorithm description
- "Result": Experimental findings, data, or outcomes
- "Conclusion": Interpretations, implications, or summary statements
- "Definition": Formal definitions of terms or concepts
- "Claim": Novel contributions or assertions made by the authors
- "Example": Illustrative examples or case studies
- "Limitation": Acknowledged weaknesses or constraints
- "Future Work": Proposed extensions or open questions

Also identify any flags:
- novelty: true if the sentence describes a novel contribution
- correctnessIssue: true if there's a potential logical or factual issue
- consistencyIssue: true if it contradicts other parts of the paper

For figures/tables, provide similar analysis based on their captions.

Respond with a JSON object:
{
  "sentences": {
    "1": { "label": "Background", "comment": "Brief explanation", "flags": { "novelty": false } },
    ...
  },
  "figureTables": {
    "Figure 1": { "label": "Result", "comment": "Description of what it shows", "flags": {} },
    ...
  }
}

Only output valid JSON, no other text.`;

    const userPrompt = `Paper: ${paper?.title || 'Unknown'}
Page ${pageNumber} of ${totalPages}

=== SENTENCES ===
${sentenceList}

${figureTableList ? `=== FIGURES/TABLES ===\n${figureTableList}` : ''}

Analyze each item and provide labels with brief comments.`;

    // Get the model ID from the session
    const modelId = existing.model_id || 'gpt-4o';

    // Check if the model is supported
    const provider = getProviderForModel(modelId);
    if (!provider) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Model "${modelId}" is not supported. Please select a different model.`,
      });
    }

    // Call AI using the provider system
    let aiResponse;
    try {
      aiResponse = await chatCompletion(
        {
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          maxTokens: 4000,
          temperature: 0.3,
        },
        { apiKey }
      );
    } catch (error) {
      if (error instanceof AIProviderError) {
        console.error(`${error.provider} API error:`, error.message);
        return res.status(error.statusCode || 500).json({
          error: 'AI Error',
          message: error.message,
          provider: error.provider,
        });
      }
      throw error;
    }

    const content = aiResponse.content || '{}';

    // Extract token usage from the provider response
    const promptTokens = aiResponse.usage.promptTokens;
    const completionTokens = aiResponse.usage.completionTokens;

    // Store the page analysis conversation in the session messages
    const existingMessages = existing.messages ? JSON.parse(existing.messages) : [];
    const msgNow = Math.floor(Date.now() / 1000);

    // Add system context if this is the first page (no messages yet)
    if (existingMessages.length === 0) {
      existingMessages.push({
        role: 'system',
        content: `[System Context for Paper Analysis]\n${systemPrompt}`,
        timestamp: msgNow,
      });
    }

    // Add the user request (page content)
    existingMessages.push({
      role: 'user',
      content: `[Analyze Page ${pageNumber}/${totalPages}]\n${userPrompt}`,
      timestamp: msgNow,
    });

    // Add the AI response
    existingMessages.push({
      role: 'assistant',
      content: `[Page ${pageNumber} Analysis]\n${content}`,
      timestamp: msgNow,
    });

    // Update token usage and messages in the session
    db.prepare(`
      UPDATE ai_agent_history
      SET messages = ?,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          conversation_rounds = conversation_rounds + 1,
          updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(existingMessages), promptTokens, completionTokens, msgNow, historyId);

    // Parse the AI response
    let analysis;
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      analysis = JSON.parse(cleanContent.trim());
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      analysis = { sentences: {}, figureTables: {} };
    }

    res.json({
      analysis,
      usage: {
        promptTokens,
        completionTokens,
      },
    });
  } catch (error) {
    console.error('Analyze page error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to analyze page' });
  }
});

// POST /api/papers/:paperId/agent-history/:historyId/complete-reading - Mark reading as complete
router.post('/:paperId/agent-history/:historyId/complete-reading', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { paperId, historyId } = req.params;
    const { sentenceAnalysis, figureTableAnalysis } = req.body;

    // Check history exists and belongs to user
    const existing = db.prepare(`
      SELECT * FROM ai_agent_history WHERE id = ? AND paper_id = ?
    `).get(historyId, paperId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Not Found', message: 'History not found' });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own history' });
    }

    // Add a completion message to the session
    const existingMessages = existing.messages ? JSON.parse(existing.messages) : [];
    const msgNow = Math.floor(Date.now() / 1000);

    // Count sentences by label for the summary
    const labelCounts: Record<string, number> = {};
    let noveltyCount = 0;
    if (sentenceAnalysis) {
      Object.values(sentenceAnalysis).forEach((data: any) => {
        const label = data.label || 'Unknown';
        labelCounts[label] = (labelCounts[label] || 0) + 1;
        if (data.flags?.novelty) noveltyCount++;
      });
    }

    const totalSentences = Object.keys(sentenceAnalysis || {}).length;
    const totalFigures = Object.keys(figureTableAnalysis || {}).length;

    const summaryMessage = `[Reading Complete - Analysis Summary]
Total sentences analyzed: ${totalSentences}
Total figures/tables analyzed: ${totalFigures}
Novelty points identified: ${noveltyCount}

Sentence breakdown by category:
${Object.entries(labelCounts).map(([label, count]) => `- ${label}: ${count}`).join('\n')}

The paper analysis is now complete. You can ask questions about the paper, generate reviews, or request background knowledge recommendations.`;

    existingMessages.push({
      role: 'assistant',
      content: summaryMessage,
      timestamp: msgNow,
    });

    // Update the session with the complete analysis and messages
    db.prepare(`
      UPDATE ai_agent_history
      SET sentence_analysis = ?,
          figure_table_analysis = ?,
          messages = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(sentenceAnalysis || {}),
      JSON.stringify(figureTableAnalysis || {}),
      JSON.stringify(existingMessages),
      msgNow,
      historyId
    );

    // Fetch updated history
    const updated = db.prepare(`
      SELECT h.*, u.display_name as user_name
      FROM ai_agent_history h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = ?
    `).get(historyId) as any;

    res.json({ history: dbRowToAiAgentHistory(updated, updated.user_name) });
  } catch (error) {
    console.error('Complete reading error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to complete reading' });
  }
});

export default router;
