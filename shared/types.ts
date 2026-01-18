// Shared types between client and server

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;           // URL or base64 data URI for avatar image
  researchInterests?: string[]; // Array of research interest tags
  bio?: string;              // Short bio/description
  isAdmin?: boolean;         // Whether user has admin privileges
  createdAt: number;         // Unix timestamp
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatar?: string;
  researchInterests?: string[];
  bio?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

// User with social stats (for profile display)
export interface UserWithStats extends User {
  followerCount: number;
  followingCount: number;
  collectionCount: number;
  uploadCount: number;
  isFollowing?: boolean;  // Whether current user follows this user
}

// Paper collection (bookmark)
export interface PaperCollection {
  id: string;
  paperId: string;
  paperTitle: string;
  paperAuthors: string[];
  paperArxivId?: string;
  note?: string;
  createdAt: number;
}

// Follow relationship
export interface UserFollow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: number;
}

// Like/Dislike types
export type LikeTargetType = 'annotation' | 'comment' | 'user_review' | 'ai_review' | 'necessary_background' | 'ai_session';

export interface LikeStatus {
  likeCount: number;
  dislikeCount: number;
  userVote: 'like' | 'dislike' | null;  // Current user's vote (null if not voted)
}

export interface LikeRequest {
  targetType: LikeTargetType;
  targetId: string;
  isLike: boolean;  // true = like, false = dislike
}

export interface LikeResponse {
  success: boolean;
  likeCount: number;
  dislikeCount: number;
  userVote: 'like' | 'dislike' | null;
}

// Simplified user for lists (following/followers)
export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isFollowing?: boolean;  // Whether current user follows this user
}

// ============================================================================
// PAPER TYPES
// ============================================================================

export interface Paper {
  id: string;
  arxivId?: string;      // For ArXiv papers (e.g., "1706.03762")
  contentHash?: string;  // For local PDFs (SHA-256 of first 100KB)
  title: string;
  authors: string[];     // Array of author names
  abstract?: string;
  addedBy?: string;      // User ID who added this paper
  viewCount: number;
  createdAt: number;     // Unix timestamp
}

export interface PaperWithStats extends Paper {
  readerCount: number;
  annotationCount: number;
  hasAiAnalysis: boolean;
}

// ============================================================================
// ANNOTATION TYPES
// ============================================================================

export interface Annotation {
  id: string;
  paperId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  pageNumber: number;
  sentenceId?: string;
  content: AnnotationContent;
  createdAt: number;
}

