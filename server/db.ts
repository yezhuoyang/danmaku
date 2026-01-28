import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file in the project root
const DB_PATH = path.join(__dirname, '..', 'data', 'danmaku.db');

// Ensure the data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Papers table (metadata only, no PDF storage)
  CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY,
    arxiv_id TEXT UNIQUE,
    content_hash TEXT UNIQUE,
    title TEXT NOT NULL,
    authors TEXT,
    abstract TEXT,
    added_by TEXT REFERENCES users(id),
    view_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Annotations table
  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    sentence_id TEXT,
    content TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Ratings table
  CREATE TABLE IF NOT EXISTS ratings (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER CHECK(score >= 1 AND score <= 5),
    novelty_score INTEGER CHECK(novelty_score >= 1 AND novelty_score <= 5),
    created_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (paper_id, user_id)
  );

  -- AI Analysis table (from "Let Agent Read")
  CREATE TABLE IF NOT EXISTS ai_analysis (
    paper_id TEXT PRIMARY KEY REFERENCES papers(id) ON DELETE CASCADE,
    summary TEXT,
    sentence_labels TEXT,
    figure_labels TEXT,
    novelty_count INTEGER DEFAULT 0,
    analyzed_by TEXT REFERENCES users(id),
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Reading sessions (tracks who read what)
  CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_page INTEGER DEFAULT 1,
    total_time_seconds INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(paper_id, user_id)
  );

  -- Sessions table for auth
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL
  );

  -- Figure/Table regions (user-defined, only uploader can edit)
  CREATE TABLE IF NOT EXISTS figure_table_regions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('figure', 'table')),
    label TEXT NOT NULL,
    caption TEXT,
    bounding_rect TEXT NOT NULL,
    image_data TEXT,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- AI Reviews table (conference-style reviews)
  CREATE TABLE IF NOT EXISTS ai_reviews (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    reviewer_expertise INTEGER NOT NULL CHECK(reviewer_expertise >= 1 AND reviewer_expertise <= 4),
    reviewer_expertise_text TEXT NOT NULL,
    reviewer_confidence INTEGER NOT NULL CHECK(reviewer_confidence >= 1 AND reviewer_confidence <= 4),
    reviewer_confidence_text TEXT NOT NULL,
    paper_summary TEXT NOT NULL,
    significance_of_problem INTEGER NOT NULL CHECK(significance_of_problem >= 1 AND significance_of_problem <= 4),
    significance_of_problem_text TEXT NOT NULL,
    novelty_of_solution INTEGER NOT NULL CHECK(novelty_of_solution >= 1 AND novelty_of_solution <= 4),
    novelty_of_solution_text TEXT NOT NULL,
    correctness INTEGER NOT NULL CHECK(correctness >= 1 AND correctness <= 4),
    correctness_text TEXT NOT NULL,
    writing_quality INTEGER NOT NULL CHECK(writing_quality >= 1 AND writing_quality <= 4),
    writing_quality_text TEXT NOT NULL,
    related_work INTEGER NOT NULL CHECK(related_work >= 1 AND related_work <= 4),
    related_work_text TEXT NOT NULL,
    robustness_of_evaluation INTEGER NOT NULL CHECK(robustness_of_evaluation >= 1 AND robustness_of_evaluation <= 4),
    robustness_of_evaluation_text TEXT NOT NULL,
    advancement_disciplines TEXT,
    strengths TEXT NOT NULL,
    weaknesses TEXT NOT NULL,
    comments_for_authors TEXT NOT NULL,
    comments_for_pc TEXT,
    generated_by TEXT NOT NULL,
    generated_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- AI Agent History table (stores conversation history with AI)
  CREATE TABLE IF NOT EXISTS ai_agent_history (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    messages TEXT NOT NULL,           -- JSON array of messages
    is_public INTEGER DEFAULT 0,      -- 0 = private, 1 = public
    is_active INTEGER DEFAULT 0,      -- 0 = inactive, 1 = active (only one per user per paper)
    model_used TEXT NOT NULL,
    sentence_analysis TEXT,           -- JSON object: {sentenceId: {label, comment?, flags?}}
    figure_table_analysis TEXT,       -- JSON object: {figureTableId: {label, comment?, flags?}}
    paragraph_analysis TEXT,          -- JSON object: {paragraphId: AiParagraphAnalysisData}
    section_analysis TEXT,            -- JSON object: {sectionId: AiSectionAnalysisData}
    workflow_config_id TEXT,          -- Reference to reading_workflows.id
    workflow_config_snapshot TEXT,    -- Frozen copy of workflow config at time of analysis
    reading_progress TEXT,            -- JSON object tracking multi-level reading progress
    api_key_encrypted TEXT,           -- Encrypted API key (once set, cannot be changed)
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Reading Workflows table (customizable AI reading configurations)
  CREATE TABLE IF NOT EXISTS reading_workflows (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    config_json TEXT NOT NULL,        -- JSON: ReadingWorkflowConfig
    is_public INTEGER DEFAULT 0,      -- 0 = private, 1 = public/shared
    is_default INTEGER DEFAULT 0,     -- 1 = system default preset
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Necessary Background table (AI-generated background concepts)
  CREATE TABLE IF NOT EXISTS necessary_background (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES ai_agent_history(id) ON DELETE CASCADE,
    concepts TEXT NOT NULL,           -- JSON array of BackgroundConcept
    generated_by TEXT NOT NULL,       -- AI model name
    generated_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- User Reviews table (user-submitted reviews)
  CREATE TABLE IF NOT EXISTS user_reviews (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_summary TEXT NOT NULL,
    significance_of_problem INTEGER NOT NULL CHECK(significance_of_problem >= 1 AND significance_of_problem <= 4),
    significance_of_problem_text TEXT NOT NULL,
    novelty_of_solution INTEGER NOT NULL CHECK(novelty_of_solution >= 1 AND novelty_of_solution <= 4),
    novelty_of_solution_text TEXT NOT NULL,
    correctness INTEGER NOT NULL CHECK(correctness >= 1 AND correctness <= 4),
    correctness_text TEXT NOT NULL,
    writing_quality INTEGER NOT NULL CHECK(writing_quality >= 1 AND writing_quality <= 4),
    writing_quality_text TEXT NOT NULL,
    related_work INTEGER NOT NULL CHECK(related_work >= 1 AND related_work <= 4),
    related_work_text TEXT NOT NULL,
    robustness_of_evaluation INTEGER NOT NULL CHECK(robustness_of_evaluation >= 1 AND robustness_of_evaluation <= 4),
    robustness_of_evaluation_text TEXT NOT NULL,
    advancement_disciplines TEXT,
    strengths TEXT NOT NULL,
    weaknesses TEXT NOT NULL,
    comments_for_authors TEXT NOT NULL,
    comments_for_readers TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(paper_id, user_id)  -- One review per user per paper
  );

  -- Paper collections (bookmarks/favorites)
  CREATE TABLE IF NOT EXISTS paper_collections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    note TEXT,                      -- Optional note about why collected
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, paper_id)       -- One collection entry per user per paper
  );

  -- User following relationships
  CREATE TABLE IF NOT EXISTS user_follows (
    id TEXT PRIMARY KEY,
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)  -- Can't follow yourself
  );

  -- Likes/Dislikes table (for annotations, comments, reviews, backgrounds, sessions)
  CREATE TABLE IF NOT EXISTS likes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK(target_type IN ('annotation', 'comment', 'user_review', 'ai_review', 'necessary_background', 'ai_session')),
    target_id TEXT NOT NULL,
    is_like INTEGER NOT NULL CHECK(is_like IN (0, 1)),  -- 0 = dislike, 1 = like
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, target_type, target_id)  -- One vote per user per target
  );

  -- Quiz sessions table (for "Test My Understanding" feature)
  CREATE TABLE IF NOT EXISTS quiz_sessions (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    history_id TEXT NOT NULL REFERENCES ai_agent_history(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_question_number INTEGER DEFAULT 0,  -- 0 = not started, 1-10 = in progress, 11 = completed
    questions TEXT NOT NULL DEFAULT '[]',       -- JSON array of QuizQuestion
    answers TEXT NOT NULL DEFAULT '[]',         -- JSON array of QuizAnswer
    final_score INTEGER,                        -- 0-10 score after completion
    final_diagnosis TEXT,                       -- AI's assessment
    suggestions TEXT,                           -- JSON array of suggestions
    created_at INTEGER DEFAULT (unixepoch()),
    completed_at INTEGER
  );

  -- Notifications table (for social interactions)
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('follow', 'reply', 'like', 'annotation', 'comment', 'ai_review', 'user_review')),
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT,              -- Type of target (paper, annotation, comment, etc.)
    target_id TEXT,                -- ID of the target
    target_title TEXT,             -- Title or preview text of the target
    paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
    is_read INTEGER DEFAULT 0,     -- 0 = unread, 1 = read
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Create indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_papers_arxiv_id ON papers(arxiv_id);
  CREATE INDEX IF NOT EXISTS idx_papers_content_hash ON papers(content_hash);
  CREATE INDEX IF NOT EXISTS idx_annotations_paper_id ON annotations(paper_id);
  CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id);
  CREATE INDEX IF NOT EXISTS idx_reading_sessions_paper_id ON reading_sessions(paper_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_figure_table_regions_paper_id ON figure_table_regions(paper_id);
  CREATE INDEX IF NOT EXISTS idx_ai_reviews_paper_id ON ai_reviews(paper_id);
  CREATE INDEX IF NOT EXISTS idx_ai_agent_history_paper_id ON ai_agent_history(paper_id);
  CREATE INDEX IF NOT EXISTS idx_ai_agent_history_user_id ON ai_agent_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_necessary_background_paper_id ON necessary_background(paper_id);
  CREATE INDEX IF NOT EXISTS idx_necessary_background_session_id ON necessary_background(session_id);
  CREATE INDEX IF NOT EXISTS idx_user_reviews_paper_id ON user_reviews(paper_id);
  CREATE INDEX IF NOT EXISTS idx_user_reviews_user_id ON user_reviews(user_id);
  CREATE INDEX IF NOT EXISTS idx_paper_collections_user_id ON paper_collections(user_id);
  CREATE INDEX IF NOT EXISTS idx_paper_collections_paper_id ON paper_collections(paper_id);
  CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
  CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);
  CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
  CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_sessions_paper_id ON quiz_sessions(paper_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON quiz_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_sessions_history_id ON quiz_sessions(history_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
  CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
`);

// Migration: Add tags column to papers table if it doesn't exist
try {
  const papersTableInfo = db.prepare("PRAGMA table_info(papers)").all() as any[];
  const papersColumns = papersTableInfo.map(col => col.name);

  if (!papersColumns.includes('tags')) {
    db.exec("ALTER TABLE papers ADD COLUMN tags TEXT DEFAULT '[]'");
    console.log('Migration: Added tags column to papers');
  }
} catch (error) {
  console.error('Papers migration error:', error);
}

// Migration: Add profile columns to users if they don't exist
try {
  const userTableInfo = db.prepare("PRAGMA table_info(users)").all() as any[];
  const userColumns = userTableInfo.map(col => col.name);

  if (!userColumns.includes('avatar')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
    console.log('Migration: Added avatar column to users');
  }

  if (!userColumns.includes('research_interests')) {
    db.exec("ALTER TABLE users ADD COLUMN research_interests TEXT");
    console.log('Migration: Added research_interests column to users');
  }

  if (!userColumns.includes('bio')) {
    db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
    console.log('Migration: Added bio column to users');
  }

  if (!userColumns.includes('is_admin')) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
    console.log('Migration: Added is_admin column to users');
  }
} catch (error) {
  console.error('User migration error:', error);
}

// Migration: Add AI analysis columns to ai_agent_history if they don't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(ai_agent_history)").all() as any[];
  const columns = tableInfo.map(col => col.name);

  if (!columns.includes('sentence_analysis')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN sentence_analysis TEXT");
    console.log('Migration: Added sentence_analysis column to ai_agent_history');
  }

  if (!columns.includes('figure_table_analysis')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN figure_table_analysis TEXT");
    console.log('Migration: Added figure_table_analysis column to ai_agent_history');
  }

  if (!columns.includes('api_key_encrypted')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN api_key_encrypted TEXT");
    console.log('Migration: Added api_key_encrypted column to ai_agent_history');
  }

  // Token usage tracking columns
  if (!columns.includes('total_prompt_tokens')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN total_prompt_tokens INTEGER DEFAULT 0");
    console.log('Migration: Added total_prompt_tokens column to ai_agent_history');
  }

  if (!columns.includes('total_completion_tokens')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN total_completion_tokens INTEGER DEFAULT 0");
    console.log('Migration: Added total_completion_tokens column to ai_agent_history');
  }

  if (!columns.includes('max_context_tokens')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN max_context_tokens INTEGER DEFAULT 128000");
    console.log('Migration: Added max_context_tokens column to ai_agent_history');
  }

  if (!columns.includes('conversation_rounds')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN conversation_rounds INTEGER DEFAULT 0");
    console.log('Migration: Added conversation_rounds column to ai_agent_history');
  }

  // Add model_id column for AI model arena tracking
  if (!columns.includes('model_id')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN model_id TEXT");
    console.log('Migration: Added model_id column to ai_agent_history');
  }

  // Add open_questions and research_ideas columns for AI Insights feature
  if (!columns.includes('open_questions')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN open_questions TEXT");
    console.log('Migration: Added open_questions column to ai_agent_history');
  }

  if (!columns.includes('research_ideas')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN research_ideas TEXT");
    console.log('Migration: Added research_ideas column to ai_agent_history');
  }

  // Add token_limit column for user-set spending limit
  if (!columns.includes('token_limit')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN token_limit INTEGER DEFAULT 100000");
    console.log('Migration: Added token_limit column to ai_agent_history');
  }
} catch (error) {
  console.error('Migration error:', error);
}

// Migration: Update likes table CHECK constraint to include all target types
try {
  const testStmt = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='likes'");
  const tableSchema = testStmt.get() as { sql: string } | undefined;

  if (tableSchema && !tableSchema.sql.includes('challenge_problem')) {
    console.log('Migration: Updating likes table to include challenge_problem in CHECK constraint...');

    // SQLite doesn't support ALTER TABLE to modify constraints, so we need to recreate the table
    db.exec(`
      -- Create new table with updated constraint
      CREATE TABLE IF NOT EXISTS likes_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL CHECK(target_type IN ('annotation', 'comment', 'user_review', 'ai_review', 'necessary_background', 'ai_session', 'challenge_problem', 'challenge_comment')),
        target_id TEXT NOT NULL,
        is_like INTEGER NOT NULL CHECK(is_like IN (0, 1)),
        created_at INTEGER DEFAULT (unixepoch()),
        UNIQUE(user_id, target_type, target_id)
      );

      -- Copy existing data
      INSERT OR IGNORE INTO likes_new SELECT * FROM likes;

      -- Drop old table
      DROP TABLE likes;

      -- Rename new table
      ALTER TABLE likes_new RENAME TO likes;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id);
    `);

    console.log('Migration: Updated likes table with challenge_problem support');
  }
} catch (error) {
  console.error('Likes table migration error:', error);
}

// Challenge Problems tables (Research Problems & Ideas feature with progress tree)
db.exec(`
  -- Challenge problems table (research questions and ideas with hierarchical progress tree)
  CREATE TABLE IF NOT EXISTS challenge_problems (
    id TEXT PRIMARY KEY,
    -- Source information
    paper_id TEXT REFERENCES papers(id) ON DELETE SET NULL,
    history_id TEXT REFERENCES ai_agent_history(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Progress Tree: Hierarchical structure (self-referencing)
    parent_id TEXT REFERENCES challenge_problems(id) ON DELETE CASCADE,
    root_id TEXT REFERENCES challenge_problems(id) ON DELETE CASCADE,
    depth INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,

    -- Problem details
    type TEXT NOT NULL CHECK(type IN ('open_question', 'research_idea')),
    status TEXT NOT NULL DEFAULT 'unsolved' CHECK(status IN ('unsolved', 'investigating', 'solved')),
    title TEXT NOT NULL,
    description TEXT,
    context TEXT,

    -- For research ideas (additional fields)
    methodology TEXT,
    expected_outcome TEXT,
    feasibility TEXT CHECK(feasibility IN ('high', 'medium', 'low', NULL)),
    novelty TEXT CHECK(novelty IN ('incremental', 'moderate', 'breakthrough', NULL)),
    prerequisites TEXT,

    -- Categorization
    importance TEXT CHECK(importance IN ('high', 'medium', 'low', NULL)),
    area TEXT,
    tags TEXT DEFAULT '[]',

    -- Solution tracking
    solved_by TEXT REFERENCES users(id),
    solved_at INTEGER,
    solution_summary TEXT,

    -- Engagement metrics
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    child_count INTEGER DEFAULT 0,
    linked_idea_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Challenge idea links (connects research ideas to questions they address)
  CREATE TABLE IF NOT EXISTS challenge_idea_links (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
    idea_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'addresses' CHECK(relationship IN ('addresses', 'partial', 'inspired_by')),
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(question_id, idea_id)
  );

  -- Challenge comments (discussions on problems)
  CREATE TABLE IF NOT EXISTS challenge_comments (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES challenge_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Indexes for challenge problems
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_paper_id ON challenge_problems(paper_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_user_id ON challenge_problems(user_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_type ON challenge_problems(type);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_status ON challenge_problems(status);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_area ON challenge_problems(area);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_created_at ON challenge_problems(created_at);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_parent_id ON challenge_problems(parent_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_problems_root_id ON challenge_problems(root_id);

  -- Indexes for idea links
  CREATE INDEX IF NOT EXISTS idx_challenge_idea_links_question_id ON challenge_idea_links(question_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_idea_links_idea_id ON challenge_idea_links(idea_id);

  -- Indexes for comments
  CREATE INDEX IF NOT EXISTS idx_challenge_comments_problem_id ON challenge_comments(problem_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_comments_user_id ON challenge_comments(user_id);
`);

// Challenge Problem Links (cross-paper relationships) and AI curation tables
db.exec(`
  -- Cross-paper relationship links between challenge problems
  CREATE TABLE IF NOT EXISTS challenge_problem_links (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES challenge_problems(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK(relationship IN ('extends', 'contradicts', 'builds_on', 'supersedes', 'related')),
    confidence REAL DEFAULT 1.0,
    ai_generated INTEGER DEFAULT 0,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(source_id, target_id, relationship)
  );

  -- AI curation job tracking
  CREATE TABLE IF NOT EXISTS challenge_curation_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    scope TEXT,
    results TEXT,
    ideas_analyzed INTEGER DEFAULT 0,
    suggestions_made INTEGER DEFAULT 0,
    error_message TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Indexes for challenge problem links
  CREATE INDEX IF NOT EXISTS idx_challenge_problem_links_source ON challenge_problem_links(source_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_problem_links_target ON challenge_problem_links(target_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_problem_links_relationship ON challenge_problem_links(relationship);

  -- Index for curation jobs
  CREATE INDEX IF NOT EXISTS idx_challenge_curation_jobs_user ON challenge_curation_jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_curation_jobs_status ON challenge_curation_jobs(status);
`);

// Add new columns to challenge_problems for AI-managed features (migration-safe)
try {
  db.exec(`ALTER TABLE challenge_problems ADD COLUMN source_history_id TEXT REFERENCES ai_agent_history(id) ON DELETE SET NULL`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE challenge_problems ADD COLUMN source_type TEXT DEFAULT 'manual' CHECK(source_type IN ('manual', 'promoted', 'ai_generated'))`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE challenge_problems ADD COLUMN ai_suggested INTEGER DEFAULT 0`);
} catch (e) { /* Column already exists */ }

try {
  db.exec(`ALTER TABLE challenge_problems ADD COLUMN promotion_score REAL`);
} catch (e) { /* Column already exists */ }

// AI Research Debate tables
db.exec(`
  -- Debate sessions table (AI-powered research debates)
  CREATE TABLE IF NOT EXISTS debate_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'setup' CHECK(status IN ('setup', 'active', 'paused', 'concluded')),

    -- Agent configurations (JSON objects with modelId, systemPrompt, apiKeyEncrypted)
    affirmative_config TEXT NOT NULL,
    negative_config TEXT NOT NULL,
    judge_config TEXT NOT NULL,

    -- Conversation state
    messages TEXT DEFAULT '[]',           -- JSON array of DebateMessage
    current_speaker TEXT,                 -- 'affirmative' | 'negative' | 'judge' | 'user'
    turn_count INTEGER DEFAULT 0,
    max_turns INTEGER DEFAULT 20,

    -- Background knowledge
    background_knowledge TEXT,
    paper_ids TEXT DEFAULT '[]',          -- JSON array of paper IDs

    -- Conclusion
    conclusion TEXT,
    winner TEXT CHECK(winner IN ('affirmative', 'negative', 'draw', NULL)),
    concluded_at INTEGER,

    -- Token tracking
    total_tokens_affirmative INTEGER DEFAULT 0,
    total_tokens_negative INTEGER DEFAULT 0,
    total_tokens_judge INTEGER DEFAULT 0,

    -- Timestamps
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Indexes for debate sessions
  CREATE INDEX IF NOT EXISTS idx_debate_sessions_user_id ON debate_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_debate_sessions_status ON debate_sessions(status);
  CREATE INDEX IF NOT EXISTS idx_debate_sessions_created_at ON debate_sessions(created_at);
`);

// Agent Lego tables (minimal server storage - most data in browser IndexedDB)
db.exec(`
  -- Workflow metadata (only basic info, full workflow in browser)
  CREATE TABLE IF NOT EXISTS agent_workflow_metadata (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Workflow templates (community sharing)
  CREATE TABLE IF NOT EXISTS agent_workflow_templates (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    blocks_json TEXT NOT NULL,
    connections_json TEXT NOT NULL,
    use_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Indexes for agent lego
  CREATE INDEX IF NOT EXISTS idx_agent_workflow_metadata_user_id ON agent_workflow_metadata(user_id);
  CREATE INDEX IF NOT EXISTS idx_agent_workflow_metadata_is_public ON agent_workflow_metadata(is_public);
  CREATE INDEX IF NOT EXISTS idx_agent_workflow_templates_author_id ON agent_workflow_templates(author_id);
  CREATE INDEX IF NOT EXISTS idx_agent_workflow_templates_category ON agent_workflow_templates(category);
`);

// Categories table (hierarchical tag system for organizing papers)
db.exec(`
  -- Categories table with hierarchical structure
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL DEFAULT 0,
    path TEXT NOT NULL DEFAULT '/',
    order_index INTEGER NOT NULL DEFAULT 0,
    icon TEXT,
    color TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Paper-Category junction table (many-to-many relationship)
  CREATE TABLE IF NOT EXISTS paper_categories (
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (paper_id, category_id)
  );

  -- Indexes for categories
  CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
  CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
  CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path);
  CREATE INDEX IF NOT EXISTS idx_paper_categories_paper_id ON paper_categories(paper_id);
  CREATE INDEX IF NOT EXISTS idx_paper_categories_category_id ON paper_categories(category_id);
`);

// Seed default categories if table is empty
// Based on arXiv categories with comprehensive coverage
try {
  const categoryCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as any).count;
  if (categoryCount === 0) {
    const seedCategories = [
      // ===== ROOT CATEGORIES =====
      { id: 'cs', name: 'Computer Science', slug: 'cs', path: '/cs', depth: 0, order: 0, icon: 'Cpu', color: 'blue' },
      { id: 'math', name: 'Mathematics', slug: 'math', path: '/math', depth: 0, order: 1, icon: 'Calculator', color: 'green' },
      { id: 'physics', name: 'Physics', slug: 'physics', path: '/physics', depth: 0, order: 2, icon: 'Atom', color: 'purple' },
      { id: 'stat', name: 'Statistics', slug: 'stat', path: '/stat', depth: 0, order: 3, icon: 'BarChart', color: 'cyan' },
      { id: 'eess', name: 'Electrical Engineering', slug: 'eess', path: '/eess', depth: 0, order: 4, icon: 'Zap', color: 'yellow' },
      { id: 'q-bio', name: 'Quantitative Biology', slug: 'q-bio', path: '/q-bio', depth: 0, order: 5, icon: 'Dna', color: 'emerald' },
      { id: 'q-fin', name: 'Quantitative Finance', slug: 'q-fin', path: '/q-fin', depth: 0, order: 6, icon: 'TrendingUp', color: 'amber' },
      { id: 'econ', name: 'Economics', slug: 'econ', path: '/econ', depth: 0, order: 7, icon: 'Scale', color: 'orange' },

      // ===== COMPUTER SCIENCE SUBCATEGORIES =====
      { id: 'cs.AI', name: 'Artificial Intelligence', slug: 'cs-ai', path: '/cs/ai', parentId: 'cs', depth: 1, order: 0, icon: 'Brain', color: 'indigo' },
      { id: 'cs.LG', name: 'Machine Learning', slug: 'cs-lg', path: '/cs/lg', parentId: 'cs', depth: 1, order: 1, icon: 'Sparkles', color: 'violet' },
      { id: 'cs.CV', name: 'Computer Vision', slug: 'cs-cv', path: '/cs/cv', parentId: 'cs', depth: 1, order: 2, icon: 'Eye', color: 'rose' },
      { id: 'cs.CL', name: 'Computation & Language (NLP)', slug: 'cs-cl', path: '/cs/cl', parentId: 'cs', depth: 1, order: 3, icon: 'MessageSquare', color: 'pink' },
      { id: 'cs.RO', name: 'Robotics', slug: 'cs-ro', path: '/cs/ro', parentId: 'cs', depth: 1, order: 4, icon: 'CircuitBoard', color: 'teal' },
      { id: 'cs.CC', name: 'Computational Complexity', slug: 'cs-cc', path: '/cs/cc', parentId: 'cs', depth: 1, order: 5, icon: 'Binary', color: 'slate' },
      { id: 'cs.DS', name: 'Data Structures & Algorithms', slug: 'cs-ds', path: '/cs/ds', parentId: 'cs', depth: 1, order: 6, icon: 'Layers', color: 'sky' },
      { id: 'cs.CR', name: 'Cryptography & Security', slug: 'cs-cr', path: '/cs/cr', parentId: 'cs', depth: 1, order: 7, icon: 'Shield', color: 'red' },
      { id: 'cs.DC', name: 'Distributed Computing', slug: 'cs-dc', path: '/cs/dc', parentId: 'cs', depth: 1, order: 8, icon: 'Network', color: 'cyan' },
      { id: 'cs.DB', name: 'Databases', slug: 'cs-db', path: '/cs/db', parentId: 'cs', depth: 1, order: 9, icon: 'Database', color: 'orange' },
      { id: 'cs.SE', name: 'Software Engineering', slug: 'cs-se', path: '/cs/se', parentId: 'cs', depth: 1, order: 10, icon: 'Code', color: 'lime' },
      { id: 'cs.PL', name: 'Programming Languages', slug: 'cs-pl', path: '/cs/pl', parentId: 'cs', depth: 1, order: 11, icon: 'Workflow', color: 'amber' },
      { id: 'cs.HC', name: 'Human-Computer Interaction', slug: 'cs-hc', path: '/cs/hc', parentId: 'cs', depth: 1, order: 12, icon: 'Globe', color: 'blue' },
      { id: 'cs.GT', name: 'Game Theory', slug: 'cs-gt', path: '/cs/gt', parentId: 'cs', depth: 1, order: 13, icon: 'Dice5', color: 'purple' },
      { id: 'cs.IR', name: 'Information Retrieval', slug: 'cs-ir', path: '/cs/ir', parentId: 'cs', depth: 1, order: 14, icon: 'BookOpen', color: 'emerald' },
      { id: 'cs.NE', name: 'Neural & Evolutionary Computing', slug: 'cs-ne', path: '/cs/ne', parentId: 'cs', depth: 1, order: 15, icon: 'Lightbulb', color: 'yellow' },

      // ===== MATHEMATICS SUBCATEGORIES =====
      { id: 'math.AG', name: 'Algebraic Geometry', slug: 'math-ag', path: '/math/ag', parentId: 'math', depth: 1, order: 0, icon: 'Sigma', color: 'green' },
      { id: 'math.AT', name: 'Algebraic Topology', slug: 'math-at', path: '/math/at', parentId: 'math', depth: 1, order: 1, icon: 'Layers', color: 'teal' },
      { id: 'math.CA', name: 'Classical Analysis', slug: 'math-ca', path: '/math/ca', parentId: 'math', depth: 1, order: 2, icon: 'LineChart', color: 'lime' },
      { id: 'math.CO', name: 'Combinatorics', slug: 'math-co', path: '/math/co', parentId: 'math', depth: 1, order: 3, icon: 'Dice5', color: 'sky' },
      { id: 'math.DG', name: 'Differential Geometry', slug: 'math-dg', path: '/math/dg', parentId: 'math', depth: 1, order: 4, icon: 'Orbit', color: 'purple' },
      { id: 'math.NA', name: 'Numerical Analysis', slug: 'math-na', path: '/math/na', parentId: 'math', depth: 1, order: 5, icon: 'Calculator', color: 'blue' },
      { id: 'math.NT', name: 'Number Theory', slug: 'math-nt', path: '/math/nt', parentId: 'math', depth: 1, order: 6, icon: 'Binary', color: 'indigo' },
      { id: 'math.OC', name: 'Optimization & Control', slug: 'math-oc', path: '/math/oc', parentId: 'math', depth: 1, order: 7, icon: 'TrendingUp', color: 'orange' },
      { id: 'math.PR', name: 'Probability', slug: 'math-pr', path: '/math/pr', parentId: 'math', depth: 1, order: 8, icon: 'Dice5', color: 'cyan' },
      { id: 'math.ST', name: 'Statistics Theory', slug: 'math-st', path: '/math/st', parentId: 'math', depth: 1, order: 9, icon: 'BarChart', color: 'emerald' },

      // ===== PHYSICS SUBCATEGORIES =====
      { id: 'physics.QP', name: 'Quantum Physics', slug: 'physics-qp', path: '/physics/qp', parentId: 'physics', depth: 1, order: 0, icon: 'Atom', color: 'violet' },
      { id: 'physics.HEP', name: 'High Energy Physics', slug: 'physics-hep', path: '/physics/hep', parentId: 'physics', depth: 1, order: 1, icon: 'Zap', color: 'yellow' },
      { id: 'physics.CM', name: 'Condensed Matter', slug: 'physics-cm', path: '/physics/cm', parentId: 'physics', depth: 1, order: 2, icon: 'Box', color: 'teal' },
      { id: 'physics.GR', name: 'General Relativity', slug: 'physics-gr', path: '/physics/gr', parentId: 'physics', depth: 1, order: 3, icon: 'Orbit', color: 'slate' },
      { id: 'physics.AP', name: 'Applied Physics', slug: 'physics-ap', path: '/physics/ap', parentId: 'physics', depth: 1, order: 4, icon: 'FlaskConical', color: 'blue' },
      { id: 'physics.AO', name: 'Astrophysics', slug: 'physics-ao', path: '/physics/ao', parentId: 'physics', depth: 1, order: 5, icon: 'Globe', color: 'indigo' },
      { id: 'physics.QC', name: 'Quantum Computing', slug: 'physics-qc', path: '/physics/qc', parentId: 'physics', depth: 1, order: 6, icon: 'CircuitBoard', color: 'cyan' },

      // ===== STATISTICS SUBCATEGORIES =====
      { id: 'stat.ML', name: 'Machine Learning', slug: 'stat-ml', path: '/stat/ml', parentId: 'stat', depth: 1, order: 0, icon: 'Sparkles', color: 'violet' },
      { id: 'stat.ME', name: 'Methodology', slug: 'stat-me', path: '/stat/me', parentId: 'stat', depth: 1, order: 1, icon: 'Workflow', color: 'blue' },
      { id: 'stat.TH', name: 'Theory', slug: 'stat-th', path: '/stat/th', parentId: 'stat', depth: 1, order: 2, icon: 'Sigma', color: 'green' },
      { id: 'stat.AP', name: 'Applications', slug: 'stat-ap', path: '/stat/ap', parentId: 'stat', depth: 1, order: 3, icon: 'LineChart', color: 'orange' },

      // ===== ELECTRICAL ENGINEERING SUBCATEGORIES =====
      { id: 'eess.SP', name: 'Signal Processing', slug: 'eess-sp', path: '/eess/sp', parentId: 'eess', depth: 1, order: 0, icon: 'Zap', color: 'yellow' },
      { id: 'eess.IV', name: 'Image & Video Processing', slug: 'eess-iv', path: '/eess/iv', parentId: 'eess', depth: 1, order: 1, icon: 'Eye', color: 'rose' },
      { id: 'eess.AS', name: 'Audio & Speech Processing', slug: 'eess-as', path: '/eess/as', parentId: 'eess', depth: 1, order: 2, icon: 'Music', color: 'pink' },
      { id: 'eess.SY', name: 'Systems & Control', slug: 'eess-sy', path: '/eess/sy', parentId: 'eess', depth: 1, order: 3, icon: 'Server', color: 'teal' },

      // ===== QUANTITATIVE BIOLOGY SUBCATEGORIES =====
      { id: 'q-bio.BM', name: 'Biomolecules', slug: 'q-bio-bm', path: '/q-bio/bm', parentId: 'q-bio', depth: 1, order: 0, icon: 'Dna', color: 'emerald' },
      { id: 'q-bio.GN', name: 'Genomics', slug: 'q-bio-gn', path: '/q-bio/gn', parentId: 'q-bio', depth: 1, order: 1, icon: 'Microscope', color: 'green' },
      { id: 'q-bio.NC', name: 'Neurons & Cognition', slug: 'q-bio-nc', path: '/q-bio/nc', parentId: 'q-bio', depth: 1, order: 2, icon: 'Brain', color: 'indigo' },
      { id: 'q-bio.QM', name: 'Quantitative Methods', slug: 'q-bio-qm', path: '/q-bio/qm', parentId: 'q-bio', depth: 1, order: 3, icon: 'BarChart', color: 'cyan' },

      // ===== QUANTITATIVE FINANCE SUBCATEGORIES =====
      { id: 'q-fin.PM', name: 'Portfolio Management', slug: 'q-fin-pm', path: '/q-fin/pm', parentId: 'q-fin', depth: 1, order: 0, icon: 'TrendingUp', color: 'amber' },
      { id: 'q-fin.RM', name: 'Risk Management', slug: 'q-fin-rm', path: '/q-fin/rm', parentId: 'q-fin', depth: 1, order: 1, icon: 'Shield', color: 'red' },
      { id: 'q-fin.ST', name: 'Statistical Finance', slug: 'q-fin-st', path: '/q-fin/st', parentId: 'q-fin', depth: 1, order: 2, icon: 'BarChart', color: 'blue' },

      // ===== ECONOMICS SUBCATEGORIES =====
      { id: 'econ.EM', name: 'Econometrics', slug: 'econ-em', path: '/econ/em', parentId: 'econ', depth: 1, order: 0, icon: 'LineChart', color: 'orange' },
      { id: 'econ.GN', name: 'General Economics', slug: 'econ-gn', path: '/econ/gn', parentId: 'econ', depth: 1, order: 1, icon: 'Scale', color: 'amber' },
      { id: 'econ.TH', name: 'Theoretical Economics', slug: 'econ-th', path: '/econ/th', parentId: 'econ', depth: 1, order: 2, icon: 'Sigma', color: 'green' },
    ];

    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, slug, path, parent_id, depth, order_index, icon, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const cat of seedCategories) {
      insertCategory.run(cat.id, cat.name, cat.slug, cat.path, cat.parentId || null, cat.depth, cat.order, cat.icon, cat.color);
    }
    console.log('Migration: Seeded default categories');
  }
} catch (error) {
  console.error('Category seeding error:', error);
}

// Paper Avatars table (AI-generated visual representations of papers)
db.exec(`
  CREATE TABLE IF NOT EXISTS paper_avatars (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,           -- Base64 data URI
    prompt TEXT NOT NULL,               -- Prompt used to generate the image
    generation_model TEXT NOT NULL,     -- e.g., "dall-e-3"
    style TEXT DEFAULT 'diagram',       -- diagram, infographic, conceptual, technical
    is_active INTEGER DEFAULT 0,        -- 1 = currently displayed avatar for the paper
    session_id TEXT REFERENCES ai_agent_history(id) ON DELETE SET NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Indexes for paper avatars
  CREATE INDEX IF NOT EXISTS idx_paper_avatars_paper_id ON paper_avatars(paper_id);
  CREATE INDEX IF NOT EXISTS idx_paper_avatars_user_id ON paper_avatars(user_id);
  CREATE INDEX IF NOT EXISTS idx_paper_avatars_active ON paper_avatars(paper_id, is_active);
`);

// Migration: Add active_avatar_url column to papers table
try {
  const papersTableInfo = db.prepare("PRAGMA table_info(papers)").all() as any[];
  const papersColumns = papersTableInfo.map(col => col.name);

  if (!papersColumns.includes('active_avatar_url')) {
    db.exec("ALTER TABLE papers ADD COLUMN active_avatar_url TEXT");
    console.log('Migration: Added active_avatar_url column to papers');
  }
} catch (error) {
  console.error('Paper avatar migration error:', error);
}

// Feedback/Feature Request table (public submissions)
db.exec(`
  CREATE TABLE IF NOT EXISTS feedback_requests (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('bug', 'feature')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    images TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    submitter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    submitter_name TEXT,
    submitter_email TEXT,
    upvotes INTEGER DEFAULT 0,
    admin_response TEXT,
    resolved_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Feedback upvotes (track who upvoted)
  CREATE TABLE IF NOT EXISTS feedback_upvotes (
    feedback_id TEXT NOT NULL REFERENCES feedback_requests(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (feedback_id, user_id)
  );

  -- Indexes for feedback
  CREATE INDEX IF NOT EXISTS idx_feedback_requests_type ON feedback_requests(type);
  CREATE INDEX IF NOT EXISTS idx_feedback_requests_status ON feedback_requests(status);
  CREATE INDEX IF NOT EXISTS idx_feedback_requests_submitter_id ON feedback_requests(submitter_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_upvotes_feedback_id ON feedback_upvotes(feedback_id);
`);

// Migration: Add images column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(feedback_requests)").all() as any[];
  const hasImages = columns.some(col => col.name === 'images');
  if (!hasImages) {
    db.exec("ALTER TABLE feedback_requests ADD COLUMN images TEXT");
    console.log('Migration: Added images column to feedback_requests');
  }
} catch (error) {
  console.error('Migration error for feedback images:', error);
}

// Paper Collaborators table (for private paper access control)
db.exec(`
  CREATE TABLE IF NOT EXISTS paper_collaborators (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer', 'commenter', 'editor')),
    invited_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(paper_id, user_id)
  );

  -- Indexes for paper collaborators
  CREATE INDEX IF NOT EXISTS idx_paper_collaborators_paper_id ON paper_collaborators(paper_id);
  CREATE INDEX IF NOT EXISTS idx_paper_collaborators_user_id ON paper_collaborators(user_id);
`);

// Migration: Add visibility and fork columns to papers table
try {
  const papersTableInfo = db.prepare("PRAGMA table_info(papers)").all() as any[];
  const papersColumns = papersTableInfo.map(col => col.name);

  if (!papersColumns.includes('visibility')) {
    db.exec("ALTER TABLE papers ADD COLUMN visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'private'))");
    console.log('Migration: Added visibility column to papers');
  }

  if (!papersColumns.includes('forked_from_id')) {
    db.exec("ALTER TABLE papers ADD COLUMN forked_from_id TEXT REFERENCES papers(id) ON DELETE SET NULL");
    console.log('Migration: Added forked_from_id column to papers');
  }

  if (!papersColumns.includes('fork_count')) {
    db.exec("ALTER TABLE papers ADD COLUMN fork_count INTEGER DEFAULT 0");
    console.log('Migration: Added fork_count column to papers');
  }
} catch (error) {
  console.error('Paper privacy migration error:', error);
}

// Paper Groups table - for organizing related papers into collections
db.exec(`
  CREATE TABLE IF NOT EXISTS paper_groups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'public')),
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_paper_groups_user ON paper_groups(user_id);
  CREATE INDEX IF NOT EXISTS idx_paper_groups_visibility ON paper_groups(visibility);
`);

// Paper Group Members - junction table for papers in groups
db.exec(`
  CREATE TABLE IF NOT EXISTS paper_group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES paper_groups(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    added_by TEXT NOT NULL REFERENCES users(id),
    order_index INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(group_id, paper_id)
  );

  CREATE INDEX IF NOT EXISTS idx_paper_group_members_group ON paper_group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_paper_group_members_paper ON paper_group_members(paper_id);
`);

// Group AI Sessions - for multi-paper reading
db.exec(`
  CREATE TABLE IF NOT EXISTS group_ai_sessions (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES paper_groups(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    model_id TEXT NOT NULL,
    messages TEXT DEFAULT '[]',
    paper_summaries TEXT DEFAULT '{}',
    combined_analysis TEXT,
    api_key_encrypted TEXT,
    total_prompt_tokens INTEGER DEFAULT 0,
    total_completion_tokens INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'reading', 'ready', 'completed')),
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_group_ai_sessions_group ON group_ai_sessions(group_id);
  CREATE INDEX IF NOT EXISTS idx_group_ai_sessions_user ON group_ai_sessions(user_id);
`);

// Migration: Add paper reading columns to debate_sessions
try {
  const debateTableInfo = db.prepare("PRAGMA table_info(debate_sessions)").all() as any[];
  const debateColumns = debateTableInfo.map(col => col.name);

  if (!debateColumns.includes('papers_read')) {
    db.exec("ALTER TABLE debate_sessions ADD COLUMN papers_read INTEGER DEFAULT 0");
    console.log('Migration: Added papers_read column to debate_sessions');
  }

  if (!debateColumns.includes('reading_status')) {
    db.exec("ALTER TABLE debate_sessions ADD COLUMN reading_status TEXT DEFAULT 'pending'");
    console.log('Migration: Added reading_status column to debate_sessions');
  }
} catch (error) {
  console.error('Debate paper reading migration error:', error);
}

// Migration: Add token_limit column to group_ai_sessions
try {
  const groupAiTableInfo = db.prepare("PRAGMA table_info(group_ai_sessions)").all() as any[];
  const groupAiColumns = groupAiTableInfo.map(col => col.name);

  if (!groupAiColumns.includes('token_limit')) {
    db.exec("ALTER TABLE group_ai_sessions ADD COLUMN token_limit INTEGER DEFAULT 100000");
    console.log('Migration: Added token_limit column to group_ai_sessions');
  }
} catch (error) {
  console.error('Group AI sessions token limit migration error:', error);
}

// Background Reading Jobs table - for managing AI reading that continues in background
db.exec(`
  CREATE TABLE IF NOT EXISTS background_reading_jobs (
    id TEXT PRIMARY KEY,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES ai_agent_history(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Job status
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),

    -- Progress tracking
    total_pages INTEGER NOT NULL DEFAULT 0,
    current_page INTEGER NOT NULL DEFAULT 0,
    pages_completed INTEGER NOT NULL DEFAULT 0,

    -- Parsed PDF data (stored for resumption)
    pdf_parsed_data TEXT,

    -- Analysis results (accumulated)
    sentence_analysis TEXT DEFAULT '{}',
    figure_table_analysis TEXT DEFAULT '{}',

    -- Configuration snapshot
    workflow_config_snapshot TEXT,
    model_id TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,

    -- Token tracking
    total_prompt_tokens INTEGER DEFAULT 0,
    total_completion_tokens INTEGER DEFAULT 0,

    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error_at INTEGER,

    -- Timing
    started_at INTEGER,
    completed_at INTEGER,
    estimated_completion_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_background_jobs_user_id ON background_reading_jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_reading_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_background_jobs_paper_id ON background_reading_jobs(paper_id);
  CREATE INDEX IF NOT EXISTS idx_background_jobs_session_id ON background_reading_jobs(session_id);
`);

// Migration: Add background_job_id column to ai_agent_history
try {
  const aiHistoryTableInfo = db.prepare("PRAGMA table_info(ai_agent_history)").all() as any[];
  const aiHistoryColumns = aiHistoryTableInfo.map(col => col.name);

  if (!aiHistoryColumns.includes('background_job_id')) {
    db.exec("ALTER TABLE ai_agent_history ADD COLUMN background_job_id TEXT");
    console.log('Migration: Added background_job_id column to ai_agent_history');
  }
} catch (error) {
  console.error('AI agent history background_job_id migration error:', error);
}

// Migration: Add debug_entries column to background_reading_jobs
try {
  const bgJobsTableInfo = db.prepare("PRAGMA table_info(background_reading_jobs)").all() as any[];
  const bgJobsColumns = bgJobsTableInfo.map((col: any) => col.name);

  if (!bgJobsColumns.includes('debug_entries')) {
    db.exec("ALTER TABLE background_reading_jobs ADD COLUMN debug_entries TEXT DEFAULT '[]'");
    console.log('Migration: Added debug_entries column to background_reading_jobs');
  }
} catch (error) {
  console.error('Background jobs debug_entries migration error:', error);
}

// Migration: Add image_data column to figure_table_regions
try {
  const figureTableInfo = db.prepare("PRAGMA table_info(figure_table_regions)").all() as any[];
  const figureTableColumns = figureTableInfo.map((col: any) => col.name);

  if (!figureTableColumns.includes('image_data')) {
    db.exec("ALTER TABLE figure_table_regions ADD COLUMN image_data TEXT");
    console.log('Migration: Added image_data column to figure_table_regions');
  }
} catch (error) {
  console.error('Figure table regions image_data migration error:', error);
}

console.log('Database initialized at:', DB_PATH);

export default db;
