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
export type LikeTargetType = 'annotation' | 'comment' | 'user_review' | 'ai_review' | 'necessary_background' | 'ai_session' | 'challenge_problem' | 'challenge_comment';

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

// Paper visibility type
export type PaperVisibility = 'public' | 'private';

// Paper collaborator role
export type PaperCollaboratorRole = 'viewer' | 'commenter' | 'editor';

export interface Paper {
  id: string;
  arxivId?: string;      // For ArXiv papers (e.g., "1706.03762")
  contentHash?: string;  // For local PDFs (SHA-256 of first 100KB)
  title: string;
  authors: string[];     // Array of author names
  abstract?: string;
  addedBy?: string;      // User ID who added this paper
  viewCount: number;
  tags?: string[];       // Area tags (e.g., "Quantum Computing", "Machine Learning")
  activeAvatarUrl?: string; // AI-generated paper avatar (base64 data URI or URL)
  visibility: PaperVisibility; // public or private (default: public)
  forkedFromId?: string; // If this is a forked paper, the original paper ID
  forkCount: number;     // Number of times this paper has been forked
  createdAt: number;     // Unix timestamp
}

// Paper collaborator (for private paper access control)
export interface PaperCollaborator {
  id: string;
  paperId: string;
  userId: string;
  userName?: string;     // Populated from user join
  userAvatar?: string;   // Populated from user join
  role: PaperCollaboratorRole;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: number;
}

// Simplified category info for display
export interface PaperCategoryInfo {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

export interface PaperWithStats extends Paper {
  readerCount: number;
  annotationCount: number;
  hasAiAnalysis: boolean;
  aiReviewCount?: number;      // Number of AI reviews for this paper
  aiReviewAvgScore?: number;   // Average overall score from AI reviews (1-10)
  // Uploader info (populated from users table join)
  uploaderName?: string;       // Display name of user who uploaded this paper
  uploaderUsername?: string;   // Username of uploader (for profile link)
  uploaderAvatar?: string;     // Avatar URL of uploader
  // Categories this paper belongs to
  categories?: PaperCategoryInfo[];
  // Access control info (for private papers)
  userRole?: PaperCollaboratorRole | 'owner'; // Current user's access level
  isForked?: boolean;          // Whether this paper is a fork of another
  originalPaperTitle?: string; // Title of the original paper (if forked)
}

// ============================================================================
// PAPER AVATAR TYPES (AI-Generated Visual Representations)
// ============================================================================

export type PaperAvatarStyle = 'diagram' | 'infographic' | 'conceptual' | 'technical';

export interface PaperAvatar {
  id: string;
  paperId: string;
  userId: string;
  userName?: string;           // Populated from user join
  userAvatar?: string;         // Populated from user join
  imageData: string;           // Base64 data URI
  prompt: string;              // Prompt used to generate
  generationModel: string;     // e.g., "dall-e-3"
  style: PaperAvatarStyle;
  isActive: boolean;           // Whether this is the currently displayed avatar
  sessionId?: string;          // AI session that was used
  createdAt: number;
}

export interface GeneratePaperAvatarRequest {
  sessionId: string;           // AI session to use (with its API key)
  style?: PaperAvatarStyle;
  customPrompt?: string;       // Optional user customization
}

export interface GeneratePaperAvatarResponse {
  avatar: PaperAvatar;
}

// ============================================================================
// CATEGORY TYPES (Hierarchical Tag System)
// ============================================================================

export interface Category {
  id: string;
  name: string;           // Display name, e.g., "Computer Science"
  slug: string;           // URL-friendly name, e.g., "computer-science"
  description?: string;   // Optional description of the category
  parentId?: string;      // Parent category ID (null for root categories)
  depth: number;          // Depth in tree (0 for root)
  path: string;           // Full path like "/physics/quantum-computing"
  orderIndex: number;     // Order within siblings
  paperCount?: number;    // Number of papers in this category (computed)
  icon?: string;          // Optional icon name (e.g., "Cpu", "Atom", "Calculator")
  color?: string;         // Optional color for the category badge
  createdAt: number;
  updatedAt: number;
}

// Category with children for tree display
export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

// Category tree response
export interface CategoryTreeResponse {
  categories: CategoryWithChildren[];
  totalPapers: number;
}

// Request types for category management
export interface CreateCategoryRequest {
  name: string;
  slug?: string;          // Auto-generated from name if not provided
  description?: string;
  parentId?: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string;      // Can move category to different parent
  orderIndex?: number;
  icon?: string;
  color?: string;
}

export interface ReorderCategoriesRequest {
  categoryId: string;
  newParentId?: string;   // New parent (null for root)
  newOrderIndex: number;  // New position among siblings
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
  tags?: string[];
}

export interface UpdatePaperTagsRequest {
  tags: string[];
}

// Paper visibility update
export interface UpdatePaperVisibilityRequest {
  visibility: PaperVisibility;
}

// Paper collaborator management
export interface AddCollaboratorRequest {
  username: string;  // Username to search for and add
  role: PaperCollaboratorRole;
}

export interface UpdateCollaboratorRoleRequest {
  role: PaperCollaboratorRole;
}

export interface CollaboratorsListResponse {
  collaborators: PaperCollaborator[];
}

// Fork paper request
export interface ForkPaperRequest {
  visibility?: PaperVisibility;  // Default: private
}

export interface ForkPaperResponse {
  paper: PaperWithStats;
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
  imageData?: string;      // Base64 encoded image of the figure/table region
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
  imageData?: string;      // Base64 encoded image of the figure/table region
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
// PAPER GROUP TYPES
// ============================================================================

// Paper Group - a user-created collection of related papers
export interface PaperGroup {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  name: string;
  description?: string;
  visibility: 'private' | 'public';
  paperCount?: number;
  createdAt: number;
  updatedAt: number;
}

// Paper in a group
export interface PaperGroupMember {
  id: string;
  groupId: string;
  paperId: string;
  paper?: PaperWithStats;     // Populated when fetching
  addedBy: string;
  addedByName?: string;
  orderIndex: number;
  createdAt: number;
}

// Paper group with full paper list
export interface PaperGroupWithPapers extends PaperGroup {
  papers: PaperGroupMember[];
}

// Group AI Session - for multi-paper reading
export interface GroupAiSession {
  id: string;
  groupId: string;
  userId: string;
  title: string;
  modelId: string;
  messages: AiAgentMessage[];
  paperSummaries: Record<string, string>;   // paperId -> summary
  combinedAnalysis?: string;
  apiKeySet?: boolean;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  tokenLimit: number;                       // User-set token limit (0 = unlimited)
  tokenLimitReached?: boolean;              // Flag when limit is hit
  status: 'active' | 'reading' | 'ready' | 'completed';
  createdAt: number;
  updatedAt: number;
}

// Request types
export interface CreatePaperGroupRequest {
  name: string;
  description?: string;
  visibility?: 'private' | 'public';
  paperIds?: string[];   // Optional initial papers
}

export interface AddPapersToGroupRequest {
  paperIds: string[];
}

export interface StartGroupReadingRequest {
  modelId: string;
  apiKey?: string;
  title?: string;
  tokenLimit?: number;  // User-set token limit (default: 100000)
}

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

// AI analysis result for a figure/table (with multimodal image analysis)
export interface AiFigureTableAnalysisData {
  label: string;
  comment?: string;
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
  // Enhanced multimodal analysis fields (from image understanding)
  imageAnalysis?: {
    description: string;           // AI-generated description of what the figure/table shows
    visualType: 'chart' | 'graph' | 'diagram' | 'photo' | 'illustration' | 'table' | 'flowchart' | 'architecture' | 'equation' | 'other';
    keyFindings: string[];         // Key observations from the visual
    dataPoints?: string[];         // Specific data points or values extracted
    methodology?: string;          // If applicable, what methodology/experiment is shown
    limitations?: string;          // Any limitations or issues noticed in the visual
  };
  captionVerification?: {
    matches: boolean;              // Does the image match its caption?
    discrepancies?: string;        // Any discrepancies between image and caption
    suggestedCaption?: string;     // AI-suggested improved caption
  };
  paperRelevance?: {
    supportsMainClaim: boolean;    // Does this figure support the paper's main claims?
    connectionToText: string;      // How this figure relates to the paper content
    importance: 'critical' | 'supporting' | 'supplementary';
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
  // Token spending limit
  tokenLimit: number;               // User-set token spending limit (0 = unlimited)
  tokenLimitReached?: boolean;      // Flag when limit is hit
}

export interface CreateAiAgentHistoryRequest {
  title: string;
  isPublic?: boolean;
  apiKey?: string;   // Optional API key to set during creation
  maxContextTokens?: number;  // Optional, defaults to 128000 for gpt-4o
  modelId?: string;  // AI model ID from DEFAULT_AI_MODELS or custom
  customModelName?: string; // If modelId is 'custom', the user-provided model name
  tokenLimit?: number;  // User-set spending limit (default: 100000)
}

export interface UpdateAiAgentHistoryRequest {
  title?: string;
  isPublic?: boolean;
  isActive?: boolean;
  messages?: AiAgentMessage[];
  sentenceAnalysis?: Record<string, AiSentenceAnalysisData>;
  figureTableAnalysis?: Record<string, AiFigureTableAnalysisData>;
  tokenLimit?: number;  // User-set spending limit
}

export interface SetApiKeyRequest {
  apiKey: string;
}

export interface AiAgentHistoryListResponse {
  histories: AiAgentHistory[];
}

// ============================================================================
// AI READING WORKFLOW TYPES
// ============================================================================

// Reading strategy types
export type ReadingStrategyType = 'standard' | 'rethink' | 'question_guided' | 'multi_pass';

// Analysis granularity levels
export type AnalysisLevel = 'sentence' | 'paragraph' | 'section';

// Prompt configuration for each analysis level
export interface LevelPromptConfig {
  level: AnalysisLevel;
  enabled: boolean;
  systemPrompt: string;
  userPromptTemplate: string;  // Uses {{content}}, {{context}}, {{questions}}, {{pageNumber}} placeholders
  labels: string[];
  flags?: string[];
  temperature?: number;
  maxTokens?: number;
}

// Reading workflow configuration
export interface ReadingWorkflowConfig {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  isPublic: boolean;
  isDefault?: boolean;  // System default workflow