export interface AnnotationContent {
  text: string;
  latex?: string;
  color: string;
  type: 'text' | 'figure' | 'table' | 'equation';
  label?: string;
  position: { x: number; y: number };
  highlightRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// RATING TYPES
// ============================================================================

export interface Rating {
  paperId: string;
  userId: string;
  score: number;        // 1-5
  noveltyScore: number; // 1-5
}

// ============================================================================
// AI ANALYSIS TYPES
// ============================================================================

export interface AiAnalysis {
  paperId: string;
  summary?: string;
  sentenceLabels: Record<string, SentenceLabelData>;
  figureLabels: Record<string, FigureLabelData>;
  noveltyCount: number;
  analyzedBy: string;   // User ID
  createdAt: number;
}

export interface SentenceLabelData {
  label: string;
  comment?: string;
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
}

export interface FigureLabelData {
  label: string;
  comment?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
}

export interface AddPaperRequest {
  arxivId?: string;
  contentHash?: string;
  title: string;
  authors: string[];
  abstract?: string;
}

export interface PaperListResponse {
  papers: PaperWithStats[];
  total: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// ============================================================================
// FIGURE/TABLE REGION TYPES
// ============================================================================

export interface FigureTableRegion {
  id: string;
  paperId: string;
  pageNumber: number;
  type: 'figure' | 'table';
  label: string;           // e.g., "Figure 1", "Table 2"
  caption?: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdBy: string;       // User ID of paper uploader
  createdAt: number;
  updatedAt: number;
}

export interface CreateFigureTableRegionRequest {
  pageNumber: number;
  type: 'figure' | 'table';
  label: string;
  caption?: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UpdateFigureTableRegionRequest {
  label?: string;
  caption?: string;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// AI REVIEW TYPES (Conference-style reviews)
// ============================================================================

export interface AiReview {
  id: string;
  paperId: string;
  reviewerExpertise: number;        // 1-4 scale
  reviewerExpertiseText: string;
  reviewerConfidence: number;       // 1-4 scale
  reviewerConfidenceText: string;
  paperSummary: string;

  // Ratings (1-4 scale with text descriptions)
  significanceOfProblem: number;
  significanceOfProblemText: string;
  noveltyOfSolution: number;
  noveltyOfSolutionText: string;
  correctness: number;
  correctnessText: string;
  writingQuality: number;
  writingQualityText: string;
  relatedWork: number;
  relatedWorkText: string;
  robustnessOfEvaluation: number;
  robustnessOfEvaluationText: string;

  // Disciplines (optional, for CS conferences)
  advancementDisciplines?: string[];

  // Detailed feedback
  strengths: string;
  weaknesses: string;
  commentsForAuthors: string;
  commentsForPC?: string;           // Hidden from authors

  // Metadata
  generatedBy: string;              // AI model name
  generatedAt: number;              // Unix timestamp
  createdAt: number;
}

export interface GenerateAiReviewRequest {
  model?: string;                   // Optional: specify AI model
}

export interface AiReviewResponse {
  review: AiReview | null;
}

// ============================================================================
// USER REVIEW TYPES
// ============================================================================

export interface UserReview {
  id: string;
  paperId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  paperSummary: string;

  // Ratings (1-4 scale with text descriptions)
  significanceOfProblem: number;
  significanceOfProblemText: string;
  noveltyOfSolution: number;
  noveltyOfSolutionText: string;
  correctness: number;
  correctnessText: string;
  writingQuality: number;
  writingQualityText: string;
  relatedWork: number;
  relatedWorkText: string;
  robustnessOfEvaluation: number;
  robustnessOfEvaluationText: string;

  // Disciplines (optional)
  advancementDisciplines?: string[];

  // Detailed feedback
  strengths: string;
  weaknesses: string;
  commentsForAuthors: string;
  commentsForReaders?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

export interface CreateUserReviewRequest {
  paperSummary: string;
  significanceOfProblem: number;
  significanceOfProblemText: string;
  noveltyOfSolution: number;
  noveltyOfSolutionText: string;
  correctness: number;
  correctnessText: string;
  writingQuality: number;
  writingQualityText: string;
  relatedWork: number;
  relatedWorkText: string;
  robustnessOfEvaluation: number;
  robustnessOfEvaluationText: string;
  advancementDisciplines?: string[];
  strengths: string;
  weaknesses: string;
  commentsForAuthors: string;
  commentsForReaders?: string;
}

export interface UpdateUserReviewRequest extends Partial<CreateUserReviewRequest> {}

// ============================================================================
// AI AGENT HISTORY TYPES
// ============================================================================

// A single message in the AI agent conversation
export interface AiAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// AI analysis result for a sentence
export interface AiSentenceAnalysisData {
  label: string;
  comment?: string;
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
}

// AI analysis result for a figure/table
export interface AiFigureTableAnalysisData {
  label: string;
  comment?: string;
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
}

// AI Agent History - stores a complete conversation/session with the AI
export interface AiAgentHistory {
  id: string;
  paperId: string;
  userId: string;
  userName: string;
  title: string;                    // User-defined title for this history
  messages: AiAgentMessage[];       // The conversation history
  isPublic: boolean;                // Whether other users can view this
  isActive: boolean;                // Whether this is the currently active history for the user
  modelUsed: string;                // Which AI model was used (display name)
  modelId?: string;                 // Standardized model ID from DEFAULT_AI_MODELS or 'custom'
  createdAt: number;
  updatedAt: number;
  // AI analysis data from "Let Agent Read" feature
  sentenceAnalysis?: Record<string, AiSentenceAnalysisData>;    // keyed by sentenceId
  figureTableAnalysis?: Record<string, AiFigureTableAnalysisData>; // keyed by figureTableId
  // API key (encrypted, once set cannot be changed)
  apiKeySet: boolean;               // Whether an API key has been set (key itself not exposed)
  // Token usage tracking
  totalPromptTokens: number;        // Total tokens in prompts sent
  totalCompletionTokens: number;    // Total tokens in AI responses
  maxContextTokens: number;         // User-configurable max (default: 128000 for gpt-4o)
  conversationRounds: number;       // Number of back-and-forth exchanges
}

export interface CreateAiAgentHistoryRequest {
  title: string;
  isPublic?: boolean;
  apiKey?: string;   // Optional API key to set during creation
  maxContextTokens?: number;  // Optional, defaults to 128000 for gpt-4o
  modelId?: string;  // AI model ID from DEFAULT_AI_MODELS or custom
  customModelName?: string; // If modelId is 'custom', the user-provided model name
}

export interface UpdateAiAgentHistoryRequest {
  title?: string;
  isPublic?: boolean;
  isActive?: boolean;
  messages?: AiAgentMessage[];
  sentenceAnalysis?: Record<string, AiSentenceAnalysisData>;
  figureTableAnalysis?: Record<string, AiFigureTableAnalysisData>;
}

export interface SetApiKeyRequest {
  apiKey: string;
}

export interface AiAgentHistoryListResponse {
  histories: AiAgentHistory[];
}

// ============================================================================
// NECESSARY BACKGROUND TYPES
// ============================================================================

export interface BackgroundConcept {
  concept: string;            // Name of the concept
  explanation: string;        // Why it's necessary for understanding this paper
  importance: 'critical' | 'important' | 'helpful';  // How important is this concept
}

export interface NecessaryBackground {
  id: string;
  paperId: string;
  sessionId: string;          // Which AI session generated this
  concepts: BackgroundConcept[];
  generatedBy: string;        // AI model name
  generatedAt: number;        // Unix timestamp
  createdAt: number;
}

// ============================================================================
// AI CHAT TYPES (for direct Agent conversation)
// ============================================================================

export interface AiChatRequest {
  message: string;
  context?: string;           // Optional context about what the user is looking at
}

export interface AiChatResponse {
  response: string;
  updatedHistory: AiAgentHistory;
}

// ============================================================================
// AI MODEL ARENA TYPES
// ============================================================================

// AI Model provider categories
export type AiModelProvider = 'openai' | 'anthropic' | 'google' | 'xai' | 'meta' | 'deepseek' | 'alibaba' | 'mistral' | 'cohere' | 'custom';

// Predefined AI model information
export interface AiModelInfo {
  id: string;                     // Unique identifier (e.g., "gpt-4o", "claude-opus-4-5")
  name: string;                   // Display name (e.g., "GPT-4o", "Claude Opus 4.5")
  provider: AiModelProvider;
  description?: string;           // Short description
  contextWindow?: number;         // Max context tokens
  isDefault?: boolean;            // Whether this is a default/well-known model
}

// Default list of well-known AI models (2025-2026)
export const DEFAULT_AI_MODELS: AiModelInfo[] = [
  // OpenAI models
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai', description: 'OpenAI latest flagship with 400K context', contextWindow: 400000, isDefault: true },
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', description: 'OpenAI GPT-5 (Aug 2025)', contextWindow: 200000, isDefault: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'OpenAI multimodal model', contextWindow: 128000, isDefault: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Smaller, faster GPT-4o variant', contextWindow: 128000, isDefault: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: 'GPT-4 with improved speed', contextWindow: 128000, isDefault: true },
  { id: 'o4', name: 'o4', provider: 'openai', description: 'OpenAI reasoning model', contextWindow: 128000, isDefault: true },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', description: 'Smaller o4 reasoning model', contextWindow: 128000, isDefault: true },
  { id: 'o3', name: 'o3', provider: 'openai', description: 'OpenAI o3 reasoning model', contextWindow: 128000, isDefault: true },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', description: 'Smaller o3 reasoning model', contextWindow: 128000, isDefault: true },
  { id: 'o1', name: 'o1', provider: 'openai', description: 'OpenAI o1 reasoning model', contextWindow: 128000, isDefault: true },
  { id: 'o1-mini', name: 'o1-mini', provider: 'openai', description: 'Smaller o1 reasoning model', contextWindow: 128000, isDefault: true },

  // Anthropic Claude models
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'anthropic', description: 'Anthropic latest flagship', contextWindow: 200000, isDefault: true },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'anthropic', description: 'Best coding model (Sep 2025)', contextWindow: 200000, isDefault: true },
  { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', provider: 'anthropic', description: 'Multi-step reasoning expert', contextWindow: 200000, isDefault: true },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', description: 'Balanced performance', contextWindow: 200000, isDefault: true },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', provider: 'anthropic', description: 'Fast and efficient', contextWindow: 200000, isDefault: true },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic', description: 'Claude 3 series flagship', contextWindow: 200000, isDefault: true },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Claude 3.5 balanced', contextWindow: 200000, isDefault: true },

