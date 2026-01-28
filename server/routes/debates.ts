import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { requireAuth } from './auth.js';
import { chatCompletion, getProviderForModel } from '../lib/ai-providers/index.js';
import type {
  DebateSession,
  DebateMessage,
  DebateAgentConfig,
  DebateSpeaker,
  CreateDebateRequest,
  UpdateDebateRequest,
  SetDebateApiKeyRequest,
  DebateInterveneRequest,
} from '../../shared/types.js';

const router = Router();

// ============================================================================
// DEFAULT PROMPTS
// ============================================================================

const DEFAULT_AFFIRMATIVE_PROMPT = `You are the AFFIRMATIVE debater in an academic research debate. Your role is to argue IN FAVOR of the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments supporting the proposition
2. Use evidence, logic, and research to support your claims
3. Respond to counterarguments from the negative side
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid counterpoints while defending your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}`;

const DEFAULT_NEGATIVE_PROMPT = `You are the NEGATIVE debater in an academic research debate. Your role is to argue AGAINST the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments opposing the proposition
2. Challenge the affirmative's claims with evidence and logic
3. Identify weaknesses in pro-arguments
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid points while maintaining your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}`;

const DEFAULT_JUDGE_PROMPT = `You are the JUDGE in an academic research debate. Your role is to moderate and ultimately decide the debate.

DEBATE TOPIC: {topic}

YOUR RESPONSIBILITIES:
1. Monitor the debate for rule violations
2. Intervene if arguments become off-topic or circular
3. Ensure both sides get fair opportunity to speak
4. Track the strength of arguments from both sides
5. Deliver a final verdict when the debate concludes

INTERVENTION TRIGGERS (respond with intervention message):
- Off-topic discussion (redirect back to the proposition)
- Repeated arguments (ask for new points)
- Personal attacks (warn and redirect)
- Factual inaccuracies (request clarification)
- Circular reasoning (note it for the record)

When asked to check the debate, respond with "NO_INTERVENTION" if everything is proceeding well.
Otherwise, provide your intervention message.

WHEN CONCLUDING (when explicitly asked to conclude):
Provide a structured verdict:
1. Summary of strongest affirmative arguments
2. Summary of strongest negative arguments
3. Key points of contention
4. Your decision (Affirmative wins / Negative wins / Draw)
5. Reasoning for your decision

{backgroundKnowledge}

{paperContext}`;

// ============================================================================
// HELPERS
// ============================================================================

function encryptApiKey(apiKey: string): string {
  // Simple base64 encoding - in production, use proper encryption
  return Buffer.from(apiKey.trim()).toString('base64');
}

function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf8');
}

function buildPromptWithContext(
  basePrompt: string,
  topic: string,
  backgroundKnowledge?: string,
  papers?: Array<{ id: string; title: string; authors: string[]; abstract?: string }>
): string {
  let prompt = basePrompt.replace('{topic}', topic);

  if (backgroundKnowledge) {
    prompt = prompt.replace('{backgroundKnowledge}', `
BACKGROUND KNOWLEDGE:
${backgroundKnowledge}`);
  } else {
    prompt = prompt.replace('{backgroundKnowledge}', '');
  }

  if (papers && papers.length > 0) {
    const paperContext = papers.map((p, i) => `
[${i + 1}] ${p.title}
Authors: ${p.authors.join(', ')}
${p.abstract ? `Abstract: ${p.abstract}` : ''}`).join('\n');

    prompt = prompt.replace('{paperContext}', `
REFERENCE PAPERS:
${paperContext}

You may cite these papers using [1], [2], etc.`);
  } else {
    prompt = prompt.replace('{paperContext}', '');
  }

  return prompt.trim();
}

