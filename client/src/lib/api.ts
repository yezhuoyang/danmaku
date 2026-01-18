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