  // Strategy configuration
  strategy: ReadingStrategyType;
  strategyConfig?: {
    // For rethink mode
    reflectAfter?: AnalysisLevel;
    reflectionPrompt?: string;

    // For question_guided mode
    questions?: string[];
    questionContext?: string;

    // For multi_pass mode
    passes?: Array<{
      name: string;
      focus: 'overview' | 'detailed' | 'critical';
      levelsEnabled: AnalysisLevel[];
    }>;
  };

  // Level-specific prompt configurations
  levelConfigs: {
    sentence?: LevelPromptConfig;
    paragraph?: LevelPromptConfig;
    section?: LevelPromptConfig;
  };

  // Processing options
  processingOptions: {
    preserveContext?: boolean;
    contextWindowSize?: number;
  };
}

// Paragraph analysis data (NEW - extends beyond sentence analysis)
export interface AiParagraphAnalysisData {
  id: string;
  pageNumber: number;
  sentenceIds: string[];
  summary: string;
  mainPoint: string;
  connectionToPrevious?: string;
  label: string;
  flags?: {
    isKeyParagraph?: boolean;
    containsNovelty?: boolean;
    requiresAttention?: boolean;
  };
}

// Section analysis data (NEW - high-level structural analysis)
export interface AiSectionAnalysisData {
  id: string;
  sectionTitle: string;
  pageRange: { start: number; end: number };
  paragraphIds: string[];
  summary: string;
  keyContributions: string[];
  relationshipToGoals: string;
  criticalPoints?: string[];
  label: string;
  flags?: {
    isCoreSection?: boolean;
    containsMainResults?: boolean;
    hasLimitations?: boolean;
  };
}

// Extended AI history with multi-level analysis
export interface ExtendedAiAgentHistory extends AiAgentHistory {
  paragraphAnalysis?: Record<string, AiParagraphAnalysisData>;
  sectionAnalysis?: Record<string, AiSectionAnalysisData>;
  workflowConfigId?: string;
  workflowConfigSnapshot?: ReadingWorkflowConfig;
  readingProgress?: {
    currentPass?: number;
    totalPasses?: number;
    currentLevel?: AnalysisLevel;
    completedLevels?: AnalysisLevel[];
  };
}

// API Request/Response types for reading workflows
export interface CreateReadingWorkflowRequest {
  name: string;
  description?: string;
  strategy: ReadingStrategyType;
  strategyConfig?: ReadingWorkflowConfig['strategyConfig'];
  levelConfigs: ReadingWorkflowConfig['levelConfigs'];
  processingOptions?: ReadingWorkflowConfig['processingOptions'];
  isPublic?: boolean;
}

export interface UpdateReadingWorkflowRequest extends Partial<CreateReadingWorkflowRequest> {}

export interface ReadingWorkflowListResponse {
  workflows: ReadingWorkflowConfig[];
  total: number;
}

export interface StartReadingRequest {
  workflowId?: string;
  customWorkflow?: ReadingWorkflowConfig;
  questions?: string[];
  startPage?: number;
  endPage?: number;
}

export interface AnalyzeParagraphRequest {
  paragraphId: string;
  sentenceIds: string[];
  content: string;
  context?: string;
  pageNumber: number;
  workflowConfig?: LevelPromptConfig;
}

export interface AnalyzeSectionRequest {
  sectionId: string;
  sectionTitle: string;
  paragraphIds: string[];
  content: string;
  pageRange: { start: number; end: number };
  workflowConfig?: LevelPromptConfig;
}

export interface ReadingProgressUpdate {
  sessionId: string;
  currentPage: number;
  totalPages: number;
  currentLevel: AnalysisLevel;
  currentPass?: number;
  analysis: {
    sentences?: Record<string, AiSentenceAnalysisData>;
    paragraphs?: Record<string, AiParagraphAnalysisData>;
    sections?: Record<string, AiSectionAnalysisData>;
  };
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

// Public insights from other users' sessions
export interface PublicInsight {
  sessionId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  sessionTitle: string;
  modelUsed: string;
  openQuestions?: OpenQuestion[];
  researchIdeas?: ResearchIdea[];
  updatedAt: number;
}

// Response with all public insights for a paper
export interface PublicInsightsResponse {
  insights: PublicInsight[];
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

// Notification event types
export type NotificationType =
  | 'follow'           // Someone followed you
  | 'reply'            // Someone replied to your comment/annotation
  | 'like'             // Someone liked your content
  | 'annotation'       // Someone annotated on your paper
  | 'comment'          // Someone commented on your paper
  | 'ai_review'        // Someone added AI review to your paper
  | 'user_review';     // Someone reviewed your paper

// Notification object
export interface Notification {
  id: string;
  userId: string;              // The user receiving the notification
  type: NotificationType;
  actorId: string;             // The user who performed the action
  actorName: string;           // Actor's display name
  actorAvatar?: string;        // Actor's avatar
  targetType?: string;         // Type of target (paper, annotation, comment, etc.)
  targetId?: string;           // ID of the target
  targetTitle?: string;        // Title or preview text of the target
  paperId?: string;            // Related paper ID (for navigation)
  paperTitle?: string;         // Paper title (for context)
  isRead: boolean;             // Whether notification has been read
  createdAt: number;           // Unix timestamp
}

// Notification list response
export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

// Mark notifications as read request
export interface MarkNotificationsReadRequest {
  notificationIds: string[];   // IDs to mark as read, or empty array for all
}

// ============================================================================
// CHALLENGE PROBLEMS TYPES (Research Problems & Ideas with Progress Tree)
// ============================================================================

// Challenge problem status
export type ChallengeProblemStatus = 'unsolved' | 'investigating' | 'solved';
export type ChallengeProblemType = 'open_question' | 'research_idea';
export type IdeaLinkRelationship = 'addresses' | 'partial' | 'inspired_by';
export type CrossPaperRelationship = 'extends' | 'contradicts' | 'builds_on' | 'supersedes' | 'related';
export type ChallengeSourceType = 'manual' | 'promoted' | 'ai_generated';
export type CurationJobStatus = 'pending' | 'running' | 'completed' | 'failed';

// Challenge problem (combines OpenQuestion and ResearchIdea with metadata and progress tree)
export interface ChallengeProblem {
  id: string;
  paperId?: string;
  paperTitle?: string;
  historyId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;

  // Progress Tree fields
  parentId?: string;               // Parent question (null for root)
  rootId?: string;                 // Root question of the tree (null for root)
  depth: number;                   // Tree depth (0 = root)
  orderIndex: number;              // Sibling order within parent
  children?: ChallengeProblem[];   // Nested children (populated on detail view)

  type: ChallengeProblemType;
  status: ChallengeProblemStatus;
  title: string;
  description?: string;
  context?: string;

  // Research idea specific
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'incremental' | 'moderate' | 'breakthrough';
  prerequisites?: string[];

  // Categorization
  importance?: 'high' | 'medium' | 'low';
  area?: string;
  tags: string[];

  // Solution tracking
  solvedBy?: string;
  solvedByName?: string;
  solvedAt?: number;
  solutionSummary?: string;

  // Engagement
  upvotes: number;
  downvotes: number;
  commentCount: number;
  childCount: number;              // Number of sub-questions
  linkedIdeaCount: number;         // Number of linked research ideas

  // Linked ideas (populated on detail view)
  linkedIdeas?: ChallengeIdeaLink[];

  // AI-managed fields
  sourceHistoryId?: string;          // AI session that generated the original idea
  sourceType: ChallengeSourceType;   // How this problem was created
  aiSuggested: boolean;              // Was this AI-suggested for promotion?
  promotionScore?: number;           // AI's confidence this deserves promotion (0-1)

  // Cross-paper relationships (populated on detail view)
  crossPaperLinks?: ChallengeProblemLink[];

