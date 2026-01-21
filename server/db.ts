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
    api_key_encrypted TEXT,           -- Encrypted API key (once set, cannot be changed)
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

console.log('Database initialized at:', DB_PATH);

export default db;
