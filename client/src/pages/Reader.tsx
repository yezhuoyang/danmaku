import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MessageSquare, User, LogOut, Upload, Bot, Check, ChevronDown, Plus, Key, Zap, Ban, Loader2, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PdfAnnotationViewer } from "@/components/PdfAnnotationViewer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as api from "../lib/api";
import type { PaperWithStats, Annotation, FigureTableRegion, AiAgentHistory, AiSentenceAnalysisData, AiFigureTableAnalysisData, BackgroundReadingJob } from "../../../shared/types";
import type { SentenceAnnotation } from "@/components/annotations/types";
import { toast } from "sonner";
import { getCachedPdf, cachePdf, calculatePdfHash, verifyPdfHash } from "../lib/pdf-cache";

export default function Reader() {
  const [, params] = useRoute("/paper/:id/read");
  const paperId = params?.id;
  const [, setLocation] = useLocation();

  // Parse URL search params for navigation
  const searchParams = new URLSearchParams(window.location.search);
  const highlightType = searchParams.get('highlight') as 'figure' | 'table' | null;
  const initialPage = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
  const highlightRegionId = searchParams.get('regionId');

  const { user, logout, isLoading: authLoading } = useAuth();
  const [paper, setPaper] = useState<PaperWithStats | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [sentenceComments, setSentenceComments] = useState<Map<string, SentenceAnnotation[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // PDF source state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [localPdfFile, setLocalPdfFile] = useState<File | null>(null);
  const [isCheckingCache, setIsCheckingCache] = useState(false);
  const [hashMismatch, setHashMismatch] = useState(false);

  // Figure/Table regions state
  const [figureTableRegions, setFigureTableRegions] = useState<FigureTableRegion[]>([]);

  // AI Agent session state
  const [aiAgentHistories, setAiAgentHistories] = useState<AiAgentHistory[]>([]);
  const [activeSession, setActiveSession] = useState<AiAgentHistory | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Background reading job state
  const [backgroundJob, setBackgroundJob] = useState<BackgroundReadingJob | null>(null);

  useEffect(() => {
    if (!paperId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [paperResult, annotationsResult, regionsResult, historiesResult] = await Promise.all([
          api.getPaper(paperId),
          api.getPaperAnnotations(paperId),
          api.getFigureTableRegions(paperId),
          api.getAiAgentHistories(paperId),
        ]);
        setPaper(paperResult.paper);
        setFigureTableRegions(regionsResult.regions);

        // Store all histories and find the active session for the current user
        setAiAgentHistories(historiesResult.histories);
        const activeHistory = historiesResult.histories.find(h => h.isActive);
        setActiveSession(activeHistory || null);

        // Convert API annotations to the format PdfAnnotationViewer expects
        // Only include annotations that have proper highlightRegion (region-based annotations)
        // Comments without highlightRegion are stored but displayed differently
        const viewerAnnotations = annotationsResult.annotations
          .filter((a) => a.content.highlightRegion && a.content.position)
          .map((a) => ({
            id: a.id,
            text: a.content.text || "",
            latex: a.content.latex,
            color: a.content.color || "#6366f1",
            userId: a.userId,
            userName: a.userName,
            userAvatar: a.userAvatar,
            timestamp: new Date(a.createdAt * 1000), // Convert Unix timestamp to Date
            pageNumber: a.pageNumber,
            position: a.content.position || { x: 0, y: 0 },
            highlightRegion: a.content.highlightRegion ? {
              x: a.content.highlightRegion.x || 0,
              y: a.content.highlightRegion.y || 0,
              width: a.content.highlightRegion.width || 100,
              height: a.content.highlightRegion.height || 20,
              type: a.content.type || "text",
              label: a.content.label || "",
            } : undefined,
          }));
        setAnnotations(viewerAnnotations);

        // Extract sentence comments (annotations with sentenceId but no highlightRegion)
        const sentenceCommentsMap = new Map<string, SentenceAnnotation[]>();
        annotationsResult.annotations
          .filter((a) => a.sentenceId && !a.content.highlightRegion)
          .forEach((a) => {
            const sentenceId = a.sentenceId!;
            const comment: SentenceAnnotation = {
              id: a.id,
              sentenceId: sentenceId,
              text: a.content.text || "",
              userId: a.userId,
              userName: a.userName,
              userAvatar: a.userAvatar || undefined,
              timestamp: new Date(a.createdAt * 1000),
              color: a.content.color,
              replies: [], // Replies are loaded separately if needed
            };
            const existing = sentenceCommentsMap.get(sentenceId) || [];
            sentenceCommentsMap.set(sentenceId, [...existing, comment]);
          });
        setSentenceComments(sentenceCommentsMap);

        // Determine PDF URL
        if (paperResult.paper.arxivId) {
          // ArXiv paper - use arxivId as cache key (prefixed to avoid collision with local hashes)
          const arxivCacheKey = `arxiv:${paperResult.paper.arxivId}`;
          setIsCheckingCache(true);
          try {
            const cachedPdf = await getCachedPdf(arxivCacheKey);
            if (cachedPdf) {
              console.log('ArXiv PDF loaded from cache');
              const url = URL.createObjectURL(cachedPdf);
              setPdfUrl(url);
              toast.success('PDF loaded from local cache');
              setIsCheckingCache(false);
            } else {
              // Not cached - fetch from proxy and cache it
              setIsCheckingCache(false);
              const proxyUrl = `/api/papers/arxiv/${paperResult.paper.arxivId}/pdf`;
              setPdfUrl(proxyUrl);
              // Cache the ArXiv PDF in background after it loads
              fetch(proxyUrl)
                .then(res => res.blob())
                .then(async (blob) => {
                  await cachePdf(arxivCacheKey, blob, `${paperResult.paper.arxivId}.pdf`);
                  console.log('ArXiv PDF cached for offline access');
                })
                .catch(err => console.error('Failed to cache ArXiv PDF:', err));
            }
          } catch (error) {
            console.error('Error checking ArXiv PDF cache:', error);
            setIsCheckingCache(false);
            setPdfUrl(`/api/papers/arxiv/${paperResult.paper.arxivId}/pdf`);
          }
        } else if (paperResult.paper.contentHash) {
          // Local paper - check IndexedDB cache first
          setIsCheckingCache(true);
          try {
            const cachedPdf = await getCachedPdf(paperResult.paper.contentHash);
            if (cachedPdf) {
              // Found in cache - verify hash still matches
              const isValid = await verifyPdfHash(cachedPdf, paperResult.paper.contentHash);
              if (isValid) {
                console.log('PDF loaded from cache');
                const url = URL.createObjectURL(cachedPdf);
                setPdfUrl(url);
                toast.success('PDF loaded from local cache');
              } else {
                // Cache corrupted, need re-upload
                console.warn('Cached PDF hash mismatch, requiring re-upload');
                setShowPdfDialog(true);
              }
            } else {
              // Not in cache - show upload dialog
              setShowPdfDialog(true);
            }
          } catch (error) {
            console.error('Error checking PDF cache:', error);
            setShowPdfDialog(true);
          } finally {
            setIsCheckingCache(false);
          }
        } else {
          // Local paper without contentHash (legacy) - need user to provide the PDF
          setShowPdfDialog(true);
        }
      } catch (error) {
        console.error("Failed to fetch paper:", error);
        toast.error("Failed to load paper");
        setLocation("/browse");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [paperId, setLocation]);

  // Track reading session
  useEffect(() => {
    if (!paperId || !pdfUrl) return;

    const updateSession = async () => {
      try {
        await api.updateReadingSession(paperId, { lastPage: 1 });
      } catch (error) {
        console.error("Failed to update reading session:", error);
      }
    };

    updateSession();
  }, [paperId, pdfUrl]);

  // Fetch and poll background reading jobs
  useEffect(() => {
    if (!paperId || !user) return;

    const fetchBackgroundJob = async () => {
      try {
        const response = await api.getPaperBackgroundJobs(paperId);
        // Find the active job (running or pending)
        const activeJob = response.jobs.find(
          j => j.status === 'pending' || j.status === 'running'
        );
        setBackgroundJob(activeJob || null);
      } catch (error) {
        console.error("Failed to fetch background jobs:", error);
      }
    };

    fetchBackgroundJob();

    // Poll for updates if there's an active job
    const interval = setInterval(() => {
      if (backgroundJob?.status === 'pending' || backgroundJob?.status === 'running') {
        fetchBackgroundJob();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paperId, user, backgroundJob?.status]);

  const handleLocalPdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setHashMismatch(false);

      // If paper has a contentHash, verify the uploaded PDF matches
      if (paper?.contentHash) {
        try {
          const uploadedHash = await calculatePdfHash(file);
          if (uploadedHash !== paper.contentHash) {
            setHashMismatch(true);
            toast.error('This PDF does not match the original. Please upload the same PDF file.');
            return;
          }

          // Hash matches - cache the PDF for future use
          await cachePdf(paper.contentHash, file, file.name);
          toast.success('PDF verified and cached for offline access');
        } catch (error) {
          console.error('Error verifying/caching PDF:', error);
          // Continue anyway - caching is best-effort
        }
      }

      setLocalPdfFile(file);
      // Create a blob URL for the local file
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setShowPdfDialog(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Handle annotation added - save to API
  const handleAnnotationAdded = async (annotation: any) => {
    if (!paperId || !user) {
      toast.error("Please login to save annotations");
      return;
    }

    try {
      await api.addAnnotation(paperId, {
        pageNumber: annotation.pageNumber,
        sentenceId: annotation.highlightRegion?.label,
        content: {
          text: annotation.text || "",
          latex: annotation.latex,
          color: annotation.color,
          type: annotation.highlightRegion?.type || "text",
          label: annotation.highlightRegion?.label,
          position: annotation.position,
          highlightRegion: annotation.highlightRegion ? {
            x: annotation.highlightRegion.x,
            y: annotation.highlightRegion.y,
            width: annotation.highlightRegion.width,
            height: annotation.highlightRegion.height,
          } : undefined,
        },
      });
      toast.success("Annotation saved!");
    } catch (error) {
      console.error("Failed to save annotation:", error);
      toast.error("Failed to save annotation");
    }
  };

  // Handle annotation deleted - remove from API
  const handleAnnotationDeleted = async (annotationId: string) => {
    if (!paperId) {
      return;
    }

    try {
      await api.deleteAnnotation(paperId, annotationId);
      toast.success("Annotation deleted!");
    } catch (error) {
      console.error("Failed to delete annotation:", error);
      toast.error("Failed to delete annotation");
    }
  };

  // Handle comment added (sentence/figure/reply) - save to API
  const handleCommentAdded = async (comment: { id: string; type: 'sentence' | 'figure' | 'reply'; targetId: string; text: string; userName: string; pageNumber: number }) => {
    if (!paperId || !user) {
      toast.error("Please login to save comments");
      return;
    }

    try {
      await api.addAnnotation(paperId, {
        pageNumber: comment.pageNumber,
        sentenceId: comment.targetId,
        clientId: comment.id, // Pass client-generated ID to server
        content: {
          text: comment.text,
          color: "#6366f1", // Default indigo color for comments
          type: comment.type === 'figure' ? 'figure' : 'text',
          label: comment.targetId,
          position: { x: 0, y: 0 }, // Comments don't have specific positions
        },
      });
      toast.success("Comment saved!");
    } catch (error) {
      console.error("Failed to save comment:", error);
      toast.error("Failed to save comment");
    }
  };

  // Handle comment deleted (sentence/figure/reply) - remove from API
  const handleCommentDeleted = async (commentId: string) => {
    if (!paperId) {
      return;
    }

    try {
      await api.deleteAnnotation(paperId, commentId);
      toast.success("Comment deleted!");
    } catch (error) {
      console.error("Failed to delete comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Handle figure/table region created - save to API
  const handleRegionCreated = async (region: {
    pageNumber: number;
    type: 'figure' | 'table';
    label: string;
    caption?: string;
    boundingRect: { x: number; y: number; width: number; height: number };
    imageData?: string;
  }) => {
    if (!paperId || !user) {
      toast.error("Please login to create regions");
      return;
    }

    try {
      const result = await api.createFigureTableRegion(paperId, region);
      // Add the new region to state
      setFigureTableRegions(prev => [...prev, result.region]);
      toast.success("Region created!", { duration: 2000 });
    } catch (error) {
      console.error("Failed to create region:", error);
      toast.error("Failed to create region");
    }
  };

  // Handle figure/table region updated - save to API
  const handleRegionUpdated = async (
    regionId: string,
    updates: { label?: string; caption?: string; boundingRect?: { x: number; y: number; width: number; height: number } }
  ) => {
    if (!paperId || !user) {
      toast.error("Please login to update regions");
      return;
    }

    try {
      const result = await api.updateFigureTableRegion(paperId, regionId, updates);
      // Update the region in state
      setFigureTableRegions(prev =>
        prev.map(r => r.id === regionId ? result.region : r)
      );
      toast.success("Region updated!", { duration: 2000 });
    } catch (error) {
      console.error("Failed to update region:", error);
      toast.error("Failed to update region");
    }
  };

  // Handle figure/table region deleted - remove from API
  const handleRegionDeleted = async (regionId: string) => {
    if (!paperId || !user) {
      toast.error("Please login to delete regions");
      return;
    }

    try {
      await api.deleteFigureTableRegion(paperId, regionId);
      // Remove the region from state
      setFigureTableRegions(prev => prev.filter(r => r.id !== regionId));
      toast.success("Region deleted!", { duration: 2000 });
    } catch (error) {
      console.error("Failed to delete region:", error);
      toast.error("Failed to delete region");
    }
  };

  // Handle AI analysis results saved - update the active session
  const handleAiAnalysisSaved = async (
    sentenceAnalysis: Record<string, AiSentenceAnalysisData>,
    figureTableAnalysis: Record<string, AiFigureTableAnalysisData>
  ) => {
    if (!paperId || !user || !activeSession) {
      // No active session to save to - this is fine, just don't save
      console.log("No active session to save AI analysis to");
      return;
    }

    try {
      const result = await api.updateAiAgentHistory(paperId, activeSession.id, {
        sentenceAnalysis,
        figureTableAnalysis,
      });
      setActiveSession(result.history);
      toast.success("AI analysis saved to session!");
    } catch (error) {
      console.error("Failed to save AI analysis:", error);
      toast.error("Failed to save AI analysis to session");
    }
  };

  // Handle activating a different session
  const handleActivateSession = async (sessionId: string) => {
    if (!paperId || !user) {
      toast.error("Please login to switch sessions");
      return;
    }

    try {
      const result = await api.activateAiAgentHistory(paperId, sessionId);
      // Update the histories list with the new active state
      setAiAgentHistories(prev =>
        prev.map(h => ({
          ...h,
          isActive: h.id === sessionId
        }))
      );
      setActiveSession(result.history);
      toast.success(`Switched to session: ${result.history.title}`);
    } catch (error) {
      console.error("Failed to activate session:", error);
      toast.error("Failed to switch session");
    }
  };

  // Handle deactivating all sessions (reading without AI)
  const handleDeactivateAllSessions = async () => {
    if (!paperId) return;

    try {
      await api.deactivateAllSessions(paperId);
      // Update the histories list - mark all as inactive
      setAiAgentHistories(prev =>
        prev.map(h => ({
          ...h,
          isActive: false
        }))
      );
      setActiveSession(null);
      toast.success("AI session deactivated. Reading without AI.");
    } catch (error) {
      console.error("Failed to deactivate sessions:", error);
      toast.error("Failed to deactivate sessions");
    }
  };

  // Handle creating a new session
  const handleCreateSession = async () => {
    if (!paperId || !user) {
      toast.error("Please login to create a session");
      return;
    }

    setIsCreatingSession(true);
    try {
      const result = await api.createAiAgentHistory(paperId, {
        title: `Session ${aiAgentHistories.length + 1}`,
        model: "gpt-4o",
      });
      // Add the new session to the list and set it as active
      setAiAgentHistories(prev => [
        ...prev.map(h => ({ ...h, isActive: false })),
        result.history
      ]);
      setActiveSession(result.history);
      toast.success("New session created! Don't forget to set your API key.");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Calculate token usage percentage for the active session
  const getTokenUsage = (session: AiAgentHistory | null) => {
    if (!session) return { percentage: 0, total: 0, max: 128000 };
    const total = (session.totalPromptTokens ?? 0) + (session.totalCompletionTokens ?? 0);
    const max = session.maxContextTokens ?? 128000;
    const percentage = max > 0 ? (total / max) * 100 : 0;
    return { percentage, total, max };
  };

  // Check if current user is the paper uploader
  const isUploader = user?.id === paper?.addedBy;

  if (isLoading || isCheckingCache) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white/50 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">{isCheckingCache ? 'Checking local cache...' : 'Loading paper...'}</span>
        </div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Paper not found</h1>
          <Button asChild>
            <Link href="/browse">Back to Browse</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700" asChild>
              <Link href={`/paper/${paper.id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-600" />
            <div className="flex items-center gap-2 text-white">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                <MessageSquare className="w-3 h-3" />
              </div>
              <span className="text-sm font-medium truncate max-w-[300px]">
                {paper.title}
              </span>
            </div>
            {/* AI Session selector dropdown */}
            <div className="h-6 w-px bg-slate-600" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
                  activeSession
                    ? 'bg-emerald-900/50 border-emerald-700/50 hover:bg-emerald-900/70'
                    : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
                }`}>
                  <Bot className={`w-4 h-4 ${activeSession ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium truncate max-w-[120px] ${activeSession ? 'text-emerald-300' : 'text-slate-300'}`}>
                    {activeSession ? activeSession.title : 'No Session'}
                  </span>
                  {activeSession && (
                    <>
                      {/* Token usage indicator */}
                      {(() => {
                        const { percentage } = getTokenUsage(activeSession);
                        return (
                          <div className="flex items-center gap-1.5 ml-1">
                            <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-emerald-400/70">{percentage.toFixed(0)}%</span>
                          </div>
                        );
                      })()}
                      {activeSession.apiKeySet && (
                        <Key className="w-3 h-3 text-emerald-500" title="API key configured" />
                      )}
                      {activeSession.sentenceAnalysis && Object.keys(activeSession.sentenceAnalysis).length > 0 && (
                        <Check className="w-3 h-3 text-emerald-400" title="AI has analyzed this paper" />
                      )}
                    </>
                  )}
                  <ChevronDown className={`w-3 h-3 ${activeSession ? 'text-emerald-400' : 'text-slate-400'}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs text-slate-500">AI Sessions</DropdownMenuLabel>
                {aiAgentHistories.length > 0 ? (
                  <>
                    {aiAgentHistories.map((session) => {
                      const { percentage, total } = getTokenUsage(session);
                      const isActive = session.id === activeSession?.id;
                      return (
                        <DropdownMenuItem
                          key={session.id}
                          onClick={() => !isActive && handleActivateSession(session.id)}
                          className={`flex flex-col items-start gap-1 py-2 cursor-pointer ${isActive ? 'bg-emerald-900/20' : ''}`}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <Bot className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span className={`text-sm font-medium flex-1 truncate ${isActive ? 'text-emerald-300' : ''}`}>
                              {session.title}
                            </span>
                            {session.apiKeySet && (
                              <Key className="w-3 h-3 text-emerald-500" />
                            )}
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-600 text-white rounded">Active</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-full pl-6">
                            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  percentage > 90 ? 'bg-red-500' : percentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, percentage)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500">{total.toLocaleString()} tokens</span>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <div className="px-2 py-3 text-xs text-slate-500 text-center">
                    No sessions yet
                  </div>
                )}
                <DropdownMenuItem
                  onClick={() => !activeSession ? null : handleDeactivateAllSessions()}
                  className={`cursor-pointer ${!activeSession ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                >
                  <Ban className={`w-4 h-4 mr-2 ${!activeSession ? 'text-slate-600' : 'text-slate-400'}`} />
                  <span className={!activeSession ? 'text-slate-700 dark:text-slate-200' : ''}>No Session</span>
                  {!activeSession && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">Selected</span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleCreateSession}
                  disabled={isCreatingSession || !user}
                  className="cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span>{isCreatingSession ? 'Creating...' : 'Create New Session'}</span>
                </DropdownMenuItem>
                {!user && (
                  <div className="px-2 py-1 text-[10px] text-slate-500 text-center">
                    Login to create sessions
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Background Reading Progress Indicator */}
            {backgroundJob && (backgroundJob.status === 'pending' || backgroundJob.status === 'running') && (
              <>
                <div className="h-6 w-px bg-slate-600" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-900/50 border border-blue-700/50">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-blue-300">
                      Background Reading
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${backgroundJob.progress.percentComplete}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-blue-400/70">
                        {backgroundJob.progress.currentPage}/{backgroundJob.progress.totalPages} pages
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {authLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-white hover:bg-slate-700">
                  <User className="h-4 w-4" />
                  {user.displayName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* PDF Viewer */}
      <div className="flex-1">
        {pdfUrl ? (
          <PdfAnnotationViewer
            pdfUrl={pdfUrl}
            paperId={paperId}
            paperTitle={paper.title}
            initialAnnotations={annotations as any}
            initialSentenceComments={sentenceComments}
            onAnnotationAdded={handleAnnotationAdded}
            onAnnotationDeleted={handleAnnotationDeleted}
            onCommentAdded={handleCommentAdded}
            onCommentDeleted={handleCommentDeleted}
            currentUserName={user?.displayName}
            currentUserId={user?.id}
            figureTableRegions={figureTableRegions}
            isUploader={isUploader}
            onRegionCreated={handleRegionCreated}
            onRegionUpdated={handleRegionUpdated}
            onRegionDeleted={handleRegionDeleted}
            activeSession={activeSession}
            onAiAnalysisSaved={handleAiAnalysisSaved}
            onSessionUpdated={setActiveSession}
            backgroundJob={backgroundJob}
            initialPage={initialPage}
            highlightRegionId={highlightRegionId || undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <p className="mb-4">Please provide the PDF file to view this paper.</p>
              <Button onClick={() => setShowPdfDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Select PDF
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Selection Dialog for local papers */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select PDF File</DialogTitle>
            <DialogDescription>
              This paper was added from a local file. Please select the same PDF file
              to continue reading. The file will be cached locally for future visits.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF File</Label>
              <Input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleLocalPdfSelect}
              />
            </div>
            {hashMismatch && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  PDF does not match the original file
                </p>
                <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                  Please upload the exact same PDF that was originally used for this paper.
                  All annotations and AI analysis are tied to the original file.
                </p>
              </div>
            )}
            {paper.contentHash && (
              <p className="text-xs text-muted-foreground">
                Expected file hash: {paper.contentHash.substring(0, 16)}...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