  createdAt: number;
  updatedAt: number;
}

// Link between a research idea and a research question
export interface ChallengeIdeaLink {
  id: string;
  questionId: string;
  ideaId: string;
  idea?: ChallengeProblem;         // Populated when fetching
  userId: string;
  userName: string;
  relationship: IdeaLinkRelationship;
  notes?: string;
  createdAt: number;
}

// Challenge comment
export interface ChallengeComment {
  id: string;
  problemId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  parentId?: string;
  content: string;
  upvotes: number;
  downvotes: number;
  replies?: ChallengeComment[];
  createdAt: number;
  updatedAt: number;
}

// Cross-paper relationship link between challenge problems
export interface ChallengeProblemLink {
  id: string;
  sourceId: string;
  sourceProblem?: ChallengeProblem;  // Populated when fetching
  targetId: string;
  targetProblem?: ChallengeProblem;  // Populated when fetching
  relationship: CrossPaperRelationship;
  confidence: number;                 // AI confidence score (0-1)
  aiGenerated: boolean;               // Was this link AI-suggested?
  userId?: string;
  userName?: string;
  notes?: string;
  createdAt: number;
}

// AI promotion suggestion for research ideas
export interface PromotionSuggestion {
  ideaId: string;
  historyId: string;
  paperId: string;
  paperTitle: string;
  title: string;
  description: string;
  score: number;                      // 0-1 promotion worthiness
  reasoning: string;                  // AI explanation
  suggestedRelationships: Array<{
    targetProblemId: string;
    targetProblemTitle: string;
    relationship: CrossPaperRelationship;
    confidence: number;
  }>;
}

// AI curation job
export interface ChallengeCurationJob {
  id: string;
  userId: string;
  userName?: string;
  status: CurationJobStatus;
  scope?: string;                     // 'all', 'paper:{id}', 'area:{name}'
  results?: CurationJobResult;
  ideasAnalyzed: number;
  suggestionsMade: number;
  errorMessage?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

// Curation job results
export interface CurationJobResult {
  promotionSuggestions: PromotionSuggestion[];
  relationshipSuggestions: Array<{
    sourceId: string;
    targetId: string;
    relationship: CrossPaperRelationship;
    confidence: number;
    reasoning: string;
  }>;
  duplicateGroups: Array<{
    ids: string[];
    reason: string;
  }>;
  organizationSuggestions: Array<{
    problemId: string;
    suggestedParentId: string;
    confidence: number;
    reasoning: string;
  }>;
}

// API Response types
export interface ChallengeProblemsResponse {
  problems: ChallengeProblem[];
  total: number;
}

export interface ChallengeProblemDetailResponse {
  problem: ChallengeProblem;        // Includes nested children[] and linkedIdeas[]
  comments: ChallengeComment[];
  progressTree: ChallengeProblem[]; // Full tree structure (all descendants)
}

// Create/Update request types
export interface CreateChallengeProblemRequest {
  type: ChallengeProblemType;
  title: string;
  description?: string;
  context?: string;
  paperId?: string;
  historyId?: string;
  parentId?: string;               // For creating sub-questions
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'incremental' | 'moderate' | 'breakthrough';
  prerequisites?: string[];
  importance?: 'high' | 'medium' | 'low';
  area?: string;
  tags?: string[];
}

export interface UpdateChallengeProblemRequest {
  status?: ChallengeProblemStatus;
  title?: string;
  description?: string;
  context?: string;
  methodology?: string;
  expectedOutcome?: string;
  solutionSummary?: string;
  tags?: string[];
  orderIndex?: number;             // For reordering in tree
  paperId?: string | null;         // Link/unlink paper (null to remove)
}

// Link idea to question request
export interface LinkIdeaToQuestionRequest {
  ideaId: string;
  relationship: IdeaLinkRelationship;
  notes?: string;
}

// Vote request for challenges
export interface ChallengeProblemVoteRequest {
  isLike: boolean;                 // true = upvote, false = downvote
}

// Challenge comment request
export interface CreateChallengeCommentRequest {
  content: string;
  parentId?: string;               // For replies
}

// Cross-paper link request
export interface CreateChallengeProblemLinkRequest {
  targetId: string;
  relationship: CrossPaperRelationship;
  notes?: string;
}

// Promote research idea to challenge problem request
export interface PromoteIdeaRequest {
  historyId: string;
  ideaId: string;                    // ID of the research idea from the session
  title?: string;                    // Override title (optional)
  description?: string;              // Override description (optional)
  area?: string;
  tags?: string[];
  type?: 'open_question' | 'research_idea';
  parentId?: string;                 // Parent challenge problem ID (for hierarchical organization)
  relationships?: Array<{            // Cross-paper links to create
    targetId: string;
    relationship: CrossPaperRelationship;
  }>;
}

// Suggested parent for a challenge problem
export interface SuggestedParent {
  id: string;
  title: string;
  confidence: number;
  reasoning: string;
}

// Trigger AI curation job request
export interface TriggerCurationRequest {
  scope: 'all' | string;             // 'all', 'paper:{id}', 'area:{name}'
}

// API Response types for new features
export interface PromotionSuggestionsResponse {
  suggestions: PromotionSuggestion[];
  existingProblemsCount: number;     // How many problems already exist for comparison
}

export interface ChallengeProblemLinksResponse {
  outgoingLinks: ChallengeProblemLink[];  // Links where this problem is source
  incomingLinks: ChallengeProblemLink[];  // Links where this problem is target
}

export interface CurationJobResponse {
  job: ChallengeCurationJob;
}

// ============================================================================
// AI RESEARCH DEBATE TYPES
// ============================================================================

// Debate status
export type DebateStatus = 'setup' | 'active' | 'paused' | 'concluded';

// Speaker types
export type DebateSpeaker = 'affirmative' | 'negative' | 'judge' | 'user';

// Agent configuration for a debate participant
export interface DebateAgentConfig {
  modelId: string;                  // AI model to use
  systemPrompt: string;             // Custom system prompt
  apiKeyEncrypted?: string;         // Encrypted API key (server only)
  apiKeySet?: boolean;              // Whether API key is configured (client view)
}

// A single message in the debate
export interface DebateMessage {
  id: string;
  speaker: DebateSpeaker;
  content: string;
  timestamp: number;
  tokenCount?: number;
  isInterruption?: boolean;         // True if judge interrupted or user intervened
  metadata?: {
    reasoning?: string;             // Internal reasoning (for judge)
    citations?: string[];           // Paper references used
    targetAgent?: DebateSpeaker;    // For user interventions targeted at specific agent
  };
}

// Full debate session
export interface DebateSession {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;                    // Debate topic title
  topic: string;                    // Full debate proposition

  status: DebateStatus;

  // Agent configurations
  affirmativeConfig: DebateAgentConfig;
  negativeConfig: DebateAgentConfig;
  judgeConfig: DebateAgentConfig;

  // Conversation state
  messages: DebateMessage[];
  currentSpeaker?: DebateSpeaker;
  turnCount: number;
  maxTurns: number;                 // Auto-conclude after this many turns

  // Background knowledge
  backgroundKnowledge?: string;     // User-provided context
  paperIds: string[];               // Linked paper IDs
  papers?: Array<{                  // Populated when fetching
    id: string;
    title: string;
    authors: string[];
    abstract?: string;
  }>;

  // Paper reading (agents read papers before debate)
  papersRead?: number;              // Number of papers read
  readingStatus?: 'pending' | 'reading' | 'completed' | 'skipped';

  // Conclusion
  conclusion?: string;              // Judge's final verdict
  winner?: 'affirmative' | 'negative' | 'draw';
  concludedAt?: number;

  // Token tracking
  totalTokensAffirmative: number;
  totalTokensNegative: number;
  totalTokensJudge: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// Create debate request
export interface CreateDebateRequest {
  title: string;
  topic: string;
  affirmativeConfig: {
    modelId: string;
    apiKey?: string;
    customPrompt?: string;          // Override default prompt
  };
  negativeConfig: {
    modelId: string;
    apiKey?: string;
    customPrompt?: string;
  };
  judgeConfig: {
    modelId: string;
    apiKey?: string;
    customPrompt?: string;
  };
  backgroundKnowledge?: string;
  paperIds?: string[];
  readPapersFirst?: boolean;        // Agents read papers before debating
  maxTurns?: number;                // Default 20
}

// Update debate request (setup phase only)
export interface UpdateDebateRequest {
  title?: string;
  topic?: string;
  backgroundKnowledge?: string;
  paperIds?: string[];
  readPapersFirst?: boolean;
  maxTurns?: number;
  affirmativePrompt?: string;
  negativePrompt?: string;
  judgePrompt?: string;
}

// Set API key for an agent
export interface SetDebateApiKeyRequest {
  agent: 'affirmative' | 'negative' | 'judge';
  apiKey: string;
}

// User intervention request
export interface DebateInterveneRequest {
  message: string;
  targetAgent?: DebateSpeaker;      // 'all' if not specified
}

// Debate list response
export interface DebateListResponse {
  debates: DebateSession[];
  total: number;
}

// Continue debate response
export interface DebateContinueResponse {
  message: DebateMessage;
  session: DebateSession;
  isComplete: boolean;
}

// Debate conclusion response
export interface DebateConclusionResponse {
  conclusion: string;
  winner: 'affirmative' | 'negative' | 'draw';
  session: DebateSession;
}

// ============================================================================
// AGENT LEGO TYPES (Multi-Agent Workflow System)
// ============================================================================

// Workflow status
export type WorkflowStatus = 'draft' | 'running' | 'paused' | 'completed' | 'failed';

// Block status
export type BlockStatus = 'idle' | 'waiting' | 'running' | 'completed' | 'failed';

// Block types
export type AgentBlockType = 'researcher' | 'writer' | 'reviewer' | 'planner' | 'supervisor' | 'summarizer' | 'coder';
export type LogicBlockType = 'conditional' | 'loop' | 'merge' | 'delay' | 'python_verifier' | 'human_review' | 'code_executor';
export type DataBlockType = 'paper_fetcher' | 'memory_store' | 'history_logger' | 'progress_tracker' | 'file_writer' | 'notification';
export type BlockType = AgentBlockType | LogicBlockType | DataBlockType;

// Block category
export type BlockCategory = 'agent' | 'logic' | 'data';

// Connection condition types
export type ConnectionConditionType = 'always' | 'if_true' | 'if_false' | 'if_contains' | 'custom';

// Port definition for block I/O
export interface BlockPort {
  id: string;
  name: string;
  type: 'input' | 'output';
  dataType: 'any' | 'text' | 'json' | 'boolean' | 'number' | 'papers';
}

// Block definition (template for creating blocks)
export interface BlockDefinition {
  type: BlockType;
  category: BlockCategory;
  name: string;
  description: string;
  icon: string;
  inputs: BlockPort[];
  outputs: BlockPort[];
  defaultConfig: Record<string, unknown>;
}

// Agent session (conversation history per agent block)
export interface WorkflowAgentSession {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  totalTokens: number;
}

// Block instance in a workflow
export interface WorkflowBlock {
  id: string;
  type: BlockType;
  name: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  status: BlockStatus;
  memory: Record<string, unknown>;
  agentSession?: WorkflowAgentSession;
  lastInput?: unknown;
  lastOutput?: unknown;
  lastError?: string;
  executionCount: number;
  totalTokensUsed: number;
}

// Connection between blocks
export interface WorkflowConnection {
  id: string;
  sourceBlockId: string;
  sourcePort: string;
  targetBlockId: string;
  targetPort: string;
  condition?: {
    type: ConnectionConditionType;
    value?: string;
  };
}

// Workflow run history entry
export interface WorkflowRunEntry {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: WorkflowStatus;
  error?: string;
  blocksExecuted: number;
  totalTokens: number;
}

// Full workflow definition (stored in IndexedDB)
export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description: string;
  blocks: WorkflowBlock[];
  connections: WorkflowConnection[];
  status: WorkflowStatus;
  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  globalMemory: Record<string, unknown>;
  runHistory: WorkflowRunEntry[];
  createdAt: number;
  updatedAt: number;
  lastSyncedAt?: number;
}

// Server-side metadata only (minimal)
export interface WorkflowMetadata {
  id: string;
  userId: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

// Workflow template (community sharing)
export interface WorkflowTemplate {
  id: string;
  authorId: string;
  authorName: string;
  name: string;
  description: string;
  category: string;
  blocksJson: string;
  connectionsJson: string;
  useCount: number;
  createdAt: number;
}

// Execution log entry (stored in IndexedDB)
export interface ExecutionLog {
  id: string;
  workflowId: string;
  blockId?: string;
  eventType: 'start' | 'complete' | 'error' | 'input' | 'output' | 'pause' | 'resume';
  eventData: unknown;
  timestamp: number;
}

// API key entry (encrypted, stored in IndexedDB)
export interface EncryptedApiKey {
  id: string;  // provider name: 'openai', 'anthropic', etc.
  encryptedKey: string;
  iv: string;
  createdAt: number;
}

// Local Python kernel config
export interface LocalKernelConfig {
  id: 'default';
  url: string;  // ws://localhost:8765
  enabled: boolean;
  lastConnected?: number;
}

// API request/response types for Agent Lego
export interface CreateWorkflowMetadataRequest {
  name: string;
  description?: string;
}

export interface UpdateWorkflowMetadataRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

export interface WorkflowMetadataListResponse {
  workflows: WorkflowMetadata[];
  total: number;
}

export interface WorkflowTemplateListResponse {
  templates: WorkflowTemplate[];
  total: number;
}

export interface CreateWorkflowTemplateRequest {
  name: string;
  description: string;
  category: string;
  blocksJson: string;
  connectionsJson: string;
}

// ============================================================================
// BLOCK EXECUTION TYPES
// ============================================================================

// Execution context passed to each block during execution
export interface BlockExecutionContext {
  workflowId: string;
  blockId: string;
  globalMemory: Record<string, unknown>;
  blockMemory: Record<string, unknown>;
  agentSession?: WorkflowAgentSession;
  apiKeys: Record<string, string>;  // Decrypted keys: { openai: 'sk-...', anthropic: 'sk-...' }
  abortSignal: AbortSignal;