  // Google Gemini models
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google', description: 'Google multimodal flagship', contextWindow: 2000000, isDefault: true },
  { id: 'gemini-3-deep-think', name: 'Gemini 3 Deep Think', provider: 'google', description: 'Deeper reasoning mode', contextWindow: 2000000, isDefault: true },
  { id: 'gemini-2-pro', name: 'Gemini 2.0 Pro', provider: 'google', description: 'Strong coding and tool use', contextWindow: 2000000, isDefault: true },
  { id: 'gemini-2-flash', name: 'Gemini 2.0 Flash', provider: 'google', description: 'Fast Gemini variant', contextWindow: 1000000, isDefault: true },
  { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', provider: 'google', description: 'Previous gen flagship', contextWindow: 1000000, isDefault: true },

  // xAI Grok models (https://docs.x.ai/docs/models)
  { id: 'grok-4', name: 'Grok 4', provider: 'xai', description: 'Latest Grok flagship model', contextWindow: 256000, isDefault: true },
  { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast (Reasoning)', provider: 'xai', description: 'Best tool-calling model, 2M context', contextWindow: 2000000, isDefault: true },
  { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast', provider: 'xai', description: 'Fast model, 2M context', contextWindow: 2000000, isDefault: true },
  { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast (Reasoning)', provider: 'xai', description: 'Grok 4 with reasoning, 2M context', contextWindow: 2000000, isDefault: true },
  { id: 'grok-code-fast-1', name: 'Grok Code Fast', provider: 'xai', description: 'Optimized for agentic coding', contextWindow: 256000, isDefault: true },
  { id: 'grok-3', name: 'Grok 3', provider: 'xai', description: 'Advanced reasoning, 131K context', contextWindow: 131000, isDefault: true },
  { id: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xai', description: 'Smaller Grok 3 model', contextWindow: 131000, isDefault: true },

  // Meta Llama models
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'meta', description: 'Meta flagship open model', contextWindow: 10000000, isDefault: true },
  { id: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'meta', description: '10M context window', contextWindow: 10000000, isDefault: true },
  { id: 'llama-3-1-405b', name: 'Llama 3.1 405B', provider: 'meta', description: 'Large open model', contextWindow: 128000, isDefault: true },
  { id: 'llama-3-1-70b', name: 'Llama 3.1 70B', provider: 'meta', description: 'Medium open model', contextWindow: 128000, isDefault: true },

  // DeepSeek models
  { id: 'deepseek-v3-2', name: 'DeepSeek V3.2', provider: 'deepseek', description: 'Technical tasks specialist', contextWindow: 128000, isDefault: true },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', description: 'Reasoning specialist', contextWindow: 128000, isDefault: true },
  { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek', description: 'Code specialist', contextWindow: 128000, isDefault: true },

  // Alibaba Qwen models
  { id: 'qwen3-235b', name: 'Qwen3 235B', provider: 'alibaba', description: 'Alibaba flagship', contextWindow: 128000, isDefault: true },
  { id: 'qwen3-72b', name: 'Qwen3 72B', provider: 'alibaba', description: 'Medium Qwen model', contextWindow: 128000, isDefault: true },
  { id: 'qwen-2-5-coder', name: 'Qwen 2.5 Coder', provider: 'alibaba', description: 'Code specialist', contextWindow: 128000, isDefault: true },

  // Mistral models
  { id: 'mistral-large-3', name: 'Mistral Large 3', provider: 'mistral', description: '675B open-source model', contextWindow: 128000, isDefault: true },
  { id: 'mistral-medium', name: 'Mistral Medium', provider: 'mistral', description: 'Balanced Mistral model', contextWindow: 128000, isDefault: true },
  { id: 'codestral', name: 'Codestral', provider: 'mistral', description: 'Code specialist', contextWindow: 128000, isDefault: true },

  // Cohere models
  { id: 'command-a', name: 'Command A', provider: 'cohere', description: 'Enterprise-focused, 256K context', contextWindow: 256000, isDefault: true },
  { id: 'command-r-plus', name: 'Command R+', provider: 'cohere', description: 'RAG specialist', contextWindow: 128000, isDefault: true },
];

// AI Model ranking entry
export interface AiModelRanking {
  modelId: string;
  modelName: string;
  provider: AiModelProvider;
  likeCount: number;
  dislikeCount: number;
  score: number;                  // likeCount - dislikeCount
  sessionCount: number;           // Number of sessions using this model
  rank?: number;                  // Position in ranking (1-based)
}

// Model ranking response
export interface ModelRankingResponse {
  rankings: AiModelRanking[];
  totalModels: number;
}

// ============================================================================
// TOP CONTRIBUTORS TYPES
// ============================================================================

// User contribution stats for ranking
export interface TopContributor {
  userId: string;
  userName: string;
  userAvatar?: string;
  papersUploaded: number;        // Papers they added to the platform
  reviewsWritten: number;        // User reviews they wrote
  publicAiSessions: number;      // Public AI sessions they created
  commentsPosted: number;        // Comments on sentences/figures
  totalScore: number;            // Weighted contribution score
  rank?: number;                 // Position in ranking (1-based)
}

// Top contributors response
export interface TopContributorsResponse {
  contributors: TopContributor[];
  totalContributors: number;
}

// ============================================================================
// QUIZ / TEST MY UNDERSTANDING TYPES
// ============================================================================

// A single quiz question with multiple choice answers
export interface QuizQuestion {
  id: string;                     // Unique question ID
  questionNumber: number;         // 1-10
  question: string;               // The question text
  choices: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';  // The correct answer (hidden until user answers)
  explanation: string;            // Explanation of why the answer is correct
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;                  // What aspect of the paper this tests
}

// User's answer to a quiz question
export interface QuizAnswer {
  questionId: string;
  questionNumber: number;
  userAnswer: 'A' | 'B' | 'C' | 'D';
  isCorrect: boolean;
  timeTakenMs?: number;           // How long the user took to answer
}

// Quiz session state
export interface QuizSession {
  id: string;
  paperId: string;
  historyId: string;              // AI session used for generating questions
  userId: string;
  currentQuestionNumber: number;  // 1-10, 0 means not started, 11 means completed
  questions: QuizQuestion[];      // Questions generated so far
  answers: QuizAnswer[];          // User's answers so far
  finalScore?: number;            // 0-10 score after completion
  finalDiagnosis?: string;        // AI's assessment of understanding
  suggestions?: string[];         // Suggestions for improvement
  createdAt: number;
  completedAt?: number;
}

// Request to start a new quiz
export interface StartQuizRequest {
  historyId: string;              // AI session to use for generating questions
}

// Response when starting a quiz or getting next question
export interface QuizQuestionResponse {
  sessionId: string;
  question: Omit<QuizQuestion, 'correctAnswer' | 'explanation'>;  // Hide answer until submitted
  totalQuestions: number;
  answeredCount: number;
}

// Request to submit an answer
export interface SubmitQuizAnswerRequest {
  sessionId: string;
  questionId: string;
  answer: 'A' | 'B' | 'C' | 'D';
}

// Response after submitting an answer
export interface SubmitQuizAnswerResponse {
  isCorrect: boolean;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  currentScore: number;           // Correct answers so far
  totalAnswered: number;
  isComplete: boolean;            // True if this was the last question
  nextQuestion?: Omit<QuizQuestion, 'correctAnswer' | 'explanation'>;  // Next question if not complete
}

// Final quiz results
export interface QuizResultsResponse {
  sessionId: string;
  finalScore: number;             // 0-10 scale
  correctAnswers: number;
  totalQuestions: number;
  diagnosis: string;              // AI's assessment
  suggestions: string[];          // Areas to improve
  questionResults: Array<{
    questionNumber: number;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    topic: string;
  }>;
}

// ============================================================================
// OPEN QUESTIONS & RESEARCH IDEAS TYPES
// ============================================================================

// A single open research question identified in the paper
export interface OpenQuestion {
  id: string;
  question: string;               // The open question
  context: string;                // Where in the paper this is mentioned/implied
  importance: 'high' | 'medium' | 'low';  // How critical this question is
  relatedTopics: string[];        // Related research areas
}

// A proposed research idea based on the paper
export interface ResearchIdea {
  id: string;
  title: string;                  // Brief title of the idea
  description: string;            // Detailed description
  methodology: string;            // Suggested approach
  expectedOutcome: string;        // What success would look like
  feasibility: 'high' | 'medium' | 'low';  // How feasible is this
  novelty: 'incremental' | 'moderate' | 'breakthrough';  // Innovation level
  prerequisites: string[];        // What you'd need to know/have
}

// Stored results for open questions/research ideas per AI session
export interface AIInsights {
  historyId: string;
  openQuestions?: OpenQuestion[];
  researchIdeas?: ResearchIdea[];
  openQuestionsPrompt?: string;   // Custom prompt used
  researchIdeasPrompt?: string;   // Custom prompt used
  generatedAt?: number;
}

// Request to generate open questions
export interface GenerateOpenQuestionsRequest {
  historyId: string;
  customPrompt?: string;          // Optional custom prompt
}

// Response with generated open questions
export interface GenerateOpenQuestionsResponse {
  questions: OpenQuestion[];
  promptUsed: string;
}

// Request to generate research ideas
export interface GenerateResearchIdeasRequest {
  historyId: string;
  customPrompt?: string;          // Optional custom prompt
}

// Response with generated research ideas
export interface GenerateResearchIdeasResponse {
  ideas: ResearchIdea[];
  promptUsed: string;
}
