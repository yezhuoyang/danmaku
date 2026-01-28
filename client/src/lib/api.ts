/**
 * API Client for PaperPilot
 */

import type {
  User,
  Paper,
  PaperWithStats,
  Annotation,
  AiAnalysis,
  AiReview,
  RegisterRequest,
  LoginRequest,
  AddPaperRequest,
  PaperListResponse,
  AuthResponse,
  ApiError,
  FigureTableRegion,
  CreateFigureTableRegionRequest,
  UpdateFigureTableRegionRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  QuizQuestionResponse,
  SubmitQuizAnswerResponse,
  QuizResultsResponse,
  PaperAvatar,
  GeneratePaperAvatarRequest,
  GeneratePaperAvatarResponse,
  PaperVisibility,
  PaperCollaborator,
  PaperCollaboratorRole,
  PaperGroup,
  PaperGroupMember,
  PaperGroupWithPapers,
  GroupAiSession,
  CreatePaperGroupRequest,
  StartGroupReadingRequest,
} from '../../../shared/types';

const API_BASE = '/api';

// Helper for making API requests
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for auth
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || 'Request failed');
  }

  return data as T;
}

// ============================================================================
// AUTH API
// ============================================================================

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await request<AuthResponse>('/auth/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function getUserProfile(userId: string): Promise<User> {
  const data = await request<{ user: User }>(`/auth/profile/${userId}`);
  return data.user;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<User> {
  const response = await request<{ user: User }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.user;
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface AnnotationWithPaper extends Annotation {
  paperTitle: string;
  paperArxivId?: string;
}

export async function getMyAnnotations(): Promise<{ annotations: AnnotationWithPaper[] }> {
  return request<{ annotations: AnnotationWithPaper[] }>('/auth/annotations');
}

// Get only danmaku (annotations with highlightRegion)
export async function getMyDanmaku(): Promise<{ annotations: AnnotationWithPaper[] }> {
  return request<{ annotations: AnnotationWithPaper[] }>('/auth/danmaku');
}

// Get only comments (annotations without highlightRegion)
export async function getMyComments(): Promise<{ comments: AnnotationWithPaper[] }> {
  return request<{ comments: AnnotationWithPaper[] }>('/auth/comments');
}

export interface UserStats {
  annotationCount: number;
  papersRead: number;
  reviewsWritten: number;
  aiSessions: number;
}

export async function getUserStats(): Promise<{ stats: UserStats }> {
  return request<{ stats: UserStats }>('/auth/stats');
}

// User's reviews with paper info
export interface UserReviewWithPaper {
  id: string;
  paperId: string;
  paperTitle: string;
  paperArxivId?: string;
  userId: string;
  userName: string;
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
  createdAt: number;
  updatedAt: number;
}

export async function getMyReviews(): Promise<{ reviews: UserReviewWithPaper[] }> {
  return request<{ reviews: UserReviewWithPaper[] }>('/auth/reviews');
}

export async function deleteMyReview(reviewId: string): Promise<void> {
  await request(`/auth/reviews/${reviewId}`, { method: 'DELETE' });
}

// User's AI sessions with paper info
export interface AiSessionWithPaper {
  id: string;
  paperId: string;
  paperTitle: string;
  paperArxivId?: string;
  userId: string;
  userName: string;
  title: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  isPublic: boolean;
  isActive: boolean;
  modelUsed: string;
  createdAt: number;
  updatedAt: number;
  sentenceAnalysis?: Record<string, any>;
  figureTableAnalysis?: Record<string, any>;
  apiKeySet: boolean;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  maxContextTokens: number;
  conversationRounds: number;
}

export async function getMyAiSessions(): Promise<{ sessions: AiSessionWithPaper[] }> {
  return request<{ sessions: AiSessionWithPaper[] }>('/auth/ai-sessions');
}

export async function deleteMyAiSession(sessionId: string): Promise<void> {
  await request(`/auth/ai-sessions/${sessionId}`, { method: 'DELETE' });
}

// ============================================================================
// USER PROFILE WITH STATS
// ============================================================================

import type { UserWithStats, PaperCollection, UserSummary } from '../../../shared/types';

export async function getUserProfileWithStats(userId: string): Promise<UserWithStats> {
  const data = await request<{ user: UserWithStats }>(`/auth/profile/${userId}/full`);
  return data.user;
}

// ============================================================================
// PAPER COLLECTIONS
// ============================================================================

export async function getMyCollections(): Promise<{ collections: PaperCollection[] }> {
  return request<{ collections: PaperCollection[] }>('/auth/collections');
}

export async function getUserCollections(userId: string): Promise<{ collections: PaperCollection[] }> {
  return request<{ collections: PaperCollection[] }>(`/auth/collections/${userId}`);
}

export async function addToCollection(paperId: string, note?: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>('/auth/collections', {
    method: 'POST',
    body: JSON.stringify({ paperId, note }),
  });
}

export async function removeFromCollection(paperId: string): Promise<void> {
  await request(`/auth/collections/${paperId}`, { method: 'DELETE' });
}

export async function checkPaperCollected(paperId: string): Promise<boolean> {
  const data = await request<{ collected: boolean }>(`/auth/collections/check/${paperId}`);
  return data.collected;
}

// ============================================================================
// UPLOADED PAPERS
// ============================================================================

export async function getUserUploads(userId: string): Promise<{ papers: PaperWithStats[] }> {
  return request<{ papers: PaperWithStats[] }>(`/auth/uploads/${userId}`);
}

// ============================================================================
// USER FOLLOWING
// ============================================================================

export async function getFollowing(userId: string): Promise<{ users: UserSummary[] }> {
  return request<{ users: UserSummary[] }>(`/auth/following/${userId}`);
}

export async function getFollowers(userId: string): Promise<{ users: UserSummary[] }> {
  return request<{ users: UserSummary[] }>(`/auth/followers/${userId}`);
}

export async function checkFollowing(userId: string): Promise<boolean> {
  const result = await request<{ isFollowing: boolean }>(`/auth/follow/${userId}/check`);
  return result.isFollowing;
}

export async function followUser(userId: string): Promise<void> {
  await request(`/auth/follow/${userId}`, { method: 'POST' });
}

export async function unfollowUser(userId: string): Promise<void> {
  await request(`/auth/follow/${userId}`, { method: 'DELETE' });
}

// ============================================================================
// PAPERS API
// ============================================================================

export async function listPapers(options?: {
  q?: string;
  limit?: number;
  offset?: number;
  sort?: 'recent' | 'popular';
}): Promise<PaperListResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  if (options?.sort) params.set('sort', options.sort);

  const query = params.toString();
  return request<PaperListResponse>(`/papers${query ? `?${query}` : ''}`);
}

export async function getPaper(id: string): Promise<{ paper: PaperWithStats }> {
  return request<{ paper: PaperWithStats }>(`/papers/${id}`);
}

export async function addPaper(data: AddPaperRequest): Promise<{ paper: PaperWithStats }> {
  return request<{ paper: PaperWithStats }>('/papers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePaperTags(paperId: string, tags: string[]): Promise<{ success: boolean; tags: string[] }> {
  return request<{ success: boolean; tags: string[] }>(`/papers/${paperId}/tags`, {
    method: 'PATCH',
    body: JSON.stringify({ tags }),
  });
}

export async function getPaperAnnotations(paperId: string): Promise<{ annotations: Annotation[] }> {
  return request<{ annotations: Annotation[] }>(`/papers/${paperId}/annotations`);
}

export async function addAnnotation(
  paperId: string,
  data: { pageNumber: number; sentenceId?: string; clientId?: string; content: any }
): Promise<{ annotation: Annotation }> {
  return request<{ annotation: Annotation }>(`/papers/${paperId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAnnotation(
  paperId: string,
  annotationId: string
): Promise<void> {
  await request(`/papers/${paperId}/annotations/${annotationId}`, {
    method: 'DELETE',
  });
}

export async function updateAnnotation(
  paperId: string,
  annotationId: string,
  content: any
): Promise<{ annotation: Annotation }> {
  return request<{ annotation: Annotation }>(`/papers/${paperId}/annotations/${annotationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function getAiAnalysis(paperId: string): Promise<{ analysis: AiAnalysis | null }> {
  return request<{ analysis: AiAnalysis | null }>(`/papers/${paperId}/ai-analysis`);
}

export async function saveAiAnalysis(
  paperId: string,
  data: {
    summary?: string;
    sentenceLabels: Record<string, any>;
    figureLabels: Record<string, any>;
    noveltyCount: number;
  }
): Promise<void> {
  await request(`/papers/${paperId}/ai-analysis`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateReadingSession(
  paperId: string,
  data: { lastPage?: number; timeSpent?: number }
): Promise<void> {
  await request(`/papers/${paperId}/reading-session`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// ARXIV UTILITIES
// ============================================================================

export function extractArxivId(url: string): string | null {
  // Match various ArXiv URL formats
  const patterns = [
    /arxiv\.org\/abs\/(\d+\.\d+)/,
    /arxiv\.org\/pdf\/(\d+\.\d+)/,
    /arxiv\.org\/abs\/([a-z-]+\/\d+)/,
    /arxiv\.org\/pdf\/([a-z-]+\/\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Check if it's just an ID
  if (/^\d+\.\d+$/.test(url.trim())) {
    return url.trim();
  }

  return null;
}

export interface ArxivMetadata {
  title: string;
  authors: string[];
  abstract: string;
  pdfUrl: string;
}

export async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata> {
  // Use our backend proxy to avoid CORS issues
  return request<ArxivMetadata>(`/papers/arxiv/${arxivId}`);
}

// ============================================================================
// PDF HASHING
// ============================================================================

export async function hashPdfFile(file: File): Promise<string> {
  // Hash first 100KB of the file for identification
  const slice = file.slice(0, 100 * 1024);
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// FIGURE/TABLE REGIONS API
// ============================================================================

export async function getFigureTableRegions(
  paperId: string
): Promise<{ regions: FigureTableRegion[] }> {
  return request<{ regions: FigureTableRegion[] }>(`/papers/${paperId}/regions`);
}

export async function createFigureTableRegion(
  paperId: string,
  data: CreateFigureTableRegionRequest
): Promise<{ region: FigureTableRegion }> {
  return request<{ region: FigureTableRegion }>(`/papers/${paperId}/regions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFigureTableRegion(
  paperId: string,
  regionId: string,
  data: UpdateFigureTableRegionRequest
): Promise<{ region: FigureTableRegion }> {
  return request<{ region: FigureTableRegion }>(`/papers/${paperId}/regions/${regionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFigureTableRegion(
  paperId: string,
  regionId: string
): Promise<void> {
  await request(`/papers/${paperId}/regions/${regionId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// AI REVIEWS
// ============================================================================

export async function getAiReviews(
  paperId: string
): Promise<{ reviews: AiReview[] }> {
  return request<{ reviews: AiReview[] }>(`/papers/${paperId}/ai-reviews`);
}

export async function saveAiReview(
  paperId: string,
  review: Omit<AiReview, 'id' | 'paperId' | 'createdAt'>
): Promise<{ review: AiReview }> {
  return request<{ review: AiReview }>(`/papers/${paperId}/ai-reviews`, {
    method: 'POST',
    body: JSON.stringify(review),
  });
}

export async function deleteAiReview(
  paperId: string,
  reviewId: string
): Promise<void> {
  await request(`/papers/${paperId}/ai-reviews/${reviewId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// USER REVIEWS
// ============================================================================

import type {
  UserReview,
  CreateUserReviewRequest,
} from '../../../shared/types';

export async function getUserReviews(
  paperId: string
): Promise<{ reviews: UserReview[] }> {
  return request<{ reviews: UserReview[] }>(`/papers/${paperId}/user-reviews`);
}

export async function getMyUserReview(
  paperId: string
): Promise<{ review: UserReview | null }> {
  return request<{ review: UserReview | null }>(`/papers/${paperId}/user-reviews/my`);
}

export async function saveUserReview(
  paperId: string,
  review: CreateUserReviewRequest
): Promise<{ review: UserReview }> {
  return request<{ review: UserReview }>(`/papers/${paperId}/user-reviews`, {
    method: 'POST',
    body: JSON.stringify(review),
  });
}

export async function deleteUserReview(
  paperId: string,
  reviewId: string
): Promise<void> {
  await request(`/papers/${paperId}/user-reviews/${reviewId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// AI AGENT HISTORY
// ============================================================================

import type {
  AiAgentHistory,
  AiAgentMessage,
  CreateAiAgentHistoryRequest,
  UpdateAiAgentHistoryRequest,
} from '../../../shared/types';

export async function getAiAgentHistories(
  paperId: string
): Promise<{ histories: AiAgentHistory[] }> {
  return request<{ histories: AiAgentHistory[] }>(`/papers/${paperId}/agent-history`);
}

export async function getAiAgentHistory(
  paperId: string,
  historyId: string
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history/${historyId}`);
}

export async function createAiAgentHistory(
  paperId: string,
  data: CreateAiAgentHistoryRequest
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAiAgentHistory(
  paperId: string,
  historyId: string,
  data: UpdateAiAgentHistoryRequest
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history/${historyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAiAgentHistory(
  paperId: string,
  historyId: string
): Promise<void> {
  await request(`/papers/${paperId}/agent-history/${historyId}`, {
    method: 'DELETE',
  });
}

export async function activateAiAgentHistory(
  paperId: string,
  historyId: string
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history/${historyId}/activate`, {
    method: 'POST',
  });
}

export async function deactivateAllSessions(
  paperId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/papers/${paperId}/agent-history/deactivate-all`, {
    method: 'POST',
  });
}

// Generate AI review from a session's analysis data
export async function generateAiReviewFromSession(
  paperId: string,
  sessionId: string,
  customPrompt?: string
): Promise<{ review: AiReview }> {
  return request<{ review: AiReview }>(`/papers/${paperId}/agent-history/${sessionId}/generate-review`, {
    method: 'POST',
    body: JSON.stringify({ customPrompt }),
  });
}

// Set API key for a session (one-time only)
export async function setSessionApiKey(
  paperId: string,
  sessionId: string,
  apiKey: string
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history/${sessionId}/set-api-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

// Chat with the AI agent in a session
import type { AiChatResponse, NecessaryBackground } from '../../../shared/types';

export async function chatWithAgent(
  paperId: string,
  sessionId: string,
  message: string,
  context?: string
): Promise<AiChatResponse> {
  return request<AiChatResponse>(`/papers/${paperId}/agent-history/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  });
}

// Generate necessary background from a session's analysis
export async function generateNecessaryBackground(
  paperId: string,
  sessionId: string,
  customPrompt?: string
): Promise<{ background: NecessaryBackground }> {
  return request<{ background: NecessaryBackground }>(`/papers/${paperId}/agent-history/${sessionId}/generate-background`, {
    method: 'POST',
    body: JSON.stringify({ customPrompt }),
  });
}

// Get all necessary backgrounds for a paper
export async function getNecessaryBackgrounds(
  paperId: string
): Promise<{ backgrounds: NecessaryBackground[] }> {
  return request<{ backgrounds: NecessaryBackground[] }>(`/papers/${paperId}/backgrounds`);
}

// Delete a necessary background
export async function deleteBackground(
  paperId: string,
  backgroundId: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/papers/${paperId}/backgrounds/${backgroundId}`, {
    method: 'DELETE',
  });
}

// Analyze a page of the paper using the session's API key
export async function analyzePageWithSession(
  paperId: string,
  sessionId: string,
  data: {
    sentences: Array<{ id: string; text: string; section?: { fullTitle?: string; title?: string } }>;
    figureTables?: Array<{ id: string; type: string; label: string; caption?: string }>;
    pageNumber: number;
    totalPages: number;
  }
): Promise<{
  analysis: {
    sentences: Record<string, { label: string; comment?: string; flags?: Record<string, boolean> }>;
    figureTables: Record<string, { label: string; comment?: string; flags?: Record<string, boolean> }>;
  };
  usage: { promptTokens: number; completionTokens: number };
}> {
  return request(`/papers/${paperId}/agent-history/${sessionId}/analyze-page`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Mark reading as complete and save the analysis to the session
export async function completeReading(
  paperId: string,
  sessionId: string,
  data: {
    sentenceAnalysis: Record<string, any>;
    figureTableAnalysis: Record<string, any>;
  }
): Promise<{ history: AiAgentHistory }> {
  return request<{ history: AiAgentHistory }>(`/papers/${paperId}/agent-history/${sessionId}/complete-reading`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// READING WORKFLOW API
// ============================================================================

import type {
  ReadingWorkflowConfig,
  CreateReadingWorkflowRequest,
  UpdateReadingWorkflowRequest,
  ReadingWorkflowListResponse,
  StartReadingRequest,
  AiParagraphAnalysisData,
  AiSectionAnalysisData,
} from '@shared/types';

// Get all reading workflows (user's own + public)
export async function getReadingWorkflows(): Promise<ReadingWorkflowListResponse> {
  return request<ReadingWorkflowListResponse>('/papers/reading-workflows');
}

// Create a new reading workflow
export async function createReadingWorkflow(
  data: CreateReadingWorkflowRequest
): Promise<{ workflow: ReadingWorkflowConfig }> {
  return request<{ workflow: ReadingWorkflowConfig }>('/papers/reading-workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update a reading workflow
export async function updateReadingWorkflow(
  workflowId: string,
  data: UpdateReadingWorkflowRequest
): Promise<{ workflow: ReadingWorkflowConfig }> {
  return request<{ workflow: ReadingWorkflowConfig }>(`/papers/reading-workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete a reading workflow
export async function deleteReadingWorkflow(workflowId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/papers/reading-workflows/${workflowId}`, {
    method: 'DELETE',
  });
}

// Start reading with a specific workflow
export async function startReading(
  paperId: string,
  sessionId: string,
  data: StartReadingRequest
): Promise<{
  success: boolean;
  workflowConfig?: ReadingWorkflowConfig;
  readingProgress?: {
    startedAt: number;
    startPage: number;
    endPage?: number;
    currentPage: number;
    questions: string[];
    status: string;
  };
}> {
  return request(`/papers/${paperId}/agent-history/${sessionId}/start-reading`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Analyze a paragraph
export async function analyzeParagraph(
  paperId: string,
  sessionId: string,
  data: {
    paragraphId: string;
    sentenceIds?: string[];
    content: string;
    context?: string;
    pageNumber: number;
    workflowConfig?: ReadingWorkflowConfig;
  }
): Promise<{
  analysis: AiParagraphAnalysisData;
  usage: { promptTokens: number; completionTokens: number };
}> {
  return request(`/papers/${paperId}/agent-history/${sessionId}/analyze-paragraph`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Analyze a section
export async function analyzeSection(
  paperId: string,
  sessionId: string,
  data: {
    sectionId: string;
    sectionTitle?: string;
    paragraphIds?: string[];
    content: string;
    pageRange?: { start: number; end: number };
    workflowConfig?: ReadingWorkflowConfig;
  }
): Promise<{
  analysis: AiSectionAnalysisData;
  usage: { promptTokens: number; completionTokens: number };
}> {
  return request(`/papers/${paperId}/agent-history/${sessionId}/analyze-section`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Generate reflection (for rethink mode)
export async function generateReflection(
  paperId: string,
  sessionId: string,
  data: {
    level: 'sentence' | 'paragraph' | 'section';
    analysisContext: any;
    reflectionPrompt?: string;
    workflowConfig?: ReadingWorkflowConfig;
  }
): Promise<{
  reflection: string;
  level: string;
  usage: { promptTokens: number; completionTokens: number };
}> {
  return request(`/papers/${paperId}/agent-history/${sessionId}/reflect`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ Site Statistics ============

export interface SiteStats {
  userCount: number;
  paperCount: number;
  annotationCount: number;
  commentCount: number;
  aiReviewCount: number;
  humanReviewCount: number;
  discussionCount: number;
}

export interface RecentDanmaku {
  id: string;
  paperId: string;
  paperTitle: string;
  pageNumber: number;
  content: {
    text: string;
    type: string;
    color: string;
    label?: string;
  };
  createdAt: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
}

export async function getSiteStats(): Promise<SiteStats> {
  return request<SiteStats>('/papers/stats/site');
}

export async function getRecentDanmaku(): Promise<{ danmaku: RecentDanmaku[] }> {
  return request<{ danmaku: RecentDanmaku[] }>('/papers/recent/danmaku');
}

// ============================================================================
// ADMIN API
// ============================================================================

export interface AdminStats {
  userCount: number;
  paperCount: number;
  annotationCount: number;
  aiSessionCount: number;
  aiReviewCount: number;
  userReviewCount: number;
}

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  isAdmin: boolean;
  createdAt: number;
  annotationCount: number;
  paperCount: number;
  sessionCount: number;
}

export interface AdminPaper {
  id: string;
  title: string;
  arxivId?: string;
  authors: string[];
  viewCount: number;
  createdAt: number;
  addedBy?: {
    id: string;
    username: string;
    displayName: string;
  };
  annotationCount: number;
  readerCount: number;
  sessionCount: number;
  aiReviewCount: number;
  userReviewCount: number;
}

export interface AdminAnnotation {
  id: string;
  paperId: string;
  paperTitle: string;
  userId: string;
  userName: string;
  username: string;
  pageNumber: number;
  sentenceId?: string;
  content: any;
  isDanmaku: boolean;
  createdAt: number;
}

export interface AdminAiSession {
  id: string;
  paperId: string;
  paperTitle: string;
  userId: string;
  userName: string;
  username: string;
  title: string;
  messageCount: number;
  isPublic: boolean;
  isActive: boolean;
  modelUsed: string;
  hasApiKey: boolean;
  hasSentenceAnalysis: boolean;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  conversationRounds: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAiReview {
  id: string;
  paperId: string;
  paperTitle: string;
  generatedBy: string;
  generatedAt: number;
  createdAt: number;
}

export interface AdminUserReview {
  id: string;
  paperId: string;
  paperTitle: string;
  userId: string;
  userName: string;
  username: string;
  createdAt: number;
  updatedAt: number;
}

// Get admin dashboard stats
export async function getAdminStats(): Promise<{ stats: AdminStats }> {
  return request<{ stats: AdminStats }>('/admin/stats');
}

// List all users (admin only)
export async function adminListUsers(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ users: AdminUser[]; total: number }>(`/admin/users${query ? `?${query}` : ''}`);
}

// Toggle user admin status
export async function adminSetUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await request(`/admin/users/${userId}/admin`, {
    method: 'PUT',
    body: JSON.stringify({ isAdmin }),
  });
}

// Delete a user (admin only)
export async function adminDeleteUser(userId: string): Promise<void> {
  await request(`/admin/users/${userId}`, { method: 'DELETE' });
}

// List all papers (admin only)
export async function adminListPapers(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ papers: AdminPaper[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ papers: AdminPaper[]; total: number }>(`/admin/papers${query ? `?${query}` : ''}`);
}

// Delete a paper (admin only)
export async function adminDeletePaper(paperId: string): Promise<void> {
  await request(`/admin/papers/${paperId}`, { method: 'DELETE' });
}

// List all annotations (admin only)
export async function adminListAnnotations(options?: {
  search?: string;
  paperId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ annotations: AdminAnnotation[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ annotations: AdminAnnotation[]; total: number }>(`/admin/annotations${query ? `?${query}` : ''}`);
}

// Delete an annotation (admin only)
export async function adminDeleteAnnotation(annotationId: string): Promise<void> {
  await request(`/admin/annotations/${annotationId}`, { method: 'DELETE' });
}

// List all AI sessions (admin only)
export async function adminListAiSessions(options?: {
  search?: string;
  paperId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ sessions: AdminAiSession[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ sessions: AdminAiSession[]; total: number }>(`/admin/ai-sessions${query ? `?${query}` : ''}`);
}

// Delete an AI session (admin only)
export async function adminDeleteAiSession(sessionId: string): Promise<void> {
  await request(`/admin/ai-sessions/${sessionId}`, { method: 'DELETE' });
}

// List all AI reviews (admin only)
export async function adminListAiReviews(options?: {
  paperId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ reviews: AdminAiReview[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ reviews: AdminAiReview[]; total: number }>(`/admin/ai-reviews${query ? `?${query}` : ''}`);
}

// Delete an AI review (admin only)
export async function adminDeleteAiReview(reviewId: string): Promise<void> {
  await request(`/admin/ai-reviews/${reviewId}`, { method: 'DELETE' });
}

// List all user reviews (admin only)
export async function adminListUserReviews(options?: {
  paperId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ reviews: AdminUserReview[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ reviews: AdminUserReview[]; total: number }>(`/admin/user-reviews${query ? `?${query}` : ''}`);
}

// Delete a user review (admin only)
export async function adminDeleteUserReview(reviewId: string): Promise<void> {
  await request(`/admin/user-reviews/${reviewId}`, { method: 'DELETE' });
}

// ============================================================================
// LIKE/DISLIKE API
// ============================================================================

import type { LikeTargetType, LikeStatus, LikeResponse } from '../../../shared/types';

// Like or dislike a target (toggle behavior)
export async function likeTarget(
  targetType: LikeTargetType,
  targetId: string,
  isLike: boolean
): Promise<LikeResponse> {
  return request<LikeResponse>('/papers/likes', {
    method: 'POST',
    body: JSON.stringify({ targetType, targetId, isLike }),
  });
}

// Remove like/dislike from a target
export async function removeLike(
  targetType: LikeTargetType,
  targetId: string
): Promise<LikeResponse> {
  return request<LikeResponse>('/papers/likes', {
    method: 'DELETE',
    body: JSON.stringify({ targetType, targetId }),
  });
}

// Get like status for a single target
export async function getLikeStatus(
  targetType: LikeTargetType,
  targetId: string
): Promise<LikeStatus> {
  return request<LikeStatus>(`/papers/likes/${targetType}/${targetId}`);
}

// Get like status for multiple targets at once
export async function getBatchLikeStatus(
  targets: Array<{ targetType: LikeTargetType; targetId: string }>
): Promise<{ results: Record<string, LikeStatus> }> {
  return request<{ results: Record<string, LikeStatus> }>('/papers/likes/batch', {
    method: 'POST',
    body: JSON.stringify({ targets }),
  });
}

// ============================================================================
// AI MODEL ARENA / RANKINGS API
// ============================================================================

import type { AiModelRanking, ModelRankingResponse, AiModelInfo, TopContributor, TopContributorsResponse } from '../../../shared/types';

// Get AI model rankings
export async function getModelRankings(options?: {
  limit?: number;
  offset?: number;
}): Promise<ModelRankingResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<ModelRankingResponse>(`/papers/model-rankings${query ? `?${query}` : ''}`);
}

// Model detail response type
export interface ModelDetailResponse {
  modelId: string;
  modelName: string;
  provider: string;
  description?: string;
  contextWindow?: number;
  likeCount: number;
  dislikeCount: number;
  score: number;
  sessionCount: number;
  recentSessions: Array<{
    id: string;
    paperId: string;
    title: string;
    paperTitle: string;
    userName: string;
    createdAt: number;
  }>;
}

// Get details for a specific AI model
export async function getModelDetails(modelId: string): Promise<ModelDetailResponse> {
  return request<ModelDetailResponse>(`/papers/model-rankings/${modelId}`);
}

// Get list of available AI models
export async function getAvailableModels(): Promise<{ models: AiModelInfo[] }> {
  return request<{ models: AiModelInfo[] }>('/papers/available-models');
}

// ============================================================================
// TOP CONTRIBUTORS API
// ============================================================================

// Get top contributors ranked by contribution score
export async function getTopContributors(options?: {
  limit?: number;
  offset?: number;
}): Promise<TopContributorsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<TopContributorsResponse>(`/papers/top-contributors${query ? `?${query}` : ''}`);
}

// ============================================================================
// QUIZ / TEST MY UNDERSTANDING API
// ============================================================================

// Quiz session summary for list display
export interface QuizSessionSummary {
  id: string;
  historyId: string;
  sessionTitle: string;
  currentQuestionNumber: number;
  isComplete: boolean;
  finalScore: number | null;
  createdAt: number;
  completedAt: number | null;
}

// Start a new quiz session
export async function startQuiz(
  paperId: string,
  historyId: string
): Promise<QuizQuestionResponse> {
  return request<QuizQuestionResponse>(`/papers/${paperId}/quiz/start`, {
    method: 'POST',
    body: JSON.stringify({ historyId }),
  });
}

// Submit an answer and get the next question
export async function submitQuizAnswer(
  paperId: string,
  sessionId: string,
  questionId: string,
  answer: 'A' | 'B' | 'C' | 'D'
): Promise<SubmitQuizAnswerResponse> {
  return request<SubmitQuizAnswerResponse>(`/papers/${paperId}/quiz/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ questionId, answer }),
  });
}

// Get final quiz results
export async function getQuizResults(
  paperId: string,
  sessionId: string
): Promise<QuizResultsResponse> {
  return request<QuizResultsResponse>(`/papers/${paperId}/quiz/${sessionId}/results`);
}

// Get user's quiz sessions for a paper
export async function getQuizSessions(
  paperId: string
): Promise<{ sessions: QuizSessionSummary[] }> {
  return request<{ sessions: QuizSessionSummary[] }>(`/papers/${paperId}/quiz/sessions`);
}

// ============================================================================
// OPEN QUESTIONS & RESEARCH IDEAS API
// ============================================================================

import type {
  OpenQuestion,
  ResearchIdea,
  GenerateOpenQuestionsResponse,
  GenerateResearchIdeasResponse,
} from '../../../shared/types';

// Generate open questions from the paper
export async function generateOpenQuestions(
  paperId: string,
  historyId: string,
  customPrompt?: string
): Promise<GenerateOpenQuestionsResponse> {
  return request<GenerateOpenQuestionsResponse>(`/papers/${paperId}/insights/open-questions`, {
    method: 'POST',
    body: JSON.stringify({ historyId, customPrompt }),
  });
}

// Generate research ideas from the paper
export async function generateResearchIdeas(
  paperId: string,
  historyId: string,
  customPrompt?: string
): Promise<GenerateResearchIdeasResponse> {
  return request<GenerateResearchIdeasResponse>(`/papers/${paperId}/insights/research-ideas`, {
    method: 'POST',
    body: JSON.stringify({ historyId, customPrompt }),
  });
}

// Get cached insights for a session
export async function getInsights(
  paperId: string,
  historyId: string
): Promise<{ openQuestions?: OpenQuestion[]; researchIdeas?: ResearchIdea[] }> {
  return request<{ openQuestions?: OpenQuestion[]; researchIdeas?: ResearchIdea[] }>(
    `/papers/${paperId}/insights/${historyId}`
  );
}

// Get all public insights for a paper (from public sessions)
import type { PublicInsightsResponse } from '../../../shared/types';

export async function getPublicInsights(
  paperId: string
): Promise<PublicInsightsResponse> {
  return request<PublicInsightsResponse>(
    `/papers/${paperId}/insights/public`
  );
}

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

import type { Notification, NotificationListResponse } from '../../../shared/types';

// Get notifications for the current user
export async function getNotifications(options?: {
  limit?: number;
  offset?: number;
}): Promise<NotificationListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<NotificationListResponse>(`/auth/notifications${query ? `?${query}` : ''}`);
}

// Get unread notification count
export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return request<{ count: number }>('/auth/notifications/unread-count');
}

// Mark notifications as read
export async function markNotificationsRead(notificationIds?: string[]): Promise<void> {
  await request('/auth/notifications/mark-read', {
    method: 'POST',
    body: JSON.stringify({ notificationIds }),
  });
}

// Delete a single notification
export async function deleteNotification(notificationId: string): Promise<void> {
  await request(`/auth/notifications/${notificationId}`, { method: 'DELETE' });
}

// Clear all notifications
export async function clearAllNotifications(): Promise<void> {
  await request('/auth/notifications', { method: 'DELETE' });
}

// ============================================================================
// CHALLENGE PROBLEMS API
// ============================================================================

import type {
  ChallengeProblem,
  ChallengeComment,
  ChallengeIdeaLink,
  ChallengeProblemsResponse,
  ChallengeProblemDetailResponse,
  CreateChallengeProblemRequest,
  UpdateChallengeProblemRequest,
  LinkIdeaToQuestionRequest,
  CreateChallengeCommentRequest,
  ChallengeProblemType,
  ChallengeProblemStatus,
  IdeaLinkRelationship,
  ChallengeProblemLink,
  PromotionSuggestion,
  ChallengeCurationJob,
  PromoteIdeaRequest,
  TriggerCurationRequest,
  CreateChallengeProblemLinkRequest,
  SuggestedParent,
} from '../../../shared/types';

// Re-export types that are used by pages
export type { SuggestedParent };

// List/search challenge problems
export async function getChallengeProblems(options?: {
  q?: string;
  type?: ChallengeProblemType;
  status?: ChallengeProblemStatus;
  area?: string;
  paperId?: string;
  userId?: string;
  rootOnly?: boolean;
  parentId?: string;
  sort?: 'recent' | 'popular' | 'discussed' | 'tree_progress';
  limit?: number;
  offset?: number;
}): Promise<ChallengeProblemsResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.type) params.set('type', options.type);
  if (options?.status) params.set('status', options.status);
  if (options?.area) params.set('area', options.area);
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.rootOnly !== undefined) params.set('rootOnly', String(options.rootOnly));
  if (options?.parentId) params.set('parentId', options.parentId);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<ChallengeProblemsResponse>(`/challenges${query ? `?${query}` : ''}`);
}

// Get a single challenge problem with full details
export async function getChallengeProblem(id: string): Promise<ChallengeProblemDetailResponse> {
  return request<ChallengeProblemDetailResponse>(`/challenges/${id}`);
}

// Create a new challenge problem
export async function createChallengeProblem(
  data: CreateChallengeProblemRequest
): Promise<{ problem: ChallengeProblem }> {
  return request<{ problem: ChallengeProblem }>('/challenges', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update a challenge problem
export async function updateChallengeProblem(
  id: string,
  data: UpdateChallengeProblemRequest
): Promise<{ problem: ChallengeProblem }> {
  return request<{ problem: ChallengeProblem }>(`/challenges/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete a challenge problem
export async function deleteChallengeProblem(id: string): Promise<void> {
  await request(`/challenges/${id}`, { method: 'DELETE' });
}

// Vote on a challenge problem
export async function voteChallengeProb(
  id: string,
  isLike: boolean
): Promise<{ upvotes: number; downvotes: number }> {
  return request<{ upvotes: number; downvotes: number }>(`/challenges/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ isLike }),
  });
}

// Get progress tree for a challenge
export async function getChallengeTree(id: string): Promise<{ tree: ChallengeProblem[] }> {
  return request<{ tree: ChallengeProblem[] }>(`/challenges/${id}/tree`);
}

// Link a research idea to a question
export async function linkIdeaToQuestion(
  questionId: string,
  data: LinkIdeaToQuestionRequest
): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/challenges/${questionId}/ideas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get linked ideas for a question
export async function getLinkedIdeas(
  questionId: string
): Promise<{ links: ChallengeIdeaLink[] }> {
  return request<{ links: ChallengeIdeaLink[] }>(`/challenges/${questionId}/ideas`);
}

// Remove an idea link
export async function removeIdeaLink(questionId: string, linkId: string): Promise<void> {
  await request(`/challenges/${questionId}/ideas/${linkId}`, { method: 'DELETE' });
}

// Get questions that an idea addresses
export async function getQuestionsForIdea(
  ideaId: string
): Promise<{ links: ChallengeIdeaLink[] }> {
  return request<{ links: ChallengeIdeaLink[] }>(`/challenges/${ideaId}/questions`);
}

// Add a comment to a challenge
export async function addChallengeComment(
  problemId: string,
  data: CreateChallengeCommentRequest
): Promise<{ comment: ChallengeComment }> {
  return request<{ comment: ChallengeComment }>(`/challenges/${problemId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get comments for a challenge
export async function getChallengeComments(
  problemId: string
): Promise<{ comments: ChallengeComment[] }> {
  return request<{ comments: ChallengeComment[] }>(`/challenges/${problemId}/comments`);
}

// Delete a challenge comment
export async function deleteChallengeComment(commentId: string): Promise<void> {
  await request(`/challenges/comments/${commentId}`, { method: 'DELETE' });
}

// Get distinct research areas
export async function getChallengeAreas(): Promise<{ areas: string[] }> {
  return request<{ areas: string[] }>('/challenges/areas');
}

// ============================================================================
// CHALLENGE PROMOTION & CURATION API
// ============================================================================

// Get AI suggestions for promoting research ideas to challenges
export async function getPromotionSuggestions(options?: {
  paperId?: string;
  historyId?: string;
  limit?: number;
}): Promise<{ suggestions: PromotionSuggestion[]; existingProblemsCount: number }> {
  const params = new URLSearchParams();
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.historyId) params.set('historyId', options.historyId);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return request<{ suggestions: PromotionSuggestion[]; existingProblemsCount: number }>(
    `/challenges/suggest-promotions${query ? `?${query}` : ''}`
  );
}

// Promote a research idea to a challenge problem
export async function promoteIdeaToChallenge(
  data: PromoteIdeaRequest
): Promise<{ problem: ChallengeProblem }> {
  return request<{ problem: ChallengeProblem }>('/challenges/promote', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Suggest parent problems for a new challenge using AI
export async function suggestParentProblem(data: {
  title: string;
  description: string;
  apiKey: string;
  provider?: 'openai' | 'anthropic';
  customPrompt?: string;
  candidateIds?: string[];
}): Promise<{ suggestions: SuggestedParent[] }> {
  return request<{ suggestions: SuggestedParent[] }>('/challenges/suggest-parent', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get cross-paper links for a challenge problem
export async function getChallengeProblemLinks(
  problemId: string
): Promise<{ links: ChallengeProblemLink[] }> {
  return request<{ links: ChallengeProblemLink[] }>(`/challenges/${problemId}/links`);
}

// Create a cross-paper link between challenge problems
export async function createChallengeProblemLink(
  sourceId: string,
  data: CreateChallengeProblemLinkRequest
): Promise<{ link: ChallengeProblemLink }> {
  return request<{ link: ChallengeProblemLink }>(`/challenges/${sourceId}/links`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Delete a cross-paper link
export async function deleteChallengeProblemLink(linkId: string): Promise<void> {
  await request(`/challenges/links/${linkId}`, { method: 'DELETE' });
}

// Trigger an AI curation job
export async function triggerCurationJob(
  data: TriggerCurationRequest
): Promise<{ job: ChallengeCurationJob }> {
  return request<{ job: ChallengeCurationJob }>('/challenges/curate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get curation job status
export async function getCurationJob(jobId: string): Promise<{ job: ChallengeCurationJob }> {
  return request<{ job: ChallengeCurationJob }>(`/challenges/curate/${jobId}`);
}

// List user's curation jobs
export async function getCurationJobs(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ jobs: ChallengeCurationJob[] }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ jobs: ChallengeCurationJob[] }>(`/challenges/curate${query ? `?${query}` : ''}`);
}

// ============================================================================
// AI DEBATE API
// ============================================================================

import type {
  DebateSession,
  DebateMessage,
  CreateDebateRequest,
  UpdateDebateConfigRequest,
  DebateSpeaker,
} from '../../../shared/types';

// List user's debate sessions
export async function getDebates(): Promise<DebateSession[]> {
  const response = await request<{ debates: DebateSession[]; total: number }>('/debates');
  return response.debates;
}

// Get a single debate session
export async function getDebate(id: string): Promise<DebateSession> {
  return request<DebateSession>(`/debates/${id}`);
}

// Create a new debate session
export async function createDebate(data: CreateDebateRequest): Promise<DebateSession> {
  return request<DebateSession>('/debates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Delete a debate session
export async function deleteDebate(id: string): Promise<void> {
  await request(`/debates/${id}`, { method: 'DELETE' });
}

// Update debate config (setup phase only)
export async function updateDebateConfig(
  id: string,
  data: UpdateDebateConfigRequest
): Promise<DebateSession> {
  return request<DebateSession>(`/debates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Set API key for a debate agent
export async function setDebateApiKey(
  id: string,
  agent: 'affirmative' | 'negative' | 'judge',
  apiKey: string
): Promise<DebateSession> {
  return request<DebateSession>(`/debates/${id}/set-api-key`, {
    method: 'POST',
    body: JSON.stringify({ agent, apiKey }),
  });
}

// Start the debate
export async function startDebate(id: string): Promise<{ session: DebateSession; message?: DebateMessage }> {
  return request<{ session: DebateSession; message?: DebateMessage }>(`/debates/${id}/start`, {
    method: 'POST',
  });
}

// Continue to next turn
export async function continueDebate(id: string): Promise<{ session: DebateSession; message: DebateMessage }> {
  return request<{ session: DebateSession; message: DebateMessage }>(`/debates/${id}/continue`, {
    method: 'POST',
  });
}

// Pause the debate
export async function pauseDebate(id: string): Promise<DebateSession> {
  return request<DebateSession>(`/debates/${id}/pause`, {
    method: 'POST',
  });
}

// Resume the debate
export async function resumeDebate(id: string): Promise<DebateSession> {
  return request<DebateSession>(`/debates/${id}/resume`, {
    method: 'POST',
  });
}

// User intervention
export async function interveneDebate(
  id: string,
  message: string,
  targetAgent?: DebateSpeaker
): Promise<DebateSession> {
  const response = await request<{ session: DebateSession; message: DebateMessage }>(`/debates/${id}/intervene`, {
    method: 'POST',
    body: JSON.stringify({ message, targetAgent }),
  });
  return response.session;
}

// Force conclusion
export async function concludeDebate(id: string): Promise<{ session: DebateSession; conclusion: string }> {
  return request<{ session: DebateSession; conclusion: string }>(`/debates/${id}/conclude`, {
    method: 'POST',
  });
}

// ============================================================================
// AI PAPER DISCOVERY API
// ============================================================================

// Discovered paper from Semantic Scholar
export interface DiscoveredPaper {
  semanticScholarId: string;
  arxivId: string | null;
  doi: string | null;
  title: string;
  authors: string[];
  abstract: string | null;
  year: number | null;
  citationCount: number;
  url: string | null;
  venue: string | null;
  isOpenAccess: boolean;
  pdfUrl: string | null;
}

// Search for papers using Semantic Scholar
export async function discoverPapers(options: {
  q: string;
  limit?: number;
  offset?: number;
  year?: string;
}): Promise<{ papers: DiscoveredPaper[]; total: number; offset: number; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set('q', options.q);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.year) params.set('year', options.year);
  return request<{ papers: DiscoveredPaper[]; total: number; offset: number; hasMore: boolean }>(
    `/papers/discover/search?${params.toString()}`
  );
}

// Get papers related to a paper in our database
export async function getRelatedPapers(
  paperId: string,
  type?: 'recommendations' | 'citations' | 'references',
  limit?: number
): Promise<{ papers: DiscoveredPaper[]; semanticScholarId?: string; type: string }> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (limit) params.set('limit', String(limit));
  const query = params.toString();
  return request<{ papers: DiscoveredPaper[]; semanticScholarId?: string; type: string }>(
    `/papers/discover/related/${paperId}${query ? `?${query}` : ''}`
  );
}

// Get trending papers on a topic
export async function getTrendingPapers(options?: {
  topic?: string;
  limit?: number;
}): Promise<{ papers: DiscoveredPaper[]; topic: string }> {
  const params = new URLSearchParams();
  if (options?.topic) params.set('topic', options.topic);
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return request<{ papers: DiscoveredPaper[]; topic: string }>(
    `/papers/discover/trending${query ? `?${query}` : ''}`
  );
}

// Batch add discovered papers
export async function batchAddPapers(
  papers: Array<{ arxivId?: string; title: string; authors: string[]; abstract?: string }>
): Promise<{
  results: Array<{ paper: PaperWithStats; isNew: boolean } | { error: string; title: string }>;
  summary: { added: number; existing: number; errors: number };
}> {
  return request<{
    results: Array<{ paper: PaperWithStats; isNew: boolean } | { error: string; title: string }>;
    summary: { added: number; existing: number; errors: number };
  }>('/papers/discover/batch-add', {
    method: 'POST',
    body: JSON.stringify({ papers }),
  });
}

// AI-curated paper result
export interface AICuratedPaper {
  paper: DiscoveredPaper;
  relevanceScore: number;
  reasoning: string;
  matchedAspects: string[];
}

// AI-powered paper search response
export interface AISearchResponse {
  papers: AICuratedPaper[];
  analysis: string;
  keyAspects: string[];
  searchQueries: Array<{ query: string; rationale: string }>;
  tokensUsed?: number;
  papersAnalyzed?: number;
  message?: string;
}

// AI-powered paper search
export async function aiPaperSearch(options: {
  researchIdea: string;
  apiKey: string;
  modelId?: string;
  maxPapers?: number;
}): Promise<AISearchResponse> {
  return request<AISearchResponse>('/papers/discover/ai-search', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// ============================================================================
// UNIFIED SEARCH API
// ============================================================================

// Unified search result item for papers
export interface UnifiedPaperResult {
  id: string;
  type: 'paper';
  arxivId?: string;
  title: string;
  authors: string[];
  abstract?: string;
  viewCount: number;
  tags: string[];
  createdAt: number;
  readerCount: number;
  annotationCount: number;
  hasAiAnalysis: boolean;
  aiReviewCount: number;
  aiReviewAvgScore?: number;
  // Uploader info
  uploaderName?: string;
  uploaderUsername?: string;
  uploaderAvatar?: string;
}

// Unified search result item for debates
export interface UnifiedDebateResult {
  id: string;
  type: 'debate';
  title: string;
  topic: string;
  status: 'setup' | 'active' | 'paused' | 'concluded';
  userName: string;
  userAvatar?: string;
  turnCount: number;
  maxTurns: number;
  winner?: 'affirmative' | 'negative' | 'draw';
  conclusion?: string;
  totalTokens: number;
  createdAt: number;
  updatedAt: number;
}

// Unified search result item for challenges
export interface UnifiedChallengeResult {
  id: string;
  type: 'challenge';
  problemType: 'open_question' | 'research_idea';
  status: 'unsolved' | 'investigating' | 'solved';
  title: string;
  description?: string;
  paperId?: string;
  paperTitle?: string;
  userName: string;
  userAvatar?: string;
  importance?: 'high' | 'medium' | 'low';
  area?: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  commentCount: number;
  childCount: number;
  createdAt: number;
}

// Unified search result item for paper groups
export interface UnifiedPaperGroupResult {
  id: string;
  type: 'paperGroup';
  name: string;
  description?: string;
  visibility: 'private' | 'public';
  userId: string;
  userName: string;
  userAvatar?: string;
  paperCount: number;
  createdAt: number;
  updatedAt: number;
}

// Unified search result item for insights (open questions & research ideas)
export interface UnifiedInsightResult {
  id: string;
  type: 'open_question' | 'research_idea';
  sessionId: string;
  paperId?: string;
  paperTitle?: string;
  arxivId?: string;
  title: string;
  description?: string;
  importance?: 'high' | 'medium' | 'low';
  methodology?: string;
  expectedOutcome?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'breakthrough' | 'moderate' | 'incremental';
  relatedTopics?: string[];
  userId: string;
  userName: string;
  userAvatar?: string;
  modelUsed: string;
  updatedAt: number;
}

// Unified search response
export interface UnifiedSearchResponse {
  papers: {
    items: UnifiedPaperResult[];
    total: number;
  };
  debates: {
    items: UnifiedDebateResult[];
    total: number;
  };
  challenges: {
    items: UnifiedChallengeResult[];
    total: number;
  };
  paperGroups: {
    items: UnifiedPaperGroupResult[];
    total: number;
  };
  insights: {
    items: UnifiedInsightResult[];
    total: number;
  };
}

// Unified search across papers, debates, challenge problems, paper groups, and insights
export async function unifiedSearch(options: {
  q?: string;
  types?: ('papers' | 'debates' | 'challenges' | 'paperGroups' | 'insights')[];
  limit?: number;
  sort?: 'recent' | 'popular' | 'discussed';
}): Promise<UnifiedSearchResponse> {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.types) params.set('types', options.types.join(','));
  if (options.limit) params.set('limit', String(options.limit));
  if (options.sort) params.set('sort', options.sort);
  const query = params.toString();
  return request<UnifiedSearchResponse>(`/papers/unified-search${query ? `?${query}` : ''}`);
}

// ============================================================================
// CATEGORY API
// ============================================================================

import type { Category, CategoryWithChildren } from '../../../shared/types';

// Get category tree (hierarchical)
export async function getCategoryTree(): Promise<{ categories: CategoryWithChildren[] }> {
  return request<{ categories: CategoryWithChildren[] }>('/categories');
}

// Get flat list of categories
export async function getCategoriesFlat(): Promise<{ categories: Category[] }> {
  return request<{ categories: Category[] }>('/categories/flat');
}

// Get a single category
export async function getCategory(id: string): Promise<{ category: Category }> {
  return request<{ category: Category }>(`/categories/${id}`);
}

// Create a new category (admin only)
export async function createCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  icon?: string;
  color?: string;
}): Promise<{ category: Category }> {
  return request<{ category: Category }>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Update a category (admin only)
export async function updateCategory(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    parentId?: string;
    icon?: string;
    color?: string;
    orderIndex?: number;
  }
): Promise<{ category: Category }> {
  return request<{ category: Category }>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Delete a category (admin only)
export async function deleteCategory(id: string): Promise<void> {
  await request(`/categories/${id}`, { method: 'DELETE' });
}

// Reorder categories (admin only)
export async function reorderCategories(
  orders: Array<{ id: string; orderIndex: number }>
): Promise<void> {
  await request('/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ orders }),
  });
}

// Get papers in a category
export async function getCategoryPapers(
  categoryId: string,
  options?: {
    includeSubcategories?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{
  papers: PaperWithStats[];
  total: number;
  category: Category;
}> {
  const params = new URLSearchParams();
  if (options?.includeSubcategories) params.set('includeSubcategories', 'true');
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<{ papers: PaperWithStats[]; total: number; category: Category }>(
    `/categories/${categoryId}/papers${query ? `?${query}` : ''}`
  );
}

// Add paper to categories (uploader or admin)
export async function addPaperToCategories(
  paperId: string,
  categoryIds: string[]
): Promise<{ success: boolean; categories: Category[] }> {
  return request<{ success: boolean; categories: Category[] }>(
    `/categories/papers/${paperId}/categories`,
    {
      method: 'POST',
      body: JSON.stringify({ categoryIds }),
    }
  );
}

// Remove paper from a category (uploader or admin)
export async function removePaperFromCategory(
  paperId: string,
  categoryId: string
): Promise<void> {
  await request(`/categories/papers/${paperId}/categories/${categoryId}`, {
    method: 'DELETE',
  });
}

// Get categories for a paper
export async function getPaperCategories(paperId: string): Promise<{
  categories: Category[];
}> {
  return request<{ categories: Category[] }>(`/categories/papers/${paperId}/categories`);
}

// ============================================================================
// AI AUTO-CATEGORIZATION
// ============================================================================

export interface AICategorySuggestion {
  id: string;
  name: string;
  path: string;
}

export interface AISuggestResponse {
  paperId: string;
  paperTitle: string;
  suggestions: AICategorySuggestion[];
  reasoning: string;
  tokensUsed: number;
}

export interface BulkSuggestResult {
  paperId: string;
  paperTitle: string;
  suggestions: AICategorySuggestion[];
  reasoning?: string;
  status: 'success' | 'parse_error' | 'api_error' | 'error';
}

export interface BulkSuggestResponse {
  results: BulkSuggestResult[];
  totalTokens: number;
  processed: number;
  total: number;
}

// Get AI suggestions for a single paper
export async function getAICategorySuggestions(
  paperId: string,
  apiKey: string,
  model?: string
): Promise<AISuggestResponse> {
  return request<AISuggestResponse>('/categories/ai/suggest', {
    method: 'POST',
    body: JSON.stringify({ paperId, apiKey, model }),
  });
}

// Apply AI-suggested categories to a paper
export async function applyAICategories(
  paperId: string,
  categoryIds: string[]
): Promise<{ success: boolean; paperId: string; categories: Category[] }> {
  return request<{ success: boolean; paperId: string; categories: Category[] }>(
    '/categories/ai/apply',
    {
      method: 'POST',
      body: JSON.stringify({ paperId, categoryIds }),
    }
  );
}

// Get AI suggestions for multiple papers
export async function getBulkAICategorySuggestions(
  paperIds: string[],
  apiKey: string,
  model?: string
): Promise<BulkSuggestResponse> {
  return request<BulkSuggestResponse>('/categories/ai/bulk-suggest', {
    method: 'POST',
    body: JSON.stringify({ paperIds, apiKey, model }),
  });
}

// Apply categories to multiple papers at once
export async function applyBulkAICategories(
  assignments: Array<{ paperId: string; categoryIds: string[] }>
): Promise<{ success: boolean; applied: number; total: number }> {
  return request<{ success: boolean; applied: number; total: number }>(
    '/categories/ai/bulk-apply',
    {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    }
  );
}

// ============================================================================
// FEEDBACK / BUG REPORTS / FEATURE REQUESTS API
// ============================================================================

export type FeedbackType = 'bug' | 'feature';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackSort = 'newest' | 'oldest' | 'most_upvoted' | 'priority';

export interface FeedbackRequest {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  images: string[];
  status: FeedbackStatus;
  priority: FeedbackPriority;
  submitterId?: string;
  submitterName: string;
  submitterEmail?: string;
  upvotes: number;
  hasUpvoted: boolean;
  adminResponse?: string;
  resolvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackListResponse {
  feedback: FeedbackRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FeedbackStats {
  total: number;
  bugs: number;
  features: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
}

// List all feedback requests (public)
export async function listFeedback(options?: {
  type?: FeedbackType;
  status?: FeedbackStatus;
  sort?: FeedbackSort;
  page?: number;
  limit?: number;
}): Promise<FeedbackListResponse> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.status) params.set('status', options.status);
  if (options?.sort) params.set('sort', options.sort);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return request<FeedbackListResponse>(`/feedback${query ? `?${query}` : ''}`);
}

// Get a single feedback request (public)
export async function getFeedback(id: string): Promise<FeedbackRequest> {
  return request<FeedbackRequest>(`/feedback/${id}`);
}

// Submit new feedback (public - works for both logged-in and anonymous users)
// Note: Uses direct backend URL in dev mode to bypass Vite proxy body size limits
export async function submitFeedback(data: {
  type: FeedbackType;
  title: string;
  description: string;
  images?: string[];
  submitterName?: string;
  submitterEmail?: string;
}): Promise<FeedbackRequest> {
  // Debug logging
  console.log('[API DEBUG] submitFeedback called with data:', {
    ...data,
    images: data.images ? `Array of ${data.images.length} images` : 'undefined',
    imageDetails: data.images?.map((img, i) => ({
      index: i,
      type: typeof img,
      length: typeof img === 'string' ? img.length : 'N/A',
      startsWithDataImage: typeof img === 'string' ? img.substring(0, 30) : 'N/A',
    })),
  });

  const body = JSON.stringify(data);
  console.log('[API DEBUG] JSON body length:', body.length, 'bytes');

  // In development, call backend directly to avoid Vite proxy body size limits
  // In production, use relative URL
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev ? 'http://localhost:3001/api' : '/api';

  const response = await fetch(`${baseUrl}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Failed to submit feedback');
  }

  return result as FeedbackRequest;
}

// Toggle upvote on feedback (requires auth)
export async function toggleFeedbackUpvote(id: string): Promise<{ upvoted: boolean; upvotes: number }> {
  return request<{ upvoted: boolean; upvotes: number }>(`/feedback/${id}/upvote`, {
    method: 'POST',
  });
}

// Update feedback (admin only)
export async function updateFeedback(
  id: string,
  data: {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    adminResponse?: string;
  }
): Promise<FeedbackRequest> {
  return request<FeedbackRequest>(`/feedback/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Delete feedback (admin only)
export async function deleteFeedback(id: string): Promise<void> {
  await request(`/feedback/${id}`, { method: 'DELETE' });
}

// Get feedback stats (admin only)
export async function getFeedbackStats(): Promise<FeedbackStats> {
  return request<FeedbackStats>('/feedback/admin/stats');
}

// ============================================================================
// PAPER AVATAR API
// ============================================================================

// Generate a new paper avatar using AI
export async function generatePaperAvatar(
  paperId: string,
  options: GeneratePaperAvatarRequest
): Promise<GeneratePaperAvatarResponse> {
  return request<GeneratePaperAvatarResponse>(`/papers/${paperId}/avatar/generate`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// Get all avatars for a paper
export async function getPaperAvatars(paperId: string): Promise<{ avatars: PaperAvatar[] }> {
  return request<{ avatars: PaperAvatar[] }>(`/papers/${paperId}/avatars`);
}

// Activate a specific avatar (set as the displayed avatar)
export async function activatePaperAvatar(paperId: string, avatarId: string): Promise<void> {
  await request(`/papers/${paperId}/avatar/${avatarId}/activate`, { method: 'PUT' });
}

// Delete an avatar
export async function deletePaperAvatar(paperId: string, avatarId: string): Promise<void> {
  await request(`/papers/${paperId}/avatar/${avatarId}`, { method: 'DELETE' });
}

// ============================================================================
// PAPER PRIVACY & COLLABORATION API
// ============================================================================

// Update paper visibility (public/private)
export async function updatePaperVisibility(
  paperId: string,
  visibility: PaperVisibility
): Promise<{ success: boolean; visibility: PaperVisibility }> {
  return request(`/papers/${paperId}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  });
}

// Get paper collaborators
export async function getPaperCollaborators(paperId: string): Promise<{ collaborators: PaperCollaborator[] }> {
  return request(`/papers/${paperId}/collaborators`);
}

// Add a collaborator to a paper
export async function addPaperCollaborator(
  paperId: string,
  username: string,
  role: PaperCollaboratorRole = 'viewer'
): Promise<{ collaborator: PaperCollaborator }> {
  return request(`/papers/${paperId}/collaborators`, {
    method: 'POST',
    body: JSON.stringify({ username, role }),
  });
}

// Update collaborator role
export async function updatePaperCollaboratorRole(
  paperId: string,
  collaboratorId: string,
  role: PaperCollaboratorRole
): Promise<{ success: boolean; role: PaperCollaboratorRole }> {
  return request(`/papers/${paperId}/collaborators/${collaboratorId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

// Remove a collaborator
export async function removePaperCollaborator(paperId: string, collaboratorId: string): Promise<{ success: boolean }> {
  return request(`/papers/${paperId}/collaborators/${collaboratorId}`, {
    method: 'DELETE',
  });
}

// Fork a paper (create a private copy)
export async function forkPaper(
  paperId: string,
  visibility: PaperVisibility = 'private'
): Promise<{ paper: PaperWithStats }> {
  return request(`/papers/${paperId}/fork`, {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
}

// Get forks of a paper
export async function getPaperForks(paperId: string): Promise<{
  forks: Array<{
    id: string;
    title: string;
    visibility: PaperVisibility;
    uploaderName?: string;
    uploaderUsername?: string;
    createdAt: number;
  }>;
}> {
  return request(`/papers/${paperId}/forks`);
}

// Search users by username or display name
export async function searchUsers(query: string, limit: number = 10): Promise<{
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  }>;
}> {
  return request(`/auth/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

// ============================================================================
// PAPER GROUP APIs
// ============================================================================

// Get all paper groups (user's own + public)
export async function getPaperGroups(search?: string): Promise<{ groups: PaperGroup[] }> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  return request(`/paper-groups${params}`);
}

// Create a new paper group
export async function createPaperGroup(data: CreatePaperGroupRequest): Promise<{ group: PaperGroup }> {
  return request('/paper-groups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get a specific paper group with papers
export async function getPaperGroup(groupId: string): Promise<{ group: PaperGroupWithPapers }> {
  return request(`/paper-groups/${groupId}`);
}

// Update a paper group
export async function updatePaperGroup(
  groupId: string,
  data: Partial<CreatePaperGroupRequest>
): Promise<{ group: PaperGroup }> {
  return request(`/paper-groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Delete a paper group
export async function deletePaperGroup(groupId: string): Promise<void> {
  return request(`/paper-groups/${groupId}`, {
    method: 'DELETE',
  });
}

// Add papers to a group
export async function addPapersToGroup(
  groupId: string,
  paperIds: string[]
): Promise<{ members: PaperGroupMember[] }> {
  return request(`/paper-groups/${groupId}/papers`, {
    method: 'POST',
    body: JSON.stringify({ paperIds }),
  });
}

// Remove a paper from a group
export async function removePaperFromGroup(groupId: string, paperId: string): Promise<void> {
  return request(`/paper-groups/${groupId}/papers/${paperId}`, {
    method: 'DELETE',
  });
}

// Reorder papers in a group
export async function reorderGroupPapers(groupId: string, paperIds: string[]): Promise<void> {
  return request(`/paper-groups/${groupId}/papers/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ paperIds }),
  });
}

// ============================================================================
// GROUP AI SESSION APIs
// ============================================================================

// Create a new AI session for a paper group
export async function createGroupAiSession(
  groupId: string,
  data: StartGroupReadingRequest
): Promise<{ session: GroupAiSession }> {
  return request(`/paper-groups/${groupId}/ai-session`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get AI sessions for a paper group
export async function getGroupAiSessions(groupId: string): Promise<{ sessions: GroupAiSession[] }> {
  return request(`/paper-groups/${groupId}/ai-sessions`);
}

// Get a specific AI session
export async function getGroupAiSession(
  groupId: string,
  sessionId: string
): Promise<{ session: GroupAiSession }> {
  return request(`/paper-groups/${groupId}/ai-session/${sessionId}`);
}

// Set API key for a group AI session
export async function setGroupSessionApiKey(
  groupId: string,
  sessionId: string,
  apiKey: string
): Promise<void> {
  return request(`/paper-groups/${groupId}/ai-session/${sessionId}/set-api-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

// Start reading all papers in a group
export async function startGroupReading(
  groupId: string,
  sessionId: string
): Promise<{ session: GroupAiSession }> {
  return request(`/paper-groups/${groupId}/ai-session/${sessionId}/read-papers`, {
    method: 'POST',
  });
}

// Chat with AI about papers in a group
export async function chatWithGroupSession(
  groupId: string,
  sessionId: string,
  message: string
): Promise<{ response: string; session: GroupAiSession }> {
  return request(`/paper-groups/${groupId}/ai-session/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// Update token limit for a group AI session
export async function updateGroupSessionTokenLimit(
  groupId: string,
  sessionId: string,
  tokenLimit: number
): Promise<{ session: GroupAiSession }> {
  return request(`/paper-groups/${groupId}/ai-session/${sessionId}/token-limit`, {
    method: 'PUT',
    body: JSON.stringify({ tokenLimit }),
  });
}

// ==================== Debate Paper Reading ====================

// Start debate paper reading (agents read papers before debating)
export async function startDebatePaperReading(
  debateId: string
): Promise<{ debate: DebateSession }> {
  return request(`/debates/${debateId}/read-papers`, {
    method: 'POST',
  });
}

// Get debate reading progress
export async function getDebateReadingProgress(
  debateId: string
): Promise<{
  status: string;
  papersRead: number;
  totalPapers: number;
  progress: number;
}> {
  return request(`/debates/${debateId}/reading-progress`);
}

// ==================== Background Reading ====================

import type {
  BackgroundReadingJob,
  StartBackgroundReadingResponse,
  BackgroundJobStatusResponse,
  UserBackgroundJobsResponse,
  BackgroundJobActionResponse,
} from '../../../shared/types';

// Start a background reading job for a paper
export async function startBackgroundReading(
  paperId: string,
  sessionId: string,
  workflowConfig?: any
): Promise<StartBackgroundReadingResponse> {
  return request('/background-reading/start', {
    method: 'POST',
    body: JSON.stringify({ paperId, sessionId, workflowConfig }),
  });
}

// Get status of a background reading job
export async function getBackgroundJobStatus(
  jobId: string
): Promise<BackgroundJobStatusResponse> {
  return request(`/background-reading/status/${jobId}`);
}

// List user's background reading jobs
export async function getUserBackgroundJobs(
  options?: { status?: string; limit?: number }
): Promise<UserBackgroundJobsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  const queryString = params.toString();
  return request(`/background-reading/user-jobs${queryString ? `?${queryString}` : ''}`);
}

// Get background jobs for a specific paper
export async function getPaperBackgroundJobs(
  paperId: string
): Promise<UserBackgroundJobsResponse> {
  return request(`/background-reading/paper/${paperId}`);
}

// Cancel a background reading job
export async function cancelBackgroundJob(
  jobId: string
): Promise<BackgroundJobActionResponse> {
  return request(`/background-reading/cancel/${jobId}`, {
    method: 'POST',
  });
}

// Resume a paused or failed background reading job
export async function resumeBackgroundJob(
  jobId: string
): Promise<BackgroundJobActionResponse> {
  return request(`/background-reading/resume/${jobId}`, {
    method: 'POST',
  });
}

// ============================================================================
// INSIGHTS API - Open Questions & Research Ideas from AI Sessions
// ============================================================================

// Open Question with context from AI session
export interface OpenQuestionWithContext {
  id: string;
  question: string;
  context: string;
  importance: 'high' | 'medium' | 'low';
  relatedTopics: string[];
  sessionId: string;
  paperId?: string;
  paperTitle?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: number;
}

// Research Idea with context from AI session
export interface ResearchIdeaWithContext {
  id: string;
  title: string;
  description: string;
  methodology: string;
  expectedOutcome: string;
  feasibility: 'high' | 'medium' | 'low';
  novelty: 'incremental' | 'moderate' | 'breakthrough';
  prerequisites: string[];
  sessionId: string;
  paperId?: string;
  paperTitle?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: number;
}

// Response for listing open questions
export interface OpenQuestionsResponse {
  questions: OpenQuestionWithContext[];
  total: number;
}

// Response for listing research ideas
export interface ResearchIdeasResponse {
  ideas: ResearchIdeaWithContext[];
  total: number;
}

// Insights stats response
export interface InsightsStatsResponse {
  // Total individual counts
  totalOpenQuestions: number;
  totalResearchIdeas: number;
  // Session counts (backwards compatibility)
  openQuestionSessions: number;
  researchIdeaSessions: number;
  papersWithInsights: number;
  totalChallengeProblems: number;
  promotedIdeas: number;
}

// AI Reorganization suggestion
export interface ReorganizeSuggestions {
  promotions?: Array<{
    insightIndex: number;
    suggestedTitle?: string;
    suggestedParentId?: string | null;
    reasoning: string;
    confidence: number;
    insight?: {
      sessionId: string;
      ideaId: string;
      paperTitle?: string;
      type: 'open_question' | 'research_idea';
      title: string;
      description: string;
    };
  }>;
  newBranches?: Array<{
    title: string;
    description: string;
    reasoning: string;
  }>;
  duplicates?: Array<{
    insightIndex: number;
    existingProblemId: string;
    reasoning: string;
  }>;
  relationships?: Array<{
    sourceInsightIndex: number;
    targetProblemId: string;
    relationship: string;
    reasoning: string;
  }>;
  summary?: string;
  error?: string;
  raw?: string;
}

// Response for reorganization
export interface ReorganizeResponse {
  suggestions: ReorganizeSuggestions;
  insightsAnalyzed: number;
  existingProblemsCount: number;
}

// Get all open questions from AI sessions
export async function getOpenQuestions(options?: {
  q?: string;
  paperId?: string;
  userId?: string;
  importance?: 'high' | 'medium' | 'low';
  publicOnly?: boolean;
  sort?: 'recent' | 'oldest' | 'importance';
  limit?: number;
  offset?: number;
}): Promise<OpenQuestionsResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.importance) params.set('importance', options.importance);
  if (options?.publicOnly !== undefined) params.set('publicOnly', String(options.publicOnly));
  if (options?.sort) params.set('sort', options.sort);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const queryString = params.toString();
  return request(`/insights/open-questions${queryString ? `?${queryString}` : ''}`);
}

// Get all research ideas from AI sessions
export async function getResearchIdeas(options?: {
  q?: string;
  paperId?: string;
  userId?: string;
  feasibility?: 'high' | 'medium' | 'low';
  novelty?: 'incremental' | 'moderate' | 'breakthrough';
  publicOnly?: boolean;
  sort?: 'recent' | 'oldest' | 'novelty' | 'feasibility';
  limit?: number;
  offset?: number;
}): Promise<ResearchIdeasResponse> {
  const params = new URLSearchParams();
  if (options?.q) params.set('q', options.q);
  if (options?.paperId) params.set('paperId', options.paperId);
  if (options?.userId) params.set('userId', options.userId);
  if (options?.feasibility) params.set('feasibility', options.feasibility);
  if (options?.novelty) params.set('novelty', options.novelty);
  if (options?.publicOnly !== undefined) params.set('publicOnly', String(options.publicOnly));
  if (options?.sort) params.set('sort', options.sort);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  const queryString = params.toString();
  return request(`/insights/research-ideas${queryString ? `?${queryString}` : ''}`);
}

// Get insights stats
export async function getInsightsStats(): Promise<InsightsStatsResponse> {
  return request('/insights/stats');
}

// AI reorganization of research git tree
export async function reorganizeInsights(data: {
  apiKey: string;
  provider?: 'openai' | 'anthropic';
  scope?: 'all' | 'new';
}): Promise<ReorganizeResponse> {
  return request<ReorganizeResponse>('/insights/reorganize', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Paper search result from AI
export interface PaperSearchResult {
  title: string;
  authors: string;
  year: number;
  source: string;
  arxivId?: string;
  url?: string;
  relevance: string;
  relevanceScore: number;
  existsOnPlatform?: boolean;
  platformPaperId?: string;
}

export interface PaperSearchResponse {
  papers: PaperSearchResult[];
  searchSummary?: string;
  question: string;
  error?: string;
  promptUsed?: string;
  apiSources?: string[];
  totalFound?: number;
}

// AI search for related papers (uses Semantic Scholar and arXiv APIs, then AI ranks results)
export async function searchRelatedPapers(data: {
  question: string;
  context?: string;
  apiKey: string;
  provider?: 'openai' | 'anthropic';
  customPrompt?: string;
}): Promise<PaperSearchResponse> {
  return request<PaperSearchResponse>('/insights/search-papers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
