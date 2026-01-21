import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  MessageSquare,
  User,
  LogOut,
  Users,
  Sparkles,
  BookOpen,
  ExternalLink,
  MessageCircle,
  Layers,
  Gauge,
  Play,
  Pause,
  Bookmark,
  BookmarkCheck,
  UserPlus,
  UserMinus,
  Trophy,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Bot,
  Star,
  Brain,
  Book,
  History,
  Send,
  AlertCircle,
  Key,
  Loader2,
  Lightbulb,
  Tag,
  X,
  Plus,
  Pencil,
  HelpCircle,
  FlaskConical,
  Target,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LikeButtons } from "@/components/ui/LikeButtons";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AIReviewPanel } from "@/components/AIReviewPanel";
import { AIAgentHistoryPanel } from "@/components/AIAgentHistoryPanel";
import { NecessaryBackgroundPanel } from "@/components/NecessaryBackgroundPanel";
import { QuizSection, OpenQuestionsSection, ResearchIdeasSection } from "@/components/insights";
import { UserReviewPanel } from "@/components/UserReviewPanel";
import * as api from "../lib/api";
import type { PaperWithStats, Annotation, AiAnalysis, AiReview, AiAgentHistory, NecessaryBackground, UserReview, TopContributor, AiModelRanking } from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Speed options for danmaku flow
const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
  { label: '5x', value: 5 },
  { label: '7x', value: 7 },
];

// Danmaku User Popover for flowing danmaku items
interface DanmakuUserPopoverProps {
  userId?: string;
  userName: string;
  userAvatar?: string;
  annotationColor: string;
  currentUserId?: string;
}