  // Collaboration context (provided by execution engine)
  collaborationContext?: ContextPacket;
  contextPrompt?: string;  // Pre-formatted context for prompts
  blackboard?: Blackboard;
  artifacts?: Artifact[];

  // Callbacks for runtime operations
  updateStatus: (status: BlockStatus) => void;
  updateMemory: (memory: Record<string, unknown>) => void;
  updateGlobalMemory: (key: string, value: unknown) => void;
  appendMessage: (
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: { model?: string; tokens?: number; duration?: number }
  ) => void;
  setCurrentAction: (action: string) => void;  // Update UI with what agent is doing
  log: (message: string, data?: unknown) => void;

  // Collaboration actions (provided by execution engine)
  createArtifact?: (artifact: Omit<Artifact, 'id' | 'workflowId' | 'sourceBlockId' | 'createdBy'>) => Promise<Artifact>;
  submitMergeRequest?: (changes: MergeRequest['changes'], description: string) => Promise<MergeRequest>;
  emitEvent?: (type: WorkflowEventType, data?: Record<string, unknown>) => Promise<WorkflowEvent>;
}

// Block execution result
export interface BlockExecutionResult {
  success: boolean;
  output: unknown;
  error?: string;
  tokensUsed?: number;
  outputPort?: string;  // For conditional blocks: 'output-true' or 'output-false'
  artifactsCreated?: number;  // Number of artifacts created during execution
  mergeRequestsSubmitted?: number;  // Number of merge requests submitted
}

// ============================================================================
// BLOCK INPUT/OUTPUT SCHEMAS
// ============================================================================

// Agent block I/O types
export interface ResearcherBlockInput {
  query: string;
  context?: string;
  maxPapers?: number;
}

export interface ResearcherBlockOutput {
  papers: Array<{ id: string; title: string; authors: string[]; abstract: string; url?: string }>;
  summary: string;
  searchTerms: string[];
}

export interface WriterBlockInput {
  topic: string;
  research?: unknown;
  outline?: string;
  style?: 'academic' | 'blog' | 'technical' | 'creative';
  maxWords?: number;
}

export interface WriterBlockOutput {
  content: string;
  wordCount: number;
  sections?: string[];
}

export interface ReviewerBlockInput {
  content: string;
  criteria?: string[];
  strictness?: 'lenient' | 'moderate' | 'strict';
}

export interface ReviewerBlockOutput {
  approved: boolean;
  score: number;  // 0-100
  feedback: string;
  suggestions: string[];
  issues: Array<{ severity: 'minor' | 'major' | 'critical'; description: string }>;
}

export interface PlannerBlockInput {
  goal: string;
  constraints?: string[];
  resources?: string[];
}

export interface PlannerBlockOutput {
  plan: Array<{ step: number; action: string; description: string; dependencies?: number[] }>;
  estimatedSteps: number;
  risks: string[];
}

export interface SupervisorBlockInput {
  task: string;
  subResults: Array<{ blockId: string; output: unknown }>;
  context?: string;
}

export interface SupervisorBlockOutput {
  decision: 'continue' | 'retry' | 'abort' | 'complete';
  feedback: string;
  nextAction?: string;
  aggregatedResult?: unknown;
}

export interface SummarizerBlockInput {
  content: string | string[];
  maxLength?: number;
  format?: 'paragraph' | 'bullets' | 'structured';
}

export interface SummarizerBlockOutput {
  summary: string;
  keyPoints: string[];
  wordCount: number;
}

export interface CoderBlockInput {
  task: string;
  language: string;
  context?: string;
  existingCode?: string;
}

export interface CoderBlockOutput {
  code: string;
  language: string;
  explanation: string;
  tests?: string;
}

// Logic block I/O types
export interface ConditionalBlockInput {
  value: unknown;
  condition?: string;  // JavaScript expression to evaluate
}

export interface ConditionalBlockOutput {
  value: unknown;
  conditionResult: boolean;
}

export interface LoopBlockInput {
  items?: unknown[];
  currentIndex?: number;
  accumulator?: unknown;
}

export interface LoopBlockOutput {
  currentItem?: unknown;
  index: number;
  isComplete: boolean;
  accumulator?: unknown;
}

export interface MergeBlockInput {
  inputA?: unknown;
  inputB?: unknown;
}

export interface MergeBlockOutput {
  merged: unknown;
  sources: string[];
}

export interface DelayBlockInput {
  value: unknown;
  delaySeconds?: number;
}

export interface DelayBlockOutput {
  value: unknown;
  delayedAt: number;
  resumedAt: number;
}

export interface PythonVerifierBlockInput {
  value: unknown;
  code: string;  // Python code to execute
}

export interface PythonVerifierBlockOutput {
  result: unknown;
  passed: boolean;
  stdout: string;
  stderr: string;
}

export interface HumanReviewBlockInput {
  content: unknown;
  prompt: string;
  options?: string[];
}

export interface HumanReviewBlockOutput {
  approved: boolean;
  feedback?: string;
  selectedOption?: string;
  reviewedAt: number;
  reviewerId: string;
}

// Data block I/O types
export interface PaperFetcherBlockInput {
  query?: string;
  paperIds?: string[];
  source?: 'arxiv' | 'semantic_scholar' | 'local';
  maxResults?: number;
}

export interface PaperFetcherBlockOutput {
  papers: Array<{
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    url?: string;
    pdfUrl?: string;
    publishedDate?: string;
  }>;
  totalFound: number;
}

export interface MemoryStoreBlockInput {
  action: 'get' | 'set' | 'delete' | 'list';
  key?: string;
  value?: unknown;
  scope?: 'block' | 'global';
}

export interface MemoryStoreBlockOutput {
  success: boolean;
  value?: unknown;
  keys?: string[];
}

export interface HistoryLoggerBlockInput {
  value: unknown;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface HistoryLoggerBlockOutput {
  logged: boolean;
  logId: string;
  timestamp: number;
}

export interface ProgressTrackerBlockInput {
  update: {
    current: number;
    total: number;
    message?: string;
    stage?: string;
  };
}

export interface ProgressTrackerBlockOutput {
  progress: number;  // 0-100
  message: string;
  stage: string;
  estimatedTimeRemaining?: number;
}

export interface FileWriterBlockInput {
  content: string;
  filename: string;
  format?: 'text' | 'json' | 'markdown' | 'pdf';
  append?: boolean;
}

export interface FileWriterBlockOutput {
  success: boolean;
  filePath: string;
  bytesWritten: number;
}

export interface NotificationBlockInput {
  message: string;
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actions?: Array<{ label: string; action: string }>;
}

export interface NotificationBlockOutput {
  sent: boolean;
  timestamp: number;
  userAction?: string;
}

// ============================================================================
// BLOCK DEFINITIONS REGISTRY
// ============================================================================

// Complete block definition with I/O schema
export interface CompleteBlockDefinition {
  type: BlockType;
  category: BlockCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  inputs: BlockPort[];
  outputs: BlockPort[];
  defaultConfig: Record<string, unknown>;
  configSchema: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'code';
    options?: Array<{ value: string; label: string }>;
    default?: unknown;
    required?: boolean;
    placeholder?: string;
  }>;
}

// All block definitions
export const BLOCK_DEFINITIONS: Record<BlockType, CompleteBlockDefinition> = {
  // Agent Blocks
  researcher: {
    type: 'researcher',
    category: 'agent',
    name: 'Researcher',
    description: 'Search and analyze academic papers and research',
    icon: 'FileSearch',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Query', type: 'input', dataType: 'text' }
    ],
    outputs: [
      { id: 'output', name: 'Research', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4096,
      maxPapers: 10,
      searchSources: ['arxiv', 'semantic_scholar']
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
        { value: 'claude-haiku-4', label: 'Claude Haiku 4' }
      ]},
      { key: 'temperature', label: 'Temperature', type: 'number', default: 0.7 },
      { key: 'maxPapers', label: 'Max Papers', type: 'number', default: 10 },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'Custom instructions for the researcher...' }
    ]
  },
  writer: {
    type: 'writer',
    category: 'agent',
    name: 'Writer',
    description: 'Generate written content based on research or prompts',
    icon: 'Pen',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Topic/Research', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Content', type: 'output', dataType: 'text' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.8,
      maxTokens: 4096,
      style: 'academic'
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
      ]},
      { key: 'temperature', label: 'Temperature', type: 'number', default: 0.8 },
      { key: 'style', label: 'Writing Style', type: 'select', options: [
        { value: 'academic', label: 'Academic' },
        { value: 'blog', label: 'Blog Post' },
        { value: 'technical', label: 'Technical' },
        { value: 'creative', label: 'Creative' }
      ]},
      { key: 'maxWords', label: 'Max Words', type: 'number', default: 2000 },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' }
    ]
  },
  reviewer: {
    type: 'reviewer',
    category: 'agent',
    name: 'Reviewer',
    description: 'Review and critique content with detailed feedback',
    icon: 'ClipboardCheck',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Content', type: 'input', dataType: 'text' }
    ],
    outputs: [
      { id: 'output', name: 'Review', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.5,
      strictness: 'moderate'
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
      ]},
      { key: 'strictness', label: 'Strictness', type: 'select', options: [
        { value: 'lenient', label: 'Lenient' },
        { value: 'moderate', label: 'Moderate' },
        { value: 'strict', label: 'Strict' }
      ]},
      { key: 'criteria', label: 'Review Criteria', type: 'textarea', placeholder: 'List criteria to evaluate...' },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' }
    ]
  },
  planner: {
    type: 'planner',
    category: 'agent',
    name: 'Planner',
    description: 'Create structured plans and task breakdowns',
    icon: 'ListTodo',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Goal', type: 'input', dataType: 'text' }
    ],
    outputs: [
      { id: 'output', name: 'Plan', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.6
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
      ]},
      { key: 'constraints', label: 'Constraints', type: 'textarea', placeholder: 'List any constraints...' },
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' }
    ]
  },
  supervisor: {
    type: 'supervisor',
    category: 'agent',
    name: 'Supervisor',
    description: 'Coordinate and make decisions across sub-tasks',
    icon: 'Eye',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Task/Results', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Decision', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.4
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
      ]},
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' }
    ]
  },
  summarizer: {
    type: 'summarizer',
    category: 'agent',
    name: 'Summarizer',
    description: 'Summarize and extract key points from content',
    icon: 'FileText',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Content', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Summary', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o-mini',
      temperature: 0.5,
      maxLength: 500,
      format: 'bullets'
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'claude-haiku-4', label: 'Claude Haiku 4' }
      ]},
      { key: 'maxLength', label: 'Max Length (words)', type: 'number', default: 500 },
      { key: 'format', label: 'Format', type: 'select', options: [
        { value: 'paragraph', label: 'Paragraph' },
        { value: 'bullets', label: 'Bullet Points' },
        { value: 'structured', label: 'Structured' }
      ]}
    ]
  },
  coder: {
    type: 'coder',
    category: 'agent',
    name: 'Coder',
    description: 'Generate, review, or modify code',
    icon: 'Code',
    color: 'green',
    inputs: [
      { id: 'input', name: 'Task', type: 'input', dataType: 'text' }
    ],
    outputs: [
      { id: 'output', name: 'Code', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      modelId: 'gpt-4o',
      temperature: 0.3,
      language: 'python'
    },
    configSchema: [
      { key: 'modelId', label: 'AI Model', type: 'select', options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }
      ]},
      { key: 'language', label: 'Language', type: 'select', options: [
        { value: 'python', label: 'Python' },
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'rust', label: 'Rust' },
        { value: 'go', label: 'Go' }
      ]},
      { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' }
    ]
  },

  // Logic Blocks
  conditional: {
    type: 'conditional',
    category: 'logic',
    name: 'Conditional',
    description: 'Branch workflow based on conditions',
    icon: 'GitBranch',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output-true', name: 'True', type: 'output', dataType: 'any' },
      { id: 'output-false', name: 'False', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      condition: 'value.success === true'
    },
    configSchema: [
      { key: 'condition', label: 'Condition', type: 'code', placeholder: 'JavaScript expression (use "value" for input)', required: true }
    ]
  },
  loop: {
    type: 'loop',
    category: 'logic',
    name: 'Loop',
    description: 'Iterate over items or until condition met',
    icon: 'Repeat',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Items/Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output-continue', name: 'Continue', type: 'output', dataType: 'any' },
      { id: 'output-done', name: 'Done', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      maxIterations: 10,
      stopCondition: ''
    },
    configSchema: [
      { key: 'maxIterations', label: 'Max Iterations', type: 'number', default: 10 },
      { key: 'stopCondition', label: 'Stop Condition', type: 'code', placeholder: 'Optional: stop when this returns true' }
    ]
  },
  merge: {
    type: 'merge',
    category: 'logic',
    name: 'Merge',
    description: 'Combine outputs from multiple blocks',
    icon: 'Merge',
    color: 'amber',
    inputs: [
      { id: 'input-a', name: 'Input A', type: 'input', dataType: 'any' },
      { id: 'input-b', name: 'Input B', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Merged', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      mergeStrategy: 'object'
    },
    configSchema: [
      { key: 'mergeStrategy', label: 'Merge Strategy', type: 'select', options: [
        { value: 'object', label: 'Merge Objects' },
        { value: 'array', label: 'Combine to Array' },
        { value: 'concat', label: 'Concatenate Strings' }
      ]}
    ]
  },
  delay: {
    type: 'delay',
    category: 'logic',
    name: 'Delay',
    description: 'Pause workflow execution for a duration',
    icon: 'Clock',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Value', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      delaySeconds: 60
    },
    configSchema: [
      { key: 'delaySeconds', label: 'Delay (seconds)', type: 'number', default: 60 }
    ]
  },
  python_verifier: {
    type: 'python_verifier',
    category: 'logic',
    name: 'Python Verifier',
    description: 'Run Python code to verify or transform data',
    icon: 'CheckSquare',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output-pass', name: 'Pass', type: 'output', dataType: 'any' },
      { id: 'output-fail', name: 'Fail', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      code: '# Input is available as "value"\n# Return True to pass, False to fail\nresult = True\nreturn result'
    },
    configSchema: [
      { key: 'code', label: 'Python Code', type: 'code', required: true, placeholder: '# Access input via "value" variable\n# Return boolean for pass/fail' }
    ]
  },
  human_review: {
    type: 'human_review',
    category: 'logic',
    name: 'Human Review',
    description: 'Pause for human approval or input',
    icon: 'UserCheck',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Content', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output-approved', name: 'Approved', type: 'output', dataType: 'any' },
      { id: 'output-rejected', name: 'Rejected', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      prompt: 'Please review and approve this content:',
      timeoutMinutes: 60
    },
    configSchema: [
      { key: 'prompt', label: 'Review Prompt', type: 'textarea', required: true },
      { key: 'options', label: 'Options (comma-separated)', type: 'string', placeholder: 'approve,reject,revise' },
      { key: 'timeoutMinutes', label: 'Timeout (minutes)', type: 'number', default: 60 }
    ]
  },
  code_executor: {
    type: 'code_executor',
    category: 'logic',
    name: 'Code Executor',
    description: 'Execute Python code with automatic debugging',
    icon: 'Terminal',
    color: 'amber',
    inputs: [
      { id: 'input', name: 'Code', type: 'input', dataType: 'text' }
    ],
    outputs: [
      { id: 'output', name: 'Result', type: 'output', dataType: 'json' },
      { id: 'debug_output', name: 'Debug Info', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      timeout: 60000,
      maxDebugAttempts: 3
    },
    configSchema: [
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', default: 60000 },
      { key: 'maxDebugAttempts', label: 'Max Debug Attempts', type: 'number', default: 3 }
    ]
  },

  // Data Blocks
  paper_fetcher: {
    type: 'paper_fetcher',
    category: 'data',
    name: 'Paper Fetcher',
    description: 'Fetch papers from academic sources',
    icon: 'Database',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Query/IDs', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Papers', type: 'output', dataType: 'papers' }
    ],
    defaultConfig: {
      source: 'arxiv',
      maxResults: 10
    },
    configSchema: [
      { key: 'source', label: 'Source', type: 'select', options: [
        { value: 'arxiv', label: 'arXiv' },
        { value: 'semantic_scholar', label: 'Semantic Scholar' },
        { value: 'local', label: 'Local Database' }
      ]},
      { key: 'maxResults', label: 'Max Results', type: 'number', default: 10 }
    ]
  },
  memory_store: {
    type: 'memory_store',
    category: 'data',
    name: 'Memory Store',
    description: 'Store and retrieve data from memory',
    icon: 'Database',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Result', type: 'output', dataType: 'any' }
    ],
    defaultConfig: {
      action: 'set',
      key: '',
      scope: 'global'
    },
    configSchema: [
      { key: 'action', label: 'Action', type: 'select', options: [
        { value: 'get', label: 'Get' },
        { value: 'set', label: 'Set' },
        { value: 'delete', label: 'Delete' },
        { value: 'list', label: 'List Keys' }
      ]},
      { key: 'key', label: 'Key', type: 'string', placeholder: 'Memory key name' },
      { key: 'scope', label: 'Scope', type: 'select', options: [
        { value: 'block', label: 'Block (private)' },
        { value: 'global', label: 'Global (shared)' }
      ]}
    ]
  },
  history_logger: {
    type: 'history_logger',
    category: 'data',
    name: 'History Logger',
    description: 'Log values to execution history',
    icon: 'History',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Value', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Logged', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      label: ''
    },
    configSchema: [
      { key: 'label', label: 'Log Label', type: 'string', placeholder: 'Optional label for this log entry' }
    ]
  },
  progress_tracker: {
    type: 'progress_tracker',
    category: 'data',
    name: 'Progress Tracker',
    description: 'Track and display workflow progress',
    icon: 'TrendingUp',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Update', type: 'input', dataType: 'json' }
    ],
    outputs: [
      { id: 'output', name: 'Progress', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {},
    configSchema: []
  },
  file_writer: {
    type: 'file_writer',
    category: 'data',
    name: 'File Writer',
    description: 'Write content to downloadable files',
    icon: 'FileOutput',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Content', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'File', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      filename: 'output',
      format: 'text'
    },
    configSchema: [
      { key: 'filename', label: 'Filename', type: 'string', required: true },
      { key: 'format', label: 'Format', type: 'select', options: [
        { value: 'text', label: 'Plain Text' },
        { value: 'json', label: 'JSON' },
        { value: 'markdown', label: 'Markdown' },
        { value: 'pdf', label: 'PDF' }
      ]},
      { key: 'append', label: 'Append Mode', type: 'boolean', default: false }
    ]
  },
  notification: {
    type: 'notification',
    category: 'data',
    name: 'Notification',
    description: 'Send notifications to the user',
    icon: 'Bell',
    color: 'blue',
    inputs: [
      { id: 'input', name: 'Message', type: 'input', dataType: 'any' }
    ],
    outputs: [
      { id: 'output', name: 'Sent', type: 'output', dataType: 'json' }
    ],
    defaultConfig: {
      type: 'info'
    },
    configSchema: [
      { key: 'title', label: 'Title', type: 'string', placeholder: 'Optional notification title' },
      { key: 'type', label: 'Type', type: 'select', options: [
        { value: 'info', label: 'Info' },
        { value: 'success', label: 'Success' },
        { value: 'warning', label: 'Warning' },
        { value: 'error', label: 'Error' }
      ]}
    ]
  }
};