function dbRowToDebateSession(row: any, papers?: any[]): DebateSession {
  const affirmativeConfig = JSON.parse(row.affirmative_config);
  const negativeConfig = JSON.parse(row.negative_config);
  const judgeConfig = JSON.parse(row.judge_config);

  // Don't expose encrypted keys to client
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || row.display_name,
    userAvatar: row.user_avatar || row.avatar,
    title: row.title,
    topic: row.topic,
    status: row.status,
    affirmativeConfig: {
      modelId: affirmativeConfig.modelId,
      systemPrompt: affirmativeConfig.systemPrompt,
      apiKeySet: !!affirmativeConfig.apiKeyEncrypted,
    },
    negativeConfig: {
      modelId: negativeConfig.modelId,
      systemPrompt: negativeConfig.systemPrompt,
      apiKeySet: !!negativeConfig.apiKeyEncrypted,
    },
    judgeConfig: {
      modelId: judgeConfig.modelId,
      systemPrompt: judgeConfig.systemPrompt,
      apiKeySet: !!judgeConfig.apiKeyEncrypted,
    },
    messages: JSON.parse(row.messages || '[]'),
    currentSpeaker: row.current_speaker || undefined,
    turnCount: row.turn_count || 0,
    maxTurns: row.max_turns || 20,
    backgroundKnowledge: row.background_knowledge || undefined,
    paperIds: JSON.parse(row.paper_ids || '[]'),
    papers: papers,
    papersRead: row.papers_read || 0,
    readingStatus: row.reading_status || 'pending',
    conclusion: row.conclusion || undefined,
    winner: row.winner || undefined,
    concludedAt: row.concluded_at || undefined,
    totalTokensAffirmative: row.total_tokens_affirmative || 0,
    totalTokensNegative: row.total_tokens_negative || 0,
    totalTokensJudge: row.total_tokens_judge || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getNextSpeaker(session: DebateSession): DebateSpeaker {
  const { messages, turnCount } = session;

  // Opening: Affirmative goes first
  if (turnCount === 0) return 'affirmative';

  // After opening: Negative responds
  if (turnCount === 1) return 'negative';

  // Every 4 turns, judge can intervene
  if (turnCount > 0 && turnCount % 4 === 0) return 'judge';

  // Alternate between affirmative and negative
  const lastDebaterMessage = messages.filter(
    m => m.speaker === 'affirmative' || m.speaker === 'negative'
  ).pop();

  return lastDebaterMessage?.speaker === 'affirmative' ? 'negative' : 'affirmative';
}

async function callAgent(
  config: DebateAgentConfig & { apiKeyEncrypted?: string },
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelId: string
): Promise<{ content: string; tokenCount: number }> {
  if (!config.apiKeyEncrypted) {
    throw new Error('API key not set for this agent');
  }

  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const provider = getProviderForModel(modelId);

  if (!provider) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  const response = await chatCompletion(
    {
      model: modelId,
      messages,
      maxTokens: 1000,
      temperature: 0.7,
    },
    {
      apiKey,
    }
  );

  return {
    content: response.content,
    tokenCount: (response.usage?.promptTokens || 0) + (response.usage?.completionTokens || 0),
  };
}

function buildConversationContext(
  session: DebateSession,
  speaker: DebateSpeaker,
  config: DebateAgentConfig,
  instruction?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // System prompt
  messages.push({ role: 'system', content: config.systemPrompt });

  // Add conversation history
  for (const msg of session.messages) {
    if (msg.speaker === 'user') {
      messages.push({
        role: 'user',
        content: `[USER INSTRUCTION${msg.metadata?.targetAgent ? ` to ${msg.metadata.targetAgent}` : ''}]: ${msg.content}`,
      });
    } else if (msg.speaker === speaker) {
      messages.push({ role: 'assistant', content: msg.content });
    } else {
      // Other speakers' messages shown as user context
      const speakerLabel = msg.speaker.toUpperCase();
      messages.push({
        role: 'user',
        content: `[${speakerLabel}]: ${msg.content}`,
      });
    }
  }

  // Add instruction for this turn
  if (instruction) {
    messages.push({ role: 'user', content: instruction });
  }

  return messages;
}

// ============================================================================
// POST /api/debates - Create new debate
// ============================================================================
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body = req.body as CreateDebateRequest;

    if (!body.title || !body.topic) {
      return res.status(400).json({ error: 'Bad Request', message: 'Title and topic are required' });
    }

    // Fetch papers if provided
    let papers: any[] = [];
    if (body.paperIds && body.paperIds.length > 0) {
      const placeholders = body.paperIds.map(() => '?').join(',');
      papers = db.prepare(`
        SELECT id, title, authors, abstract FROM papers WHERE id IN (${placeholders})
      `).all(...body.paperIds) as any[];
      papers = papers.map(p => ({
        ...p,
        authors: JSON.parse(p.authors || '[]'),
      }));
    }

    // Build prompts
    const affirmativePrompt = body.affirmativeConfig.customPrompt ||
      buildPromptWithContext(DEFAULT_AFFIRMATIVE_PROMPT, body.topic, body.backgroundKnowledge, papers);
    const negativePrompt = body.negativeConfig.customPrompt ||
      buildPromptWithContext(DEFAULT_NEGATIVE_PROMPT, body.topic, body.backgroundKnowledge, papers);
    const judgePrompt = body.judgeConfig.customPrompt ||
      buildPromptWithContext(DEFAULT_JUDGE_PROMPT, body.topic, body.backgroundKnowledge, papers);

    // Create configs
    const affirmativeConfig: any = {
      modelId: body.affirmativeConfig.modelId,
      systemPrompt: affirmativePrompt,
    };
    if (body.affirmativeConfig.apiKey) {
      affirmativeConfig.apiKeyEncrypted = encryptApiKey(body.affirmativeConfig.apiKey);
    }

    const negativeConfig: any = {
      modelId: body.negativeConfig.modelId,
      systemPrompt: negativePrompt,
    };
    if (body.negativeConfig.apiKey) {
      negativeConfig.apiKeyEncrypted = encryptApiKey(body.negativeConfig.apiKey);
    }

    const judgeConfig: any = {
      modelId: body.judgeConfig.modelId,
      systemPrompt: judgePrompt,
    };
    if (body.judgeConfig.apiKey) {
      judgeConfig.apiKeyEncrypted = encryptApiKey(body.judgeConfig.apiKey);
    }

    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // Determine reading status based on readPapersFirst flag
    const hasPapers = body.paperIds && body.paperIds.length > 0;
    const readingStatus = hasPapers && body.readPapersFirst ? 'pending' : 'skipped';

    db.prepare(`
      INSERT INTO debate_sessions (
        id, user_id, title, topic, status,
        affirmative_config, negative_config, judge_config,
        messages, max_turns, background_knowledge, paper_ids,
        reading_status, papers_read,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'setup', ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      user.id,
      body.title,
      body.topic,
      JSON.stringify(affirmativeConfig),
      JSON.stringify(negativeConfig),
      JSON.stringify(judgeConfig),
      body.maxTurns || 20,
      body.backgroundKnowledge || null,
      JSON.stringify(body.paperIds || []),
      readingStatus,
      0,
      now,
      now
    );

    // Fetch and return the created session
    const row = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.status(201).json(dbRowToDebateSession(row, papers));
  } catch (error) {
    console.error('Create debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create debate' });
  }
});

// ============================================================================
// GET /api/debates - List user's debates
// ============================================================================
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, limit = '20', offset = '0' } = req.query;

    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    let whereClause = 'WHERE ds.user_id = ?';
    const params: any[] = [user.id];

    if (status) {
      whereClause += ' AND ds.status = ?';
      params.push(status);
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as total FROM debate_sessions ds ${whereClause}
    `).get(...params) as any;

    const rows = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      ${whereClause}
      ORDER BY ds.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offsetNum) as any[];

    res.json({
      debates: rows.map(row => dbRowToDebateSession(row)),
      total: countRow.total,
    });
  } catch (error) {
    console.error('List debates error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list debates' });
  }
});