function DanmakuUserPopover({ userId, userName, userAvatar, annotationColor, currentUserId }: DanmakuUserPopoverProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);

  // Load follow status when popover opens
  useEffect(() => {
    if (open && currentUserId && userId && !followStatusLoaded) {
      api.checkFollowing(userId)
        .then(setIsFollowing)
        .catch(console.error)
        .finally(() => setFollowStatusLoaded(true));
    }
  }, [open, currentUserId, userId, followStatusLoaded]);

  const isOwnProfile = currentUserId === userId;

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to follow users');
      return;
    }
    if (!userId) return;

    setIsLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${userName}`);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        toast.success(`Following ${userName}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  // If no userId, just show the name without popover
  if (!userId) {
    return <span className="text-xs text-white/60">{userName}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: annotationColor }}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              userName.charAt(0).toUpperCase()
            )}
          </span>
          <span className="text-xs text-white/60 hover:text-white/80 transition-colors">
            {userName}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: annotationColor }}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold">
                {userName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{userName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/profile/${userId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(false)}>
              <User className="w-3 h-3 mr-1" />
              Profile
            </Button>
          </Link>
          {!isOwnProfile && currentUserId && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={handleFollow}
              disabled={isLoading}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-3 h-3 mr-1" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Flowing Danmaku component
function FlowingDanmaku({ annotations, currentUserId }: { annotations: Annotation[]; currentUserId?: string }) {
  // Get initial speed from localStorage or default to 1
  const [speed, setSpeed] = useState(() => {
    const saved = localStorage.getItem('danmaku-speed');
    return saved ? parseFloat(saved) : 1;
  });
  const [isPaused, setIsPaused] = useState(false);

  // Filter only actual annotations (with highlightRegion)
  const danmakuAnnotations = useMemo(() =>
    annotations.filter(a => a.content.highlightRegion),
    [annotations]
  );

  // Save speed preference to localStorage
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    localStorage.setItem('danmaku-speed', String(newSpeed));
  };

  if (danmakuAnnotations.length === 0) {
    return (
      <div className="relative h-24 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl overflow-hidden mb-8 flex items-center justify-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm">No annotations yet. Be the first to add one!</p>
      </div>
    );
  }

  // Duplicate annotations for seamless loop
  const duplicatedAnnotations = [...danmakuAnnotations, ...danmakuAnnotations];

  // Calculate base duration based on annotation count, then adjust by speed
  const baseDuration = Math.max(20, danmakuAnnotations.length * 5);
  const adjustedDuration = baseDuration / speed;

  return (
    <div className="relative h-32 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden mb-8">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(99,102,241,0.2),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(168,85,247,0.2),transparent_50%)]" />
      </div>

      {/* Flowing track */}
      <div className="absolute inset-0 flex items-center">
        <div
          className="flex gap-8 danmaku-flow-track"
          style={{
            animationDuration: `${adjustedDuration}s`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedAnnotations.map((annotation, index) => (
            <div
              key={`${annotation.id}-${index}`}
              className="flex-shrink-0 max-w-xs px-4 py-2 rounded-lg shadow-lg border-l-4"
              style={{
                backgroundColor: `${annotation.content.color}15`,
                borderLeftColor: annotation.content.color,
              }}
            >
              <p className="text-sm text-white/90 line-clamp-2 font-medium">
                {annotation.content.text || (annotation.content.latex ? 'LaTeX equation' : 'Annotation')}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <DanmakuUserPopover
                  userId={annotation.userId}
                  userName={annotation.userName}
                  userAvatar={annotation.userAvatar}
                  annotationColor={annotation.content.color}
                  currentUserId={currentUserId}
                />
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-white/10 text-white/70 border-0">
                  {annotation.content.type}
                </Badge>
                <LikeButtons
                  targetType="annotation"
                  targetId={annotation.id}
                  currentUserId={currentUserId}
                  size="sm"
                  className="[&_button]:text-white/50 [&_button:hover]:text-white/80"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gradient overlays for fade effect */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-900 to-transparent pointer-events-none z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none z-10" />

      {/* Title badge */}
      <div className="absolute top-2 left-3 z-20">
        <Badge variant="secondary" className="bg-white/10 text-white/80 border-0 text-xs">
          <Layers className="w-3 h-3 mr-1" />
          Live Danmaku
        </Badge>
      </div>

      {/* Speed control */}
      <div className="absolute top-2 right-3 z-20 flex items-center gap-2">
        {/* Play/Pause button */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
          title={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1 bg-white/10 rounded-md px-2 py-1">
          <Gauge className="w-3 h-3 text-white/60" />
          <div className="flex gap-0.5">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSpeedChange(option.value)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  speed === option.value
                    ? 'bg-white/30 text-white font-medium'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Navigation component
interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  condition?: boolean;
}

function SectionNavigation({ sections, hasAbstract, hasAiAnalysis }: {
  sections: NavSection[];
  hasAbstract: boolean;
  hasAiAnalysis: boolean;
}) {
  const [activeSection, setActiveSection] = useState<string>('paper-header');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.condition === false) continue;

        const element = document.getElementById(section.id);
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const visibleSections = sections.filter(s => s.condition !== false);

  return (
    <nav className="space-y-1">
      {visibleSections.map((section) => (
        <button
          key={section.id}
          onClick={() => scrollToSection(section.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
            activeSection === section.id
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span className="flex-shrink-0">{section.icon}</span>
          <span className="truncate">{section.label}</span>
        </button>
      ))}
    </nav>
  );
}

// AI Companion Chat Dialog
interface AICompanionDialogProps {
  paperId: string;
  activeSession: AiAgentHistory | null;
  isLoggedIn: boolean;
  onSessionUpdated?: (session: AiAgentHistory) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function AICompanionDialog({ paperId, activeSession, isLoggedIn, onSessionUpdated }: AICompanionDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to check if a message is an internal/system message (not user conversation)
  // These include: page analysis, background generation, review generation, etc.
  const isInternalMessage = (content: string) => {
    if (content.startsWith('[System Context')) return true;
    if (content.startsWith('[Analyze Page')) return true;
    if (content.startsWith('[Page ')) return true;  // Catches "[Page X Analysis]" responses
    if (content.startsWith('[Reading Complete')) return true;  // Reading complete summary
    if (content.startsWith('[Generate Background')) return true;
    if (content.startsWith('[Generated Background')) return true;
    if (content.startsWith('[Generate Review')) return true;
    if (content.startsWith('[Generated Review')) return true;
    if (content.startsWith('Paper:') && content.includes('=== SENTENCES ===')) return true; // Page analysis prompts
    if (content.startsWith('=== SENTENCES ===')) return true;
    if (content.includes('=== FIGURES/TABLES ===')) return true;
    if (content.includes('Total sentences analyzed:')) return true;  // Analysis summary content
    return false;
  };

  // Sync messages from active session (filter to only user/assistant messages, excluding internal ones)
  useEffect(() => {
    if (activeSession?.messages) {
      const filtered = activeSession.messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && !isInternalMessage(m.content))
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp: m.timestamp }));
      setLocalMessages(filtered);
    } else {
      setLocalMessages([]);
    }
  }, [activeSession?.id, activeSession?.messages?.length]);

  // Scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeSession || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setLocalMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await api.chatWithAgent(paperId, activeSession.id, userMessage.content);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
      };

      setLocalMessages(prev => [...prev, assistantMessage]);

      if (onSessionUpdated && result.updatedHistory) {
        onSessionUpdated(result.updatedHistory);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      // Remove the user message on error
      setLocalMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Not logged in state
  if (!isLoggedIn) {
    return (
      <Card className="mt-4">
        <CardContent className="py-4">
          <div className="flex flex-col items-center text-center gap-2">
            <AlertCircle className="w-8 h-8 text-slate-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please <Link href="/login" className="text-indigo-600 hover:underline">log in</Link> to chat with AI
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No active session state
  if (!activeSession) {
    return (
      <Card className="mt-4">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-500" />
            AI Companion
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-col items-center text-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              No active AI session
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Create and activate an AI session in the <strong>AI Sessions</strong> section below to start chatting
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active session but no API key
  if (!activeSession.apiKeySet) {
    return (
      <Card className="mt-4">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-500" />
            AI Companion
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <div className="flex flex-col items-center text-center gap-2">
            <Key className="w-6 h-6 text-amber-500" />
            <p className="text-xs text-slate-600 dark:text-slate-400">
              API key required
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Set your API key in the active session (<strong>{activeSession.title}</strong>) to enable AI chat
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ready to chat
  return (
    <Card className="mt-4">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-500" />
          AI Companion
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {activeSession.modelUsed}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages area */}
        <div className="h-64 overflow-y-auto p-3 space-y-3">
          {localMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                Ask me anything about this paper!
              </p>
            </div>
          ) : (
            localMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this paper..."
              className="text-xs h-8"
              disabled={isLoading}
            />
            <Button
              size="sm"
              className="h-8 px-2"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PaperDetail() {
  const [, params] = useRoute("/paper/:id");
  const paperId = params?.id;

  const { user, logout, isLoading: authLoading } = useAuth();
  const [paper, setPaper] = useState<PaperWithStats | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiReviews, setAiReviews] = useState<AiReview[]>([]);
  const [aiAgentHistories, setAiAgentHistories] = useState<AiAgentHistory[]>([]);
  const [necessaryBackgrounds, setNecessaryBackgrounds] = useState<NecessaryBackground[]>([]);
  const [userReviews, setUserReviews] = useState<UserReview[]>([]);
  const [myUserReview, setMyUserReview] = useState<UserReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [modelRankings, setModelRankings] = useState<AiModelRanking[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(true);
  const [loadingRankings, setLoadingRankings] = useState(true);

  // Tag editing state
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);

  // Check if current user is the paper uploader
  const isUploader = user && paper?.addedBy === user.id;

  // Find the active session for the current user
  const activeSession = aiAgentHistories.find(h => h.isActive && h.userId === user?.id) || null;

  useEffect(() => {
    if (!paperId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [paperResult, annotationsResult, analysisResult, reviewsResult, historiesResult, backgroundsResult, userReviewsResult] = await Promise.all([
          api.getPaper(paperId),
          api.getPaperAnnotations(paperId),
          api.getAiAnalysis(paperId),
          api.getAiReviews(paperId),
          api.getAiAgentHistories(paperId),
          api.getNecessaryBackgrounds(paperId),
          api.getUserReviews(paperId),
        ]);
        setPaper(paperResult.paper);
        setAnnotations(annotationsResult.annotations);
        setAiAnalysis(analysisResult.analysis);
        setAiReviews(reviewsResult.reviews);
        setAiAgentHistories(historiesResult.histories);
        setNecessaryBackgrounds(backgroundsResult.backgrounds);
        setUserReviews(userReviewsResult.reviews);
      } catch (error) {
        console.error("Failed to fetch paper:", error);
        toast.error("Failed to load paper");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [paperId]);

  // Fetch user's own review when logged in
  useEffect(() => {
    if (!paperId || !user) {
      setMyUserReview(null);
      return;
    }

    const fetchMyReview = async () => {
      try {
        const result = await api.getMyUserReview(paperId);
        setMyUserReview(result.review);
      } catch (error) {
        console.error("Failed to fetch my review:", error);
      }
    };

    fetchMyReview();
  }, [paperId, user]);

  // Check if paper is collected
  useEffect(() => {
    if (!paperId || !user) {
      setIsCollected(false);
      return;
    }

    const checkCollection = async () => {
      try {
        const collected = await api.checkPaperCollected(paperId);
        setIsCollected(collected);
      } catch (error) {
        console.error("Failed to check collection:", error);
      }
    };

    checkCollection();
  }, [paperId, user]);

  // Fetch rankings data
  useEffect(() => {
    api.getTopContributors({ limit: 5 })
      .then(({ contributors }) => setTopContributors(contributors))
      .catch(console.error)
      .finally(() => setLoadingContributors(false));

    api.getModelRankings({ limit: 5 })
      .then(({ rankings }) => setModelRankings(rankings))
      .catch(console.error)
      .finally(() => setLoadingRankings(false));
  }, []);

  // Generate display rankings: use API rankings if available, otherwise show default models
  const displayRankings: AiModelRanking[] = (() => {
    if (modelRankings.length > 0) {
      return modelRankings;
    }
    return DEFAULT_AI_MODELS
      .slice(0, 5)
      .map((model, index) => ({
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        likeCount: 0,
        dislikeCount: 0,
        score: 0,
        sessionCount: 0,
        rank: index + 1,
      }));
  })();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleGenerateReview = async (customPrompt?: string) => {
    if (!paperId || !user || !activeSession) {
      toast.error("Please ensure you have an active AI session with completed reading");
      return;
    }

    if (!activeSession.sentenceAnalysis || Object.keys(activeSession.sentenceAnalysis).length === 0) {
      toast.error("The AI needs to read the paper first. Enter Reading Mode and click 'Let Agent Read'");
      return;
    }

    setIsGeneratingReview(true);
    try {
      const result = await api.generateAiReviewFromSession(paperId, activeSession.id, customPrompt);
      setAiReviews(prev => [result.review, ...prev]);
      toast.success("AI Review generated successfully!");
    } catch (error) {
      console.error("Failed to generate review:", error);
      toast.error("Failed to generate AI review");
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const handleGenerateBackground = async (customPrompt?: string) => {
    if (!paperId || !user || !activeSession) {
      toast.error("Please ensure you have an active AI session");
      return;
    }

    if (!activeSession.sentenceAnalysis || Object.keys(activeSession.sentenceAnalysis).length === 0) {
      toast.error("The AI needs to read the paper first. Enter Reading Mode and click 'Let Agent Read'");
      return;
    }

    if (!activeSession.apiKeySet) {
      toast.error("Please set an API key in your active session first");
      return;
    }

    setIsGeneratingBackground(true);
    try {
      const result = await api.generateNecessaryBackground(paperId, activeSession.id, customPrompt);
      setNecessaryBackgrounds(prev => [result.background, ...prev]);
      toast.success("Background knowledge generated successfully!");
    } catch (error) {
      console.error("Failed to generate background:", error);
      toast.error("Failed to generate background knowledge");
    } finally {
      setIsGeneratingBackground(false);
    }
  };

  const handleDeleteAiReview = async (reviewId: string) => {
    if (!paperId) return;
    try {
      await api.deleteAiReview(paperId, reviewId);
      setAiReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success("AI Review deleted");
    } catch (error) {
      console.error("Failed to delete AI review:", error);
      toast.error("Failed to delete AI review");
    }
  };

  const handleDeleteBackground = async (backgroundId: string) => {
    if (!paperId) return;
    try {
      await api.deleteBackground(paperId, backgroundId);
      setNecessaryBackgrounds(prev => prev.filter(b => b.id !== backgroundId));
      toast.success("Background deleted");
    } catch (error) {
      console.error("Failed to delete background:", error);
      toast.error("Failed to delete background");
    }
  };

  const handleUserReviewSaved = (review: UserReview) => {
    setMyUserReview(review);
    // Update or add to the list
    setUserReviews(prev => {
      const idx = prev.findIndex(r => r.id === review.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = review;
        return updated;
      }
      return [review, ...prev];
    });
  };

  const handleUserReviewDeleted = (reviewId: string) => {
    setMyUserReview(null);
    setUserReviews(prev => prev.filter(r => r.id !== reviewId));
  };

  const handleCollect = async () => {
    if (!paperId || !user) {
      toast.error("Please login to collect papers");
      return;
    }

    try {
      if (isCollected) {
        await api.removeFromCollection(paperId);
        setIsCollected(false);
        toast.success("Removed from collection");
      } else {
        await api.addToCollection(paperId);
        setIsCollected(true);
        toast.success("Added to collection");
      }
    } catch (error) {
      console.error("Failed to update collection:", error);
      toast.error("Failed to update collection");
    }
  };

  // Tag editing handlers
  const handleStartEditTags = () => {
    setEditingTags(paper?.tags || []);
    setNewTagInput('');
    setIsEditingTags(true);
  };

  const handleCancelEditTags = () => {
    setIsEditingTags(false);
    setEditingTags([]);
    setNewTagInput('');
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim();
    if (tag && tag.length <= 50 && editingTags.length < 10 && !editingTags.includes(tag)) {
      setEditingTags([...editingTags, tag]);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditingTags(editingTags.filter(t => t !== tagToRemove));
  };

  const handleSaveTags = async () => {
    if (!paperId) return;

    setIsSavingTags(true);
    try {
      const result = await api.updatePaperTags(paperId, editingTags);
      setPaper(prev => prev ? { ...prev, tags: result.tags } : prev);
      setIsEditingTags(false);
      toast.success("Tags updated successfully");
    } catch (error: any) {
      console.error("Failed to update tags:", error);
      toast.error(error.message || "Failed to update tags");
    } finally {
      setIsSavingTags(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
        <header className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border-b border-indigo-200/50 dark:border-slate-800">
          <div className="container flex items-center justify-between h-16">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </header>
        <main className="container py-8">
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Paper not found</h1>
          <Button asChild>
            <Link href="/browse">Back to Browse</Link>
          </Button>
        </div>
      </div>
    );
  }

  const authors = paper.authors.join(", ");

  // Compute annotation statistics
  // Annotations (Danmaku) = have highlightRegion
  // Comments = don't have highlightRegion (sentence/figure discussions)
  const danmakuAnnotations = annotations.filter(a => a.content.highlightRegion);
  const commentAnnotations = annotations.filter(a => !a.content.highlightRegion);

  // Count unique discussions (unique sentenceId/label with comments)
  const uniqueDiscussions = new Set(
    commentAnnotations
      .filter(a => a.sentenceId || a.content.label)
      .map(a => a.sentenceId || a.content.label)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border-b border-indigo-200/50 dark:border-slate-800">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/browse">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
            </Link>
          </div>

          {authLoading ? (
            <Skeleton className="h-9 w-20" />
          ) : user ? (
            <>
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    {user.displayName}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <Link href={`/profile/${user.id}`}>
                    <DropdownMenuItem>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Fixed Page Navigation - visible on smaller screens */}
      <div className="fixed right-4 top-24 z-40 xl:hidden">
        <Card className="w-44 shadow-lg">
          <CardContent className="p-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 flex items-center gap-1.5">
              <Book className="w-3 h-3" />
              Navigate
            </div>
            <SectionNavigation
              sections={[
                { id: 'paper-header', label: 'Paper', icon: <FileText className="w-3 h-3" /> },
                { id: 'danmaku-section', label: 'Annotation Danmaku', icon: <Layers className="w-3 h-3" /> },
                { id: 'abstract-section', label: 'Abstract', icon: <FileText className="w-3 h-3" />, condition: !!paper.abstract },
                { id: 'ai-analysis-section', label: 'AI Analysis', icon: <Sparkles className="w-3 h-3" />, condition: !!aiAnalysis },
                { id: 'background-section', label: 'Background Knowledge', icon: <Brain className="w-3 h-3" /> },
                { id: 'user-reviews-section', label: 'User Reviews', icon: <Star className="w-3 h-3" /> },
                { id: 'ai-reviews-section', label: 'AI Reviews', icon: <Bot className="w-3 h-3" /> },
                { id: 'ai-sessions-section', label: 'AI Sessions', icon: <History className="w-3 h-3" /> },
                { id: 'quiz-section', label: 'Test Understanding', icon: <Target className="w-3 h-3" /> },
                { id: 'open-questions-section', label: 'Open Questions', icon: <HelpCircle className="w-3 h-3" /> },
                { id: 'research-ideas-section', label: 'Research Ideas', icon: <FlaskConical className="w-3 h-3" /> },
              ]}
              hasAbstract={!!paper.abstract}
              hasAiAnalysis={!!aiAnalysis}
            />
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Sidebars */}
      <div className="container py-8">
        <div className="flex gap-6 justify-center">
          {/* Left Sidebar - Top Contributors */}
          <aside className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Top Contributors
                </h2>
                <Link href="/top-contributors" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  View All
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {loadingContributors ? (
                <Card>
                  <CardContent className="py-2">
                    <div className="space-y-1">
                      {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-7 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : topContributors.length === 0 ? (
                <Card>
                  <CardContent className="py-4 text-center text-sm text-slate-500">
                    No contributors yet
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {topContributors.slice(0, 8).map((contributor, index) => (
                        <Link key={contributor.userId} href={`/profile/${contributor.userId}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {contributor.rank || index + 1}
                          </div>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={contributor.userAvatar} />
                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {contributor.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 font-medium text-xs text-slate-800 dark:text-slate-200 truncate">
                            {contributor.userName}
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            {contributor.totalScore} pts
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Page Navigation */}
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-2">
                  <Book className="w-4 h-4 text-slate-500" />
                  On This Page
                </h2>
                <SectionNavigation
                  sections={[
                    { id: 'paper-header', label: 'Paper', icon: <FileText className="w-3.5 h-3.5" /> },
                    { id: 'danmaku-section', label: 'Annotation Danmaku', icon: <Layers className="w-3.5 h-3.5" /> },
                    { id: 'abstract-section', label: 'Abstract', icon: <FileText className="w-3.5 h-3.5" />, condition: !!paper.abstract },
                    { id: 'ai-analysis-section', label: 'AI Analysis', icon: <Sparkles className="w-3.5 h-3.5" />, condition: !!aiAnalysis },
                    { id: 'background-section', label: 'Background Knowledge', icon: <Brain className="w-3.5 h-3.5" /> },
                    { id: 'user-reviews-section', label: 'User Reviews', icon: <Star className="w-3.5 h-3.5" /> },
                    { id: 'ai-reviews-section', label: 'AI Reviews', icon: <Bot className="w-3.5 h-3.5" /> },
                    { id: 'ai-sessions-section', label: 'AI Sessions', icon: <History className="w-3.5 h-3.5" /> },
                    { id: 'quiz-section', label: 'Test Understanding', icon: <Target className="w-3.5 h-3.5" /> },
                    { id: 'open-questions-section', label: 'Open Questions', icon: <HelpCircle className="w-3.5 h-3.5" /> },
                    { id: 'research-ideas-section', label: 'Research Ideas', icon: <FlaskConical className="w-3.5 h-3.5" /> },
                  ]}
                  hasAbstract={!!paper.abstract}
                  hasAiAnalysis={!!aiAnalysis}
                />
              </div>
            </div>
          </aside>

          {/* Center Content */}
          <main className="max-w-4xl flex-1 min-w-0">
            {/* Paper Header */}
        <div className="mb-6" id="paper-header">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {paper.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
            <p className="text-base text-slate-600 dark:text-slate-300">{authors}</p>
            {paper.arxivId && (
              <Badge variant="outline" className="gap-1 text-xs">
                arXiv:{paper.arxivId}
                <a
                  href={`https://arxiv.org/abs/${paper.arxivId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Badge>
            )}
          </div>
          {/* Compact Stats - inline with header */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-semibold">{paper.readerCount}</span>
              <span className="text-slate-500">Readers</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span className="font-semibold">{danmakuAnnotations.length}</span>
              <span className="text-slate-500">Danmaku</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-full">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-semibold">{uniqueDiscussions.size}</span>
              <span className="text-slate-500">Discussions</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50 dark:bg-cyan-900/30 rounded-full">
              <MessageCircle className="h-3.5 w-3.5 text-cyan-500" />
              <span className="font-semibold">{commentAnnotations.length}</span>
              <span className="text-slate-500">Comments</span>
            </span>
          </div>

          {/* Tags Section */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Tag className="h-4 w-4 text-slate-400" />
            {!isEditingTags ? (
              <>
                {paper.tags && paper.tags.length > 0 ? (
                  paper.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No tags</span>
                )}
                {isUploader && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-slate-500 hover:text-slate-700"
                    onClick={handleStartEditTags}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2 w-full">
                {editingTags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="h-7 w-32 text-xs"
                    disabled={editingTags.length >= 10}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleAddTag}
                    disabled={editingTags.length >= 10 || !newTagInput.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleCancelEditTags}
                    disabled={isSavingTags}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleSaveTags}
                    disabled={isSavingTags}
                  >
                    {isSavingTags ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Flowing Danmaku Section */}
        <div id="danmaku-section">
          <FlowingDanmaku annotations={annotations} currentUserId={user?.id} />
        </div>

{/* Enter Reading Mode */}
        <Card className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h3 className="text-xl font-semibold mb-1">Ready to read?</h3>
                <p className="text-indigo-100">
                  Enter reading mode to view the PDF and add annotations
                </p>
              </div>
              <div className="flex items-center gap-3">
                {user && (
                  <Button
                    size="lg"
                    variant={isCollected ? "default" : "outline"}
                    className={isCollected
                      ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                      : "bg-transparent border-white/50 text-white hover:bg-white/10"
                    }
                    onClick={handleCollect}
                  >
                    {isCollected ? (
                      <>
                        <BookmarkCheck className="h-5 w-5 mr-2" />
                        Collected
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-5 w-5 mr-2" />
                        Collect
                      </>
                    )}
                  </Button>
                )}
                <Button size="lg" variant="secondary" asChild>
                  <Link href={`/paper/${paper.id}/read`}>
                    <BookOpen className="h-5 w-5 mr-2" />
                    Enter Reading Mode
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abstract */}
        {paper.abstract && (
          <Card className="mb-8" id="abstract-section">
            <CardHeader>
              <CardTitle>Abstract</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {paper.abstract}
              </p>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis (only if available) */}
        {aiAnalysis && (
          <Card className="mb-8" id="ai-analysis-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {aiAnalysis.summary && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Summary</div>
                  <p className="text-slate-600 dark:text-slate-300">{aiAnalysis.summary}</p>
                </div>
              )}
              <div className="text-sm text-slate-500">
                {aiAnalysis.noveltyCount} novelty points identified
              </div>
            </CardContent>
          </Card>
        )}

        {/* Background Knowledge Section - moved above User Reviews */}
        <div className="mb-8" id="background-section">
          <NecessaryBackgroundPanel
            backgrounds={necessaryBackgrounds}
            onGenerateBackground={user ? handleGenerateBackground : undefined}
            onDeleteBackground={user ? handleDeleteBackground : undefined}
            isGenerating={isGeneratingBackground}
            activeSession={activeSession}
            currentUserId={user?.id}
          />
        </div>

        {/* User Reviews Section */}
        <div className="mb-8" id="user-reviews-section">
          <UserReviewPanel
            paperId={paperId!}
            userReviews={userReviews}
            myReview={myUserReview}
            onReviewSaved={handleUserReviewSaved}
            onReviewDeleted={handleUserReviewDeleted}
            isLoggedIn={!!user}
          />
        </div>

        {/* AI Reviews Section */}
        <div className="mb-8" id="ai-reviews-section">
          <AIReviewPanel
            reviews={aiReviews}
            onGenerateReview={user ? handleGenerateReview : undefined}
            onDeleteReview={user ? handleDeleteAiReview : undefined}
            isGenerating={isGeneratingReview}
            activeSession={activeSession}
            currentUserId={user?.id}
          />
        </div>

        {/* AI Agent History Section */}
        <div id="ai-sessions-section">
          <AIAgentHistoryPanel
          paperId={paper.id}
          histories={aiAgentHistories}
          currentUserId={user?.id}
          onHistoriesChange={setAiAgentHistories}
        />
        </div>

        {/* AI Insights Section - Quiz */}
        <div id="quiz-section" className="mt-8">
          <QuizSection
            paperId={paper.id}
            sessions={aiAgentHistories}
            currentUserId={user?.id}
          />
        </div>

        {/* AI Insights Section - Open Questions */}
        <div id="open-questions-section" className="mt-8">
          <OpenQuestionsSection
            paperId={paper.id}
            sessions={aiAgentHistories}
            currentUserId={user?.id}
          />
        </div>

        {/* AI Insights Section - Research Ideas */}
        <div id="research-ideas-section" className="mt-8">
          <ResearchIdeasSection
            paperId={paper.id}
            sessions={aiAgentHistories}
            currentUserId={user?.id}
          />
        </div>
          </main>

          {/* Right Sidebar - AI Model Arena */}
          <aside className="hidden xl:block w-72 flex-shrink-0">
            <div className="sticky top-24">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  AI Model Arena
                </h2>
                <Link href="/model-rankings" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  View All
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {loadingRankings ? (
                <Card>
                  <CardContent className="py-2">
                    <div className="space-y-1">
                      {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-7 w-full" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {displayRankings.slice(0, 8).map((model, index) => (
                        <Link key={model.modelId} href={`/model-rankings/${model.modelId}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {model.rank || index + 1}
                          </div>
                          <span className="flex-1 font-medium text-xs text-slate-800 dark:text-slate-200 truncate">
                            {model.modelName}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <ThumbsUp className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                            <span className="text-[10px] text-green-600 dark:text-green-400">{model.likeCount}</span>
                            <ThumbsDown className="w-2.5 h-2.5 text-red-500 dark:text-red-400 ml-1" />
                            <span className="text-[10px] text-red-500 dark:text-red-400">{model.dislikeCount}</span>
                            <span className={`text-[10px] font-bold ml-1 ${
                              model.score > 0 ? 'text-green-600 dark:text-green-400' :
                              model.score < 0 ? 'text-red-500 dark:text-red-400' :
                              'text-slate-400'
                            }`}>
                              {model.score > 0 ? '+' : ''}{model.score}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Companion Dialog */}
              <AICompanionDialog
                paperId={paper.id}
                activeSession={activeSession}
                isLoggedIn={!!user}
                onSessionUpdated={(updatedSession) => {
                  setAiAgentHistories(prev =>
                    prev.map(h => h.id === updatedSession.id ? updatedSession : h)
                  );
                }}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