// ============================================================================
// MULTI-AGENT COLLABORATION SYSTEM
// Blackboard + Event Log Architecture for Agent Coordination
// ============================================================================

// ---------------------------------------------------------------------------
// ARTIFACT SYSTEM - Typed objects agents produce and consume
// ---------------------------------------------------------------------------

export type ArtifactType =
  | 'source'           // PDFs, URLs, BibTeX entries
  | 'note'             // Claims, definitions, equations, open questions
  | 'hypothesis'       // Idea proposals with assumptions + predictions
  | 'experiment_spec'  // Datasets, code, parameters, metrics, stopping rules
  | 'run'              // Logs, stdout, plots, tables, checkpoints
  | 'draft'            // Paper sections, figures, related-work bullets
  | 'decision'         // Accepted/rejected with rationale
  | 'code'             // Generated or referenced code
  | 'data'             // Datasets, tables, structured data
  | 'citation'         // Reference to external work
  | 'constraint'       // Hard constraints that must be respected
  | 'summary';         // Condensed version of other artifacts

export type ArtifactStatus = 'draft' | 'proposed' | 'verified' | 'merged' | 'rejected' | 'archived';

// Link between artifacts
export interface ArtifactLink {
  targetId: string;
  relation: 'derives_from' | 'cites' | 'refutes' | 'supports' | 'extends' | 'depends_on' | 'supersedes';
  metadata?: Record<string, unknown>;
}