// ============================================================================
// GET /api/debates/:id - Get debate details
// ============================================================================
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ? AND ds.user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    // Fetch linked papers
    const paperIds = JSON.parse(row.paper_ids || '[]');
    let papers: any[] = [];
    if (paperIds.length > 0) {
      const placeholders = paperIds.map(() => '?').join(',');
      papers = db.prepare(`
        SELECT id, title, authors, abstract FROM papers WHERE id IN (${placeholders})
      `).all(...paperIds) as any[];
      papers = papers.map(p => ({
        ...p,
        authors: JSON.parse(p.authors || '[]'),
      }));
    }

    res.json(dbRowToDebateSession(row, papers));
  } catch (error) {
    console.error('Get debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get debate' });
  }
});

// ============================================================================
// DELETE /api/debates/:id - Delete debate
// ============================================================================
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = db.prepare(`
      DELETE FROM debate_sessions WHERE id = ? AND user_id = ?
    `).run(id, user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete debate' });
  }
});

// ============================================================================
// PATCH /api/debates/:id - Update debate (setup phase only)
// ============================================================================
router.patch('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const body = req.body as UpdateDebateRequest;

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status !== 'setup') {
      return res.status(400).json({ error: 'Bad Request', message: 'Can only update debates in setup phase' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (body.title) {
      updates.push('title = ?');
      params.push(body.title);
    }

    if (body.topic) {
      updates.push('topic = ?');
      params.push(body.topic);
    }

    if (body.backgroundKnowledge !== undefined) {
      updates.push('background_knowledge = ?');
      params.push(body.backgroundKnowledge || null);
    }

    if (body.paperIds) {
      updates.push('paper_ids = ?');
      params.push(JSON.stringify(body.paperIds));
    }

    if (body.maxTurns) {
      updates.push('max_turns = ?');
      params.push(body.maxTurns);
    }

    // Update prompts
    if (body.affirmativePrompt || body.negativePrompt || body.judgePrompt) {
      const affirmativeConfig = JSON.parse(row.affirmative_config);
      const negativeConfig = JSON.parse(row.negative_config);
      const judgeConfig = JSON.parse(row.judge_config);

      if (body.affirmativePrompt) {
        affirmativeConfig.systemPrompt = body.affirmativePrompt;
        updates.push('affirmative_config = ?');
        params.push(JSON.stringify(affirmativeConfig));
      }

      if (body.negativePrompt) {
        negativeConfig.systemPrompt = body.negativePrompt;
        updates.push('negative_config = ?');
        params.push(JSON.stringify(negativeConfig));
      }

      if (body.judgePrompt) {
        judgeConfig.systemPrompt = body.judgePrompt;
        updates.push('judge_config = ?');
        params.push(JSON.stringify(judgeConfig));
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(Math.floor(Date.now() / 1000));
      params.push(id);

      db.prepare(`
        UPDATE debate_sessions SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    // Return updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json(dbRowToDebateSession(updatedRow));
  } catch (error) {
    console.error('Update debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update debate' });
  }
});

// ============================================================================
// POST /api/debates/:id/set-api-key - Set API key for an agent
// ============================================================================
router.post('/:id/set-api-key', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const body = req.body as SetDebateApiKeyRequest;

    if (!body.agent || !body.apiKey) {
      return res.status(400).json({ error: 'Bad Request', message: 'Agent and apiKey are required' });
    }

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    const configColumn = `${body.agent}_config`;
    const config = JSON.parse(row[configColumn]);

    // Allow setting API key if not already set
    if (config.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API key already set for this agent' });
    }

    config.apiKeyEncrypted = encryptApiKey(body.apiKey);

    db.prepare(`
      UPDATE debate_sessions SET ${configColumn} = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(config), Math.floor(Date.now() / 1000), id);

    // Return the updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json(dbRowToDebateSession(updatedRow));
  } catch (error) {
    console.error('Set API key error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to set API key' });
  }
});

// ============================================================================
// POST /api/debates/:id/start - Start the debate
// ============================================================================
router.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status !== 'setup') {
      return res.status(400).json({ error: 'Bad Request', message: 'Debate already started' });
    }

    // Validate all API keys are set
    const affirmativeConfig = JSON.parse(row.affirmative_config);
    const negativeConfig = JSON.parse(row.negative_config);
    const judgeConfig = JSON.parse(row.judge_config);

    if (!affirmativeConfig.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Affirmative agent API key not set' });
    }
    if (!negativeConfig.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Negative agent API key not set' });
    }
    if (!judgeConfig.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'Judge agent API key not set' });
    }

    // Update status to active
    db.prepare(`
      UPDATE debate_sessions SET status = 'active', current_speaker = 'affirmative', updated_at = ? WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), id);

    // Return updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json({ session: dbRowToDebateSession(updatedRow) });
  } catch (error) {
    console.error('Start debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start debate' });
  }
});

// ============================================================================
// POST /api/debates/:id/continue - Continue to next turn
// ============================================================================
router.post('/:id/continue', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status !== 'active') {
      return res.status(400).json({ error: 'Bad Request', message: 'Debate is not active' });
    }

    // Build session object
    const session = dbRowToDebateSession(row);
    const affirmativeConfig = JSON.parse(row.affirmative_config);
    const negativeConfig = JSON.parse(row.negative_config);
    const judgeConfig = JSON.parse(row.judge_config);

    // Check if max turns reached
    if (session.turnCount >= session.maxTurns) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Max turns reached. Call /conclude to finish the debate.'
      });
    }

    // Determine next speaker
    const nextSpeaker = getNextSpeaker(session);
    let config: any;
    let tokenColumn: string;

    switch (nextSpeaker) {
      case 'affirmative':
        config = affirmativeConfig;
        tokenColumn = 'total_tokens_affirmative';
        break;
      case 'negative':
        config = negativeConfig;
        tokenColumn = 'total_tokens_negative';
        break;
      case 'judge':
        config = judgeConfig;
        tokenColumn = 'total_tokens_judge';
        break;
      default:
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid speaker' });
    }

    // Build instruction based on speaker
    let instruction: string;
    if (nextSpeaker === 'judge') {
      instruction = 'Review the recent exchanges. Should you intervene? Respond with "NO_INTERVENTION" if the debate is proceeding well, otherwise provide your intervention.';
    } else if (session.turnCount === 0) {
      instruction = 'Present your opening argument for the debate.';
    } else {
      instruction = 'Continue the debate. Present your next argument or respond to the opponent\'s points.';
    }

    // Build conversation context
    const context = buildConversationContext(session, nextSpeaker, config, instruction);

    // Call the agent
    const response = await callAgent(config, context, config.modelId);

    // If judge says NO_INTERVENTION, skip and get next debater
    if (nextSpeaker === 'judge' && response.content.trim() === 'NO_INTERVENTION') {
      // Recursively continue with next speaker
      return res.json({
        message: null,
        session: session,
        isComplete: false,
        skippedJudgeIntervention: true,
      });
    }

    // Create message
    const message: DebateMessage = {
      id: uuidv4(),
      speaker: nextSpeaker,
      content: response.content,
      timestamp: Math.floor(Date.now() / 1000),
      tokenCount: response.tokenCount,
      isInterruption: nextSpeaker === 'judge',
    };

    // Update database
    const messages = [...session.messages, message];
    const newTurnCount = session.turnCount + 1;

    db.prepare(`
      UPDATE debate_sessions
      SET messages = ?, turn_count = ?, current_speaker = ?, ${tokenColumn} = ${tokenColumn} + ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(messages),
      newTurnCount,
      nextSpeaker,
      response.tokenCount,
      Math.floor(Date.now() / 1000),
      id
    );

    // Return updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json({
      message,
      session: dbRowToDebateSession(updatedRow),
      isComplete: newTurnCount >= session.maxTurns,
    });
  } catch (error) {
    console.error('Continue debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to continue debate' });
  }
});