// Base artifact interface
export interface Artifact {
  id: string;
  workflowId: string;
  type: ArtifactType;
  title: string;
  content: unknown;  // Type-specific content
  metadata: {
    createdBy: string;       // Agent/block ID or 'user'
    createdAt: number;
    updatedAt: number;
    version: number;
    tags: string[];
    citations?: string[];    // Source IDs this artifact cites
  };
  links: ArtifactLink[];
  status: ArtifactStatus;
  validationErrors?: string[];
}

// Specific artifact content types
export interface SourceArtifactContent {
  sourceType: 'pdf' | 'url' | 'bibtex' | 'text';
  url?: string;
  title: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  fullText?: string;
  extractedPassages?: Array<{
    id: string;
    text: string;
    page?: number;
    lineStart?: number;
    lineEnd?: number;
  }>;
}

export interface NoteArtifactContent {
  noteType: 'claim' | 'definition' | 'equation' | 'question' | 'insight' | 'observation';
  text: string;
  latex?: string;
  confidence?: number;  // 0-1
  evidence: Array<{
    sourceId: string;
    quoteSpan?: string;
    page?: number;
  }>;
  dependencies?: string[];  // IDs of other notes/claims this depends on
}

export interface HypothesisArtifactContent {
  statement: string;
  assumptions: string[];
  predictions: Array<{
    condition: string;
    expectedOutcome: string;
    metric?: string;
  }>;
  status: 'proposed' | 'testing' | 'supported' | 'refuted' | 'inconclusive';
  testResults?: string[];  // Run artifact IDs
}

export interface ExperimentSpecArtifactContent {
  hypothesisId?: string;
  goal: string;
  variables: Array<{
    name: string;
    type: 'independent' | 'dependent' | 'control';
    values?: unknown[];
  }>;
  metrics: Array<{
    name: string;
    type: string;
    lowerIsBetter?: boolean;
  }>;
  protocol: string[];
  stoppingRule: {
    type: 'time' | 'iterations' | 'convergence' | 'threshold';
    value: string;
  };
  expectedOutcomes: Array<{
    condition: string;
    prediction: string;
  }>;
  codePointer?: string;
  datasetPointer?: string;
}

export interface RunArtifactContent {
  experimentSpecId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  parameters: Record<string, unknown>;
  results: {
    metrics: Record<string, number | string>;
    plots?: Array<{ name: string; dataUrl: string }>;
    tables?: Array<{ name: string; data: unknown[][] }>;
    logs?: string;
    stdout?: string;
    stderr?: string;
  };
  checkpoints?: Array<{
    name: string;
    timestamp: number;
    data: unknown;
  }>;
  verificationStatus?: 'pending' | 'passed' | 'failed';
  verificationReport?: string;
}

export interface DraftArtifactContent {
  section: 'abstract' | 'introduction' | 'related_work' | 'methods' | 'results' | 'discussion' | 'conclusion' | 'appendix' | 'custom';
  sectionTitle?: string;
  content: string;  // Markdown
  figures?: Array<{
    id: string;
    caption: string;
    dataUrl?: string;
    artifactId?: string;  // Reference to plot from Run
  }>;
  citations: string[];  // Artifact IDs being cited
  wordCount: number;
  reviewStatus?: 'draft' | 'reviewed' | 'approved';
  reviewFeedback?: string;
}

export interface DecisionArtifactContent {
  decisionType: 'accept' | 'reject' | 'revise' | 'defer' | 'merge';
  subjectId: string;  // Artifact being decided on
  subjectType: ArtifactType;
  rationale: string;
  decidedBy: string;  // Agent ID or 'user'
  decidedAt: number;
  alternatives?: string[];
  conditions?: string[];  // Conditions for acceptance
}

// ---------------------------------------------------------------------------
// EVENT LOG - Append-only provenance tracking
// ---------------------------------------------------------------------------

export type WorkflowEventType =
  | 'artifact_created'
  | 'artifact_updated'
  | 'artifact_deleted'
  | 'artifact_linked'
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'merge_request_created'
  | 'merge_request_approved'
  | 'merge_request_rejected'
  | 'blackboard_updated'
  | 'agent_invoked'
  | 'agent_completed'
  | 'agent_error'
  | 'verification_started'
  | 'verification_passed'
  | 'verification_failed'
  | 'context_assembled'
  | 'user_action';

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  timestamp: number;
  eventType: WorkflowEventType;
  agentId?: string;        // Which agent/block caused this
  blockId?: string;        // Block ID if applicable
  userId?: string;         // User ID if user action
  inputs: string[];        // Artifact IDs used as input
  outputs: string[];       // Artifact IDs produced
  data: Record<string, unknown>;  // Event-specific data
  parentEventId?: string;  // For event chains
}

// ---------------------------------------------------------------------------
// TASK SYSTEM - Directed work requests (Agent Inbox/Outbox)
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentTask {
  id: string;
  workflowId: string;

  // What to do
  goal: string;
  description?: string;

  // Inputs
  inputArtifactIds: string[];
  inputContext?: Record<string, unknown>;  // Additional context

  // Output contract
  outputSchema: {
    artifactType: ArtifactType;
    requiredFields?: string[];
    validationRules?: string[];
  };
  outputArtifactId?: string;  // Filled when completed

  // Assignment
  assignedAgentId?: string;  // Block ID
  assignedAt?: number;

  // Status
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  deadline?: number;

  // Results
  result?: {
    success: boolean;
    error?: string;
    artifacts: string[];  // IDs of produced artifacts
  };

  // Provenance
  createdBy: string;  // Agent/block ID or 'user' or 'supervisor'
  parentTaskId?: string;  // For sub-tasks
}

// Agent's inbox/outbox view
export interface AgentMailbox {
  agentId: string;
  inbox: AgentTask[];      // Tasks assigned to this agent
  outbox: AgentTask[];     // Tasks created by this agent
  completed: AgentTask[];  // Recently completed tasks
}

// ---------------------------------------------------------------------------
// BLACKBOARD - Current truth / working memory (mutable)
// ---------------------------------------------------------------------------

export interface BlackboardClaim {
  id: string;
  text: string;
  confidence: number;  // 0-1
  sourceArtifactIds: string[];  // Evidence
  status: 'proposed' | 'verified' | 'contested' | 'rejected';
  addedAt: number;
  addedBy: string;
}

export interface BlackboardQuestion {
  id: string;
  text: string;
  priority: TaskPriority;
  status: 'open' | 'investigating' | 'answered' | 'deferred';
  relatedArtifactIds: string[];
  proposedAnswers?: Array<{
    text: string;
    confidence: number;
    sourceId?: string;
  }>;
  addedAt: number;
  addedBy: string;
}

export interface BlackboardHypothesis {
  id: string;
  artifactId: string;  // Points to HypothesisArtifact
  status: 'proposed' | 'testing' | 'supported' | 'refuted' | 'inconclusive';
  priority: TaskPriority;
  assignedExperiments: string[];  // ExperimentSpec artifact IDs
}

export interface Blackboard {
  id: string;  // Always 'workspace' for the main blackboard
  workflowId: string;

  // Core sections
  problemStatement: string;
  assumptions: string[];
  constraints: string[];

  // Dynamic content
  claims: BlackboardClaim[];
  openQuestions: BlackboardQuestion[];
  hypotheses: BlackboardHypothesis[];

  // Work queues
  experimentQueue: string[];  // ExperimentSpec artifact IDs, ordered by priority
  draftOutline: Array<{
    section: string;
    artifactId?: string;
    status: 'pending' | 'drafted' | 'reviewed' | 'final';
  }>;

  // Metadata
  lastMergedEventId?: string;
  lastUpdatedAt: number;
  version: number;
}

// ---------------------------------------------------------------------------
// MERGE REQUEST SYSTEM - Controlled blackboard updates
// ---------------------------------------------------------------------------

export type MergeRequestStatus = 'pending' | 'approved' | 'rejected' | 'auto_merged';

export interface MergeRequestCheck {
  name: string;
  description: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  message?: string;
}

export interface MergeRequest {
  id: string;
  workflowId: string;

  // What's being proposed
  title: string;
  description?: string;
  proposedBy: string;  // Agent ID or 'user'
  proposedAt: number;

  // Changes
  changes: Array<{
    type: 'add_claim' | 'update_claim' | 'remove_claim' |
          'add_question' | 'update_question' | 'remove_question' |
          'add_hypothesis' | 'update_hypothesis' | 'remove_hypothesis' |
          'update_problem' | 'add_assumption' | 'add_constraint' |
          'add_to_queue' | 'update_outline' | 'custom';
    target?: string;  // ID of item being modified
    before?: unknown;
    after: unknown;
  }>;

  // Validation
  checks: MergeRequestCheck[];
  autoMergeEligible: boolean;  // All checks passed and no conflicts

  // Status
  status: MergeRequestStatus;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewComment?: string;

  // After merge
  mergedEventId?: string;
}

// Merge rules configuration
export interface MergeRules {
  // Claim rules
  claimRequiresCitation: boolean;
  claimMinConfidence: number;

  // Experiment rules
  experimentRequiresMetrics: boolean;
  experimentRequiresStoppingRule: boolean;

  // Draft rules
  draftRequiresVerifiedClaims: boolean;
  draftMaxUnreviewedCitations: number;

  // Auto-merge thresholds
  autoMergeMinConfidence: number;
  autoMergeRequiresAllChecksPassed: boolean;

  // Human review triggers
  requireHumanReviewFor: Array<'hypothesis' | 'decision' | 'draft_final' | 'constraint_change'>;
}

// ---------------------------------------------------------------------------
// CONTEXT ASSEMBLY - What agents see
// ---------------------------------------------------------------------------

export type ContextTier = 'global' | 'task' | 'agent_local' | 'long_term';

export interface ContextPacket {
  id: string;
  assembledFor: string;  // Agent/block ID
  assembledAt: number;

  // Tiered content
  tiers: {
    global: {
      blackboardSummary: string;
      problemStatement: string;
      activeConstraints: string[];
      recentDecisions: DecisionArtifactContent[];
    };
    task: {
      taskGoal: string;
      inputArtifacts: Artifact[];
      relevantClaims: BlackboardClaim[];
      relevantQuestions: BlackboardQuestion[];
    };
    agentLocal: {
      previousOutputs: Array<{ taskId: string; outputId: string; summary: string }>;
      scratchpad: Record<string, unknown>;
    };
    longTerm: {
      agentPreferences: Record<string, unknown>;
      repeatedPatterns: string[];
      learnedConstraints: string[];
    };
  };

  // Token budget info
  estimatedTokens: number;
  maxTokens: number;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// HANDOFF SCHEMAS - Contracts between agents
// ---------------------------------------------------------------------------

// Researcher -> Planner handoff
export interface ResearcherToPlannerHandoff {
  claims: Array<{
    id: string;
    text: string;
    evidence: Array<{ sourceId: string; quoteSpan?: string }>;
    confidence: number;
    dependencies?: string[];
  }>;
  openQuestions: Array<{
    id: string;
    text: string;
    priority: TaskPriority;
  }>;
  recommendedNextSteps: Array<{
    type: 'experiment' | 'more_research' | 'write_section' | 'verify_claim';
    goal: string;
    priority: TaskPriority;
    rationale?: string;
  }>;
  sourcesAnalyzed: string[];
}

// Planner -> Experimenter handoff
export interface PlannerToExperimenterHandoff {
  experimentSpec: ExperimentSpecArtifactContent;
  context: {
    hypothesisId: string;
    relatedClaims: string[];
    previousAttempts?: Array<{
      runId: string;
      outcome: string;
      lesson: string;
    }>;
  };
  constraints: string[];
  successCriteria: string[];
}

// Experimenter -> Verifier handoff
export interface ExperimenterToVerifierHandoff {
  runArtifactId: string;
  experimentSpecId: string;
  claims: Array<{
    claimId: string;
    expectedValue: unknown;
    observedValue: unknown;
    metric: string;
  }>;
  reproducibilityInfo: {
    randomSeed?: number;
    environmentHash?: string;
    codeVersion?: string;
  };
}

// Verifier -> Writer handoff
export interface VerifierToWriterHandoff {
  verifiedRuns: Array<{
    runId: string;
    verificationStatus: 'passed' | 'failed';
    keyFindings: string[];
    tableData?: unknown[][];
    plotIds?: string[];
  }>;
  supportedClaims: Array<{
    claimId: string;
    evidence: string;
    confidence: number;
  }>;
  caveats: string[];
}

// Writer -> Reviewer handoff
export interface WriterToReviewerHandoff {
  draftArtifactId: string;
  section: string;
  claimsCited: string[];
  runsCited: string[];
  previousFeedback?: Array<{
    reviewId: string;
    issues: string[];
    addressed: boolean;
  }>;
}

// Reviewer -> Writer feedback
export interface ReviewerFeedback {
  draftArtifactId: string;
  overallAssessment: 'approve' | 'revise' | 'reject';
  score: number;  // 0-100
  issues: Array<{
    severity: 'minor' | 'major' | 'critical';
    location?: string;
    description: string;
    suggestedFix?: string;
  }>;
  missingCitations: string[];
  unsupportedClaims: string[];
  styleIssues: string[];
  strengths: string[];
}

// ---------------------------------------------------------------------------
// SUPERVISOR/CONTROLLER
// ---------------------------------------------------------------------------

export type SupervisorDecision =
  | 'continue'      // Proceed with next task
  | 'retry'         // Retry failed task
  | 'reassign'      // Assign to different agent
  | 'escalate'      // Need human input
  | 'abort'         // Stop workflow
  | 'branch'        // Create parallel tasks
  | 'merge'         // Combine results
  | 'checkpoint';   // Save state and pause

export interface SupervisorState {
  workflowId: string;
  currentPhase: 'research' | 'planning' | 'experimenting' | 'verifying' | 'writing' | 'reviewing' | 'finalizing';
  activeTasks: string[];
  pendingDecisions: Array<{
    id: string;
    type: 'merge_request' | 'task_failure' | 'human_review' | 'conflict';
    subjectId: string;
    options: SupervisorDecision[];
    deadline?: number;
  }>;
  progressMetrics: {
    tasksCompleted: number;
    tasksTotal: number;
    claimsVerified: number;
    sectionsComplete: number;
    overallProgress: number;  // 0-100
  };
  lastCheckpoint?: {
    timestamp: number;
    stateHash: string;
    resumable: boolean;
  };
}

// ---------------------------------------------------------------------------
// WORKSPACE - Top-level container
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  workflowId: string;
  name: string;

  // Core components
  blackboard: Blackboard;
  artifacts: Map<string, Artifact> | Record<string, Artifact>;
  events: WorkflowEvent[];  // Recent events (older ones in storage)

  // Task management
  taskQueue: AgentTask[];
  agentMailboxes: Record<string, AgentMailbox>;

  // Merge system
  pendingMergeRequests: MergeRequest[];
  mergeRules: MergeRules;

  // Supervisor
  supervisorState: SupervisorState;

  // Configuration
  contextAssemblyRules: {
    maxTokensPerTier: Record<ContextTier, number>;
    priorityWeights: Record<ArtifactType, number>;
    recencyWeight: number;
  };

  // Metadata
  createdAt: number;
  lastActivityAt: number;
}

// Default merge rules
export const DEFAULT_MERGE_RULES: MergeRules = {
  claimRequiresCitation: true,
  claimMinConfidence: 0.5,
  experimentRequiresMetrics: true,
  experimentRequiresStoppingRule: true,
  draftRequiresVerifiedClaims: true,
  draftMaxUnreviewedCitations: 3,
  autoMergeMinConfidence: 0.8,
  autoMergeRequiresAllChecksPassed: true,
  requireHumanReviewFor: ['hypothesis', 'decision', 'draft_final', 'constraint_change'],
};

// ============================================================================
// AGENTIC POLITICS - HIERARCHICAL GOVERNANCE TYPES
// ============================================================================

/**
 * Authority levels for agents in the political hierarchy.
 * Higher levels can command lower levels.
 *
 * Level 10: Commander - Top-level orchestrator
 * Level 8: Strategist - High-level planning
 * Level 6: Supervisor - Team coordination
 * Level 5: Reviewer - Quality control
 * Level 4: Workers - Researcher, Coder, Writer
 * Level 3: Verifier - Code/output verification
 * Level 2: Logger - Record keeping
 * Level 1: Messenger - Communication relay
 * Level 0: Observer - Read-only access
 */
export type AuthorityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Predefined roles in the political system.
 * Each role has specific permissions and authority.
 */
export type AgentRole =
  | 'commander'    // Level 10: Delegates all work, synthesizes reports
  | 'strategist'   // Level 8: High-level planning, can command supervisor/workers
  | 'supervisor'   // Level 6: Coordinates workers, verifier, logger
  | 'reviewer'     // Level 5: Approves/rejects, read-only memory
  | 'researcher'   // Level 4: File read, web, API, LLM access
  | 'coder'        // Level 4: File r/w, code execution, LLM
  | 'writer'       // Level 4: File r/w, LLM
  | 'verifier'     // Level 3: File read, code execution only
  | 'logger'       // Level 2: Memory r/w only
  | 'messenger'    // Level 1: Memory read, relay messages
  | 'observer';    // Level 0: Memory read only

/**
 * Resource types that agents can access.
 * Permissions are defined per-role.
 */
export type ResourceType =
  | 'file_read'       // Read files from workspace
  | 'file_write'      // Write files to workspace
  | 'api_call'        // Make external API calls
  | 'web_search'      // Search the web
  | 'memory_read'     // Read from memory store
  | 'memory_write'    // Write to memory store
  | 'code_execute'    // Execute code (Python, etc.)
  | 'llm_call';       // Make LLM API calls

/**
 * Actions that agents can perform.
 * Constrained by role permissions.
 */