// ============================================================================
// POST /api/debates/:id/pause - Pause debate
// ============================================================================
router.post('/:id/pause', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = db.prepare(`
      UPDATE debate_sessions SET status = 'paused', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'
    `).run(Math.floor(Date.now() / 1000), id, user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Active debate not found' });
    }

    // Return the updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json(dbRowToDebateSession(updatedRow));
  } catch (error) {
    console.error('Pause debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to pause debate' });
  }
});

// ============================================================================
// POST /api/debates/:id/resume - Resume debate
// ============================================================================
router.post('/:id/resume', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const result = db.prepare(`
      UPDATE debate_sessions SET status = 'active', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'paused'
    `).run(Math.floor(Date.now() / 1000), id, user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Paused debate not found' });
    }

    // Return the updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json(dbRowToDebateSession(updatedRow));
  } catch (error) {
    console.error('Resume debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to resume debate' });
  }
});

// ============================================================================
// POST /api/debates/:id/intervene - User intervention
// ============================================================================
router.post('/:id/intervene', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const body = req.body as DebateInterveneRequest;

    if (!body.message) {
      return res.status(400).json({ error: 'Bad Request', message: 'Message is required' });
    }

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status !== 'active' && row.status !== 'paused') {
      return res.status(400).json({ error: 'Bad Request', message: 'Cannot intervene in this debate state' });
    }

    // Create user message
    const message: DebateMessage = {
      id: uuidv4(),
      speaker: 'user',
      content: body.message,
      timestamp: Math.floor(Date.now() / 1000),
      isInterruption: true,
      metadata: {
        targetAgent: body.targetAgent,
      },
    };

    // Update database
    const messages = [...JSON.parse(row.messages || '[]'), message];

    db.prepare(`
      UPDATE debate_sessions SET messages = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(messages), Math.floor(Date.now() / 1000), id);

    // Return updated session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json({
      message,
      session: dbRowToDebateSession(updatedRow),
    });
  } catch (error) {
    console.error('Intervene debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to intervene' });
  }
});

// ============================================================================
// POST /api/debates/:id/conclude - Force conclusion
// ============================================================================
router.post('/:id/conclude', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status === 'concluded') {
      return res.status(400).json({ error: 'Bad Request', message: 'Debate already concluded' });
    }

    if (row.status === 'setup') {
      return res.status(400).json({ error: 'Bad Request', message: 'Debate not started yet' });
    }

    const session = dbRowToDebateSession(row);
    const judgeConfig = JSON.parse(row.judge_config);

    // Build conclusion request for judge
    const instruction = `The debate has ended. Please provide your final verdict with:
1. Summary of strongest affirmative arguments
2. Summary of strongest negative arguments
3. Key points of contention
4. Your decision (state clearly: "WINNER: Affirmative" or "WINNER: Negative" or "WINNER: Draw")
5. Reasoning for your decision`;

    const context = buildConversationContext(session, 'judge', judgeConfig, instruction);

    // Call judge for conclusion
    const response = await callAgent(judgeConfig, context, judgeConfig.modelId);

    // Parse winner from response
    let winner: 'affirmative' | 'negative' | 'draw' = 'draw';
    const lowerContent = response.content.toLowerCase();
    if (lowerContent.includes('winner: affirmative') || lowerContent.includes('affirmative wins')) {
      winner = 'affirmative';
    } else if (lowerContent.includes('winner: negative') || lowerContent.includes('negative wins')) {
      winner = 'negative';
    }

    // Create conclusion message
    const message: DebateMessage = {
      id: uuidv4(),
      speaker: 'judge',
      content: response.content,
      timestamp: Math.floor(Date.now() / 1000),
      tokenCount: response.tokenCount,
    };

    // Update database
    const messages = [...session.messages, message];
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      UPDATE debate_sessions
      SET messages = ?, status = 'concluded', conclusion = ?, winner = ?, concluded_at = ?,
          total_tokens_judge = total_tokens_judge + ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(messages),
      response.content,
      winner,
      now,
      response.tokenCount,
      now,
      id
    );

    // Return final session
    const updatedRow = db.prepare(`
      SELECT ds.*, u.display_name, u.avatar
      FROM debate_sessions ds
      JOIN users u ON ds.user_id = u.id
      WHERE ds.id = ?
    `).get(id) as any;

    res.json({
      conclusion: response.content,
      winner,
      session: dbRowToDebateSession(updatedRow),
    });
  } catch (error) {
    console.error('Conclude debate error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to conclude debate' });
  }
});

// POST /api/debates/:id/read-papers - Have agents read linked papers before debate
router.post('/:id/read-papers', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT * FROM debate_sessions WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    if (row.status !== 'setup') {
      return res.status(400).json({ error: 'Bad Request', message: 'Can only read papers during setup phase' });
    }

    const paperIds: string[] = JSON.parse(row.paper_ids || '[]');
    if (paperIds.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No papers linked to this debate' });
    }

    // Check API keys are set
    const affirmativeConfig = JSON.parse(row.affirmative_config);
    const negativeConfig = JSON.parse(row.negative_config);

    if (!affirmativeConfig.apiKeyEncrypted || !negativeConfig.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Bad Request', message: 'API keys must be set for both agents' });
    }

    // Update reading status
    db.prepare(`
      UPDATE debate_sessions SET reading_status = 'reading', updated_at = ? WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), id);

    // Get papers info
    const papers = db.prepare(`
      SELECT id, title, authors, abstract
      FROM papers
      WHERE id IN (${paperIds.map(() => '?').join(',')})
    `).all(...paperIds) as any[];

    // Build context from papers
    let paperContext = '\n\n=== REFERENCE PAPERS ===\n';
    papers.forEach((paper, index) => {
      const authors = JSON.parse(paper.authors || '[]');
      paperContext += `\n[${index + 1}] "${paper.title}"\n`;
      paperContext += `Authors: ${authors.join(', ')}\n`;
      if (paper.abstract) {
        paperContext += `Abstract: ${paper.abstract}\n`;
      }
    });
    paperContext += '\n=== END REFERENCE PAPERS ===\n';
    paperContext += '\nYou have read the above papers. Use them as references in your arguments. Cite using [1], [2], etc.\n';

    // Append paper context to both agent system prompts
    const updatedAffirmativeConfig = {
      ...affirmativeConfig,
      systemPrompt: affirmativeConfig.systemPrompt + paperContext,
    };
    const updatedNegativeConfig = {
      ...negativeConfig,
      systemPrompt: negativeConfig.systemPrompt + paperContext,
    };

    // Update debate session with enhanced prompts and reading status
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE debate_sessions
      SET affirmative_config = ?, negative_config = ?, papers_read = ?, reading_status = 'completed', updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(updatedAffirmativeConfig),
      JSON.stringify(updatedNegativeConfig),
      papers.length,
      now,
      id
    );

    // Return updated debate
    const updated = db.prepare('SELECT * FROM debate_sessions WHERE id = ?').get(id) as any;
    const debate = dbRowToDebateSession(updated);

    // Populate papers
    debate.papers = papers.map(p => ({
      id: p.id,
      title: p.title,
      authors: JSON.parse(p.authors || '[]'),
      abstract: p.abstract,
    }));

    res.json({ debate });
  } catch (error) {
    console.error('Read papers error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to read papers' });
  }
});

// GET /api/debates/:id/reading-progress - Check paper reading progress
router.get('/:id/reading-progress', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const row = db.prepare(`
      SELECT reading_status, papers_read, paper_ids
      FROM debate_sessions
      WHERE id = ? AND user_id = ?
    `).get(id, user.id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Not Found', message: 'Debate not found' });
    }

    const paperIds: string[] = JSON.parse(row.paper_ids || '[]');

    res.json({
      status: row.reading_status || 'pending',
      papersRead: row.papers_read || 0,
      totalPapers: paperIds.length,
      progress: paperIds.length > 0 ? ((row.papers_read || 0) / paperIds.length) * 100 : 0,
    });
  } catch (error) {
    console.error('Get reading progress error:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get reading progress' });
  }
});

export default router;