export type AgentAction =
  | 'command'      // Issue command to subordinate
  | 'delegate'     // Delegate task to subordinate
  | 'report'       // Report back to superior
  | 'message'      // Send message to peer
  | 'approve'      // Approve work
  | 'reject'       // Reject work
  | 'escalate'     // Escalate to superior
  | 'execute';     // Execute assigned task

/**
 * Permission configuration for a role.
 */
export interface RolePermission {
  resources: ResourceType[];
  actions: AgentAction[];
  canCommand: AgentRole[];
  canMessagePeers: AgentRole[];
  reportTo: AgentRole[];
}

/**
 * Complete role definition with metadata.
 */
export interface RoleDefinition {
  role: AgentRole;
  name: string;
  description: string;
  authorityLevel: AuthorityLevel;
  permissions: RolePermission;
  systemPromptTemplate: string;
  icon: string;
  color: string;
}

/**
 * A command issued from a superior to a subordinate.
 */
export interface Command {
  id: string;
  type: 'task' | 'query' | 'directive';
  fromAgentId: string;
  fromRole: AgentRole;
  toAgentId: string;
  toRole: AgentRole;
  instruction: string;
  context?: string;
  constraints?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  issuedAt: number;
  acknowledgedAt?: number;
  completedAt?: number;
  status: 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'failed';
}

/**
 * A report sent from subordinate back to superior.
 */
export interface Report {
  id: string;
  commandId: string;
  fromAgentId: string;
  fromRole: AgentRole;
  toAgentId: string;
  toRole: AgentRole;
  status: 'success' | 'partial' | 'failed' | 'needs_escalation';
  summary: string;
  output?: unknown;
  tokensUsed?: number;
  submittedAt: number;
}

/**
 * A message between peers (same authority level).
 */
export interface PeerMessage {
  id: string;
  fromAgentId: string;
  fromRole: AgentRole;
  toAgentId: string;
  toRole: AgentRole;
  content: string;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Power relation between two agents.
 */
export interface PowerRelation {
  id: string;
  superiorAgentId: string;
  superiorRole: AgentRole;
  subordinateAgentId: string;
  subordinateRole: AgentRole;
  type: 'command' | 'oversight' | 'peer';
}

/**
 * Permission violation record.
 * Created when an agent attempts an unauthorized action.
 */
export interface PermissionViolation {
  id: string;
  type: 'resource' | 'action' | 'command' | 'authority';
  violatingAgentId: string;
  violatingRole: AgentRole;
  targetAgentId?: string;
  targetRole?: AgentRole;
  attemptedOperation: string;
  attemptedResource?: ResourceType;
  attemptedAction?: AgentAction;
  message: string;
  timestamp: number;
  severity: 'warning' | 'error' | 'critical';
}

/**
 * Extended workflow block for political mode.
 */
export interface PoliticalAgentBlock extends WorkflowBlock {
  // Political properties
  role: AgentRole;
  authorityLevel: AuthorityLevel;

  // Command/Report state
  pendingCommands: Command[];
  activeCommand?: Command;
  commandHistory: Command[];
  reportHistory: Report[];

  // Relationships
  subordinateIds: string[];
  superiorId?: string;
  peerIds: string[];

  // Political status
  politicalStatus: 'idle' | 'awaiting_command' | 'executing' | 'reporting' | 'waiting_for_subordinate';

  // Messages
  inbox: PeerMessage[];
  outbox: PeerMessage[];
}

/**
 * Extended workflow for political mode.
 */
export interface PoliticalWorkflow extends Workflow {
  isPoliticalMode: true;
  politicalBlocks: PoliticalAgentBlock[];
  powerRelations: PowerRelation[];
  commandHistory: Command[];
  reportHistory: Report[];
  messageHistory: PeerMessage[];
  violations: PermissionViolation[];
  rootCommanderId: string;
  currentChainOfCommand: string[];  // Active command chain from root to current
}

/**
 * Execution state for political workflow.
 */
export interface PoliticalExecutionState {
  workflowId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'violation_halt';
  rootCommanderId: string;
  currentCommandChain: Command[];
  activeReports: Report[];
  violations: PermissionViolation[];
  startedAt: number;
  completedAt?: number;
  totalTokensUsed: number;
  commandsIssued: number;
  reportsReceived: number;
}

/**
 * Options for political workflow execution.
 */
export interface PoliticalExecutionOptions {
  apiKeys: Record<string, string>;
  userInstruction: string;  // Initial instruction from human user

  // Callbacks
  onCommandIssued?: (command: Command) => void;
  onReportReceived?: (report: Report) => void;
  onViolation?: (violation: PermissionViolation) => void;
  onStatusChange?: (status: PoliticalExecutionState['status']) => void;
  onAgentStatusChange?: (agentId: string, status: PoliticalAgentBlock['politicalStatus']) => void;
  onAgentMessage?: (
    blockId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: { model?: string; tokens?: number; duration?: number }
  ) => void;
  onAgentAction?: (blockId: string, action: string) => void;

  // Peer messaging
  onPeerMessage?: (message: PeerMessage) => void;

  // Violation handling
  haltOnViolation?: boolean;  // Default: true

  // Logging
  enableDetailedLogs?: boolean;

  // Final result callback - called when workflow completes with final output
  onFinalResult?: (result: string) => void;

  // Code execution callback (for coder agent)
  onCodeExecuted?: (
    blockId: string,
    code: string,
    result: { success: boolean; stdout: string; stderr: string; executionTime: number }
  ) => void;

  // User interrupt - get pending user message (if any)
  // Returns the message and clears the pending message queue
  getUserMessage?: () => string | null;
}

// ============================================================================
// AGENT MEMORY LOG TYPES
// ============================================================================

/**
 * Private Memory Log Entry - Personal progress and state for an agent.
 * Only this agent can read/write its private log.
 */
export interface PrivateMemoryLogEntry {
  id: string;
  timestamp: number;
  type: 'progress' | 'problem' | 'help_request' | 'reflection' | 'decision';
  purpose: string;        // What was the goal/purpose
  action: string;         // What did I do
  result?: string;        // What was the outcome
  currentProblem?: string; // What problem am I facing
  needsHelp?: {
    fromRole: AgentRole;
    reason: string;
  };
}

/**
 * Private Memory Log - Each agent's personal memory.
 * Stored per agent, persisted in IndexedDB.
 */
export interface PrivateMemoryLog {
  agentId: string;
  workflowId: string;

  // Agent's self-definition (read on context switch)
  identity: {
    skills: string[];        // What can this agent do
    values: string[];        // What principles guide this agent
    goals: string[];         // What is this agent trying to achieve
    constraints: string[];   // What limitations does this agent have
  };

  // Progress entries
  entries: PrivateMemoryLogEntry[];

  // Quick state
  lastUpdated: number;
  currentTask?: string;
  currentStatus: 'idle' | 'working' | 'blocked' | 'waiting';
}

/**
 * Public Memory Log Entry - Shared milestone or update visible to all.
 */
export interface PublicMemoryLogEntry {
  id: string;
  timestamp: number;
  type: 'milestone' | 'progress' | 'problem' | 'announcement' | 'role_reminder';
  authorAgentId: string;
  authorRole: AgentRole;
  title: string;
  content: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Public Memory Log - Shared memory visible to all agents.
 * Central knowledge base for the workflow.
 */
export interface PublicMemoryLog {
  workflowId: string;

  // System-wide goals (set by Commander or user)
  mainGoal: string;
  subGoals: string[];

  // Role reminders (re-emphasis for all agents)
  roleReminders: {
    role: AgentRole;
    reminder: string;
    lastEmphasized: number;
  }[];

  // Milestones and progress
  milestones: {
    id: string;
    title: string;
    description: string;
    achievedAt?: number;
    status: 'pending' | 'in_progress' | 'achieved' | 'blocked';
  }[];

  // Current difficulties/problems
  activeProblems: {
    id: string;
    reportedBy: AgentRole;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reportedAt: number;
    resolvedAt?: number;
  }[];

  // All entries
  entries: PublicMemoryLogEntry[];

  // Metadata
  createdAt: number;
  lastUpdated: number;
}

// ============================================================================
// Background Reading Types
// ============================================================================

/**
 * Status of a background reading job
 */
export type BackgroundJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Progress information for a background reading job
 */
export interface BackgroundJobProgress {
  currentPage: number;
  totalPages: number;
  pagesCompleted: number;
  percentComplete: number;
}

/**
 * Token usage for a background reading job
 */
export interface BackgroundJobTokens {
  promptTokens: number;
  completionTokens: number;
  total: number;
}

/**
 * Timing information for a background reading job
 */
export interface BackgroundJobTiming {
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedCompletionAt?: number;
}

/**
 * Debug entry from background reading
 */
export interface BackgroundDebugEntry {
  id: string;
  timestamp: string;
  type: 'request' | 'response' | 'error';
  pageNumber: number;
  prompt?: string;
  systemPrompt?: string;
  response?: string;
  error?: string;
  sentenceCount?: number;
  figureTableCount?: number;
  promptTokens?: number;
  completionTokens?: number;
  duration?: number;
}

/**
 * Background reading job information
 */
export interface BackgroundReadingJob {
  id: string;
  paperId: string;
  paperTitle?: string;
  paperArxivId?: string;
  sessionId: string;
  status: BackgroundJobStatus;
  progress: BackgroundJobProgress;
  tokens?: BackgroundJobTokens;
  timing?: BackgroundJobTiming;
  debugEntries?: BackgroundDebugEntry[];
  error?: string;
  retryCount?: number;
}

/**
 * Request to start a background reading job
 */
export interface StartBackgroundReadingRequest {
  paperId: string;
  sessionId: string;
  workflowConfig?: any;
}

/**
 * Response from starting a background reading job
 */
export interface StartBackgroundReadingResponse {
  jobId: string;
  status: BackgroundJobStatus;
  message: string;
}

/**
 * Response from getting background job status
 */
export interface BackgroundJobStatusResponse extends BackgroundReadingJob {}

/**
 * Response from listing user's background jobs
 */
export interface UserBackgroundJobsResponse {
  jobs: BackgroundReadingJob[];
}

/**
 * Response from cancelling or resuming a job
 */
export interface BackgroundJobActionResponse {
  success: boolean;
  message: string;
}
