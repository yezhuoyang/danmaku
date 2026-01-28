import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Search,
  User,
  LogOut,
  Info,
  Users,
  FileText,
  Bot,
  Star,
  MessageCircle,
  Quote,
  Shield,
  UserPlus,
  UserMinus,
  Trophy,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Lightbulb,
  Scale,
  Blocks,
  BookOpen,
  Code,
  Sparkles,
  Target,
  ArrowRight,
  ArrowDown,
  Combine,
  Gavel,
  Swords,
  Calculator,
  Crown,
  Search as SearchIcon,
  HelpCircle,
  Brain,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LikeButtons } from "@/components/ui/LikeButtons";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AIResearchAssistantDialog } from "@/components/AIResearchAssistantDialog";
import * as api from "@/lib/api";
import type { SiteStats, RecentDanmaku, InsightsStatsResponse } from "@/lib/api";
import type { AiModelRanking, AiModelProvider, TopContributor } from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";

// Component for user avatar with profile/follow popover in danmaku
interface DanmakuUserPopoverProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  avatarColor: string;
  currentUserId?: string;
}

function DanmakuUserPopover({ userId, userName, userAvatar, avatarColor, currentUserId }: DanmakuUserPopoverProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);

  // Load follow status when popover opens
  useEffect(() => {
    if (open && currentUserId && !followStatusLoaded) {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="w-6 h-6 flex-shrink-0">
            <AvatarImage src={userAvatar} />
            <AvatarFallback
              className="text-xs text-white"
              style={{ backgroundColor: avatarColor }}
            >
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-white/80 text-sm font-medium">
            {userName}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-slate-500" />
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

// Provider colors for badges
const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  anthropic: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  xai: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  meta: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  deepseek: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  alibaba: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  mistral: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cohere: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  custom: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

export default function Home() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [insightsStats, setInsightsStats] = useState<InsightsStatsResponse | null>(null);
  const [recentDanmaku, setRecentDanmaku] = useState<RecentDanmaku[]>([]);
  const [modelRankings, setModelRankings] = useState<AiModelRanking[]>([]);
  const [topContributors, setTopContributors] = useState<TopContributor[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDanmaku, setLoadingDanmaku] = useState(true);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [loadingContributors, setLoadingContributors] = useState(true);

  useEffect(() => {
    // Load site stats
    api.getSiteStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));

    // Load insights stats (open questions & research ideas)
    api.getInsightsStats()
      .then(setInsightsStats)
      .catch(console.error);

    // Load recent danmaku
    api.getRecentDanmaku()
      .then(({ danmaku }) => setRecentDanmaku(danmaku))
      .catch(console.error)
      .finally(() => setLoadingDanmaku(false));

    // Load model rankings
    api.getModelRankings({ limit: 50 })
      .then(({ rankings }) => setModelRankings(rankings))
      .catch(console.error)
      .finally(() => setLoadingRankings(false));

    // Load top contributors
    api.getTopContributors({ limit: 10 })
      .then(({ contributors }) => setTopContributors(contributors))
      .catch(console.error)
      .finally(() => setLoadingContributors(false));
  }, []);

  // Generate display rankings: use API rankings if available, otherwise show all default models sorted alphabetically
  const displayRankings: AiModelRanking[] = (() => {
    if (modelRankings.length > 0) {
      return modelRankings;
    }
    // No API rankings yet - show all default models sorted alphabetically by name
    return DEFAULT_AI_MODELS
      .map((model) => ({
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        likeCount: 0,
        dislikeCount: 0,
        score: 0,
        sessionCount: 0,
      }))
      .sort((a, b) => a.modelName.localeCompare(b.modelName))
      .map((model, index) => ({ ...model, rank: index + 1 }));
  })();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      setLocation("/browse");
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex flex-col">
      {/* Minimal Navigation */}
      <nav className="absolute top-0 right-0 p-4 z-10">
        <div className="flex items-center gap-3">
          <Link href="/challenge-problems" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
            <Lightbulb className="w-4 h-4" />
            Challenges
          </Link>
          <Link href="/open-questions" className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
            <HelpCircle className="w-4 h-4" />
            Open Questions
          </Link>
          <Link href="/research-ideas" className="text-sm text-slate-600 dark:text-slate-300 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors flex items-center gap-1">
            <Brain className="w-4 h-4" />
            Research Ideas
          </Link>
          <Link href="/debates" className="text-sm text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1">
            <Scale className="w-4 h-4" />
            AI Debates
          </Link>
          <Link href="/paper-groups" className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
            <FileText className="w-4 h-4" />
            Paper Groups
          </Link>
          <Link href="/agent-lego" className="text-sm text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 transition-colors flex items-center gap-1">
            <Blocks className="w-4 h-4" />
            Agent Lego
          </Link>
          <Link href="/feedback" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Feedback
          </Link>
          <Link href="/about" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
            <Info className="w-4 h-4" />
            About
          </Link>
          {!authLoading && !user && (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
          {!authLoading && user && (
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
                  <Link href="/my-background-jobs">
                    <DropdownMenuItem>
                      <BookOpen className="h-4 w-4 mr-2" />
                      Background Reading
                    </DropdownMenuItem>
                  </Link>
                  {user.isAdmin && (
                    <Link href="/admin">
                      <DropdownMenuItem>
                        <Shield className="h-4 w-4 mr-2" />
                        Admin
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </nav>

      {/* Main Content - Centered */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pt-16 pb-8">
        {/* Header Row: Top Contributors + Logo/Title + AI Model Arena */}
        <div className="w-full max-w-7xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 mb-8">
          {/* Left: Top Human Contributors */}
          <div className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
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
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                    {topContributors.slice(0, 8).map((contributor, index) => (
                      <Link key={contributor.userId} href={`/profile/${contributor.userId}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Rank */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {contributor.rank || index + 1}
                          </div>

                          {/* Avatar */}
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={contributor.userAvatar} />
                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {contributor.userName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate block">
                              {contributor.userName}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {contributor.totalScore} pts
                            </span>
                          </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Contributor Highlight */}
            {topContributors.length > 0 && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <Star className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                <p className="text-xs text-indigo-800 dark:text-indigo-200">
                  <span className="font-medium">Top contributor:</span>{" "}
                  <Link href={`/profile/${topContributors[0].userId}`} className="font-semibold hover:underline">
                    {topContributors[0].userName}
                  </Link>
                  <span className="text-indigo-600 dark:text-indigo-400 ml-1">
                    ({topContributors[0].totalScore} pts)
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Center: Logo, Title, Slogan */}
          <div className="flex flex-col items-center flex-1">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4 text-center">
              PaperPilot
            </h1>

            {/* Slogan */}
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-2 text-center max-w-lg">
              Read paper and do research with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 font-semibold">
                AI Agents
              </span>
            </p>

            {/* UCLA Attribution */}
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 text-center">
              Since 2026, a non-profit project starting from UCLA
            </p>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="w-full max-w-2xl mb-6">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search papers, debates, challenges, paper groups..."
                  className="w-full h-14 pl-12 pr-4 text-lg rounded-full border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 shadow-sm hover:shadow-md focus:shadow-lg transition-all"
                />
              </div>
            </form>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                type="submit"
                onClick={handleSearch}
                className="px-6"
              >
                Search
              </Button>
              <Button variant="outline" asChild className="px-6">
                <Link href="/browse">Browse All</Link>
              </Button>
              <Button variant="outline" asChild className="px-6 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950">
                <Link href="/open-questions" className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                  Open Questions
                  {insightsStats && insightsStats.totalOpenQuestions > 0 && (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full">
                      {insightsStats.totalOpenQuestions}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="outline" asChild className="px-6 border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:hover:bg-yellow-950">
                <Link href="/research-ideas" className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-yellow-500" />
                  Research Ideas
                  {insightsStats && insightsStats.totalResearchIdeas > 0 && (
                    <span className="bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs px-1.5 py-0.5 rounded-full">
                      {insightsStats.totalResearchIdeas}
                    </span>
                  )}
                </Link>
              </Button>
              <AIResearchAssistantDialog />
            </div>
          </div>

          {/* Right: AI Model Arena */}
          <div className="w-full lg:w-72 flex-shrink-0">
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
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-7 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[400px] overflow-y-auto">
                    {displayRankings.slice(0, 8).map((model, index) => (
                      <Link key={model.modelId} href={`/model-rankings/${model.modelId}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Rank */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {model.rank || index + 1}
                          </div>

                          {/* Model Info */}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate block">
                              {model.modelName}
                            </span>
                          </div>

                          {/* Score */}
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

            {/* Top Model Recommendation */}
            {displayRankings.length > 0 && displayRankings[0].score > 0 && (
              <div className="mt-3 flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <span className="font-medium">Top model for reviewing papers:</span>{" "}
                  <Link href={`/model-rankings/${displayRankings[0].modelId}`} className="font-semibold hover:underline">
                    {displayRankings[0].modelName}
                  </Link>
                  <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                    (+{displayRankings[0].score} score)
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Site Statistics */}
        <div className="w-full max-w-4xl mb-12">
          {loadingStats ? (
            <div className="flex flex-wrap justify-center gap-3">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-32" />
              ))}
            </div>
          ) : stats && (
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Users className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold">{formatNumber(stats.userCount)}</span>
                <span className="text-slate-500">Users</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <FileText className="w-4 h-4 text-purple-500" />
                <span className="font-semibold">{formatNumber(stats.paperCount)}</span>
                <span className="text-slate-500">Papers</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">{formatNumber(stats.annotationCount)}</span>
                <span className="text-slate-500">Annotations</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Bot className="w-4 h-4 text-orange-500" />
                <span className="font-semibold">{formatNumber(stats.aiReviewCount)}</span>
                <span className="text-slate-500">AI Reviews</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold">{formatNumber(stats.humanReviewCount)}</span>
                <span className="text-slate-500">Human Reviews</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                <Quote className="w-4 h-4 text-green-500" />
                <span className="font-semibold">{formatNumber(stats.discussionCount)}</span>
                <span className="text-slate-500">Discussions</span>
              </div>
              {insightsStats && (
                <>
                  <Link href="/open-questions" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <span className="font-semibold">{formatNumber(insightsStats.totalOpenQuestions)}</span>
                    <span className="text-blue-600 dark:text-blue-400">Open Questions</span>
                  </Link>
                  <Link href="/research-ideas" className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/50 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors cursor-pointer">
                    <Brain className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold">{formatNumber(insightsStats.totalResearchIdeas)}</span>
                    <span className="text-yellow-600 dark:text-yellow-400">Research Ideas</span>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {/* Two-Column AI Features Showcase */}
        <div className="w-full max-w-7xl mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Multi-Agent Research Workflow */}
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950/50 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Multi-Agent Workflow
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Customize your own multi-agent work flow.
              </p>
            </div>

            {/* Hierarchical Agent Architecture */}
            <div className="relative">
              {/* Chief Commander at Top */}
              <div className="flex justify-center mb-2">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-3 shadow-lg border-2 border-amber-300 dark:border-amber-600 text-center relative z-10">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Commander</h3>
                  <span className="text-[10px] text-amber-100">Orchestrates All</span>
                </div>
              </div>

              {/* Connection Lines from Commander to Agents */}
              <div className="flex justify-center mb-2">
                <svg width="280" height="40" className="overflow-visible">
                  {/* Left line */}
                  <line x1="140" y1="0" x2="50" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" strokeDasharray="4,2" />
                  {/* Center-left line */}
                  <line x1="140" y1="0" x2="100" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" strokeDasharray="4,2" />
                  {/* Center-right line */}
                  <line x1="140" y1="0" x2="180" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" strokeDasharray="4,2" />
                  {/* Right line */}
                  <line x1="140" y1="0" x2="230" y2="40" stroke="currentColor" strokeWidth="2" className="text-slate-300 dark:text-slate-600" strokeDasharray="4,2" />
                </svg>
              </div>

              {/* Four Agents Row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {/* Math Agent */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-blue-200 dark:border-blue-800 text-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                    <Calculator className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-[10px] text-slate-800 dark:text-white">Math</h3>
                  <span className="text-[8px] text-blue-600 dark:text-blue-400">Calculation</span>
                </div>

                {/* Code Agent */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-green-200 dark:border-green-800 text-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                    <Code className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-[10px] text-slate-800 dark:text-white">Code</h3>
                  <span className="text-[8px] text-green-600 dark:text-green-400">Programming</span>
                </div>

                {/* Research Agent */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-purple-200 dark:border-purple-800 text-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                    <SearchIcon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-[10px] text-slate-800 dark:text-white">Research</h3>
                  <span className="text-[8px] text-purple-600 dark:text-purple-400">Analysis</span>
                </div>

                {/* Writer Agent */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-rose-200 dark:border-rose-800 text-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-rose-400 to-rose-600 rounded-lg flex items-center justify-center mx-auto mb-1">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-[10px] text-slate-800 dark:text-white">Writer</h3>
                  <span className="text-[8px] text-rose-600 dark:text-rose-400">Documentation</span>
                </div>
              </div>

              {/* Arrow Down */}
              <div className="flex justify-center mb-3">
                <ArrowDown className="w-5 h-5 text-slate-400" />
              </div>

              {/* Output */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl px-4 py-3 shadow-md">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Combine className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-medium opacity-90">COLLABORATIVE OUTPUT</div>
                    <div className="text-sm font-bold">Research + Code + Report</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center mt-6">
              <Link href="/agent-lego">
                <Button size="sm" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
                  <Blocks className="w-4 h-4" />
                  Try Agent Lego
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* RIGHT: AI Debate Showcase */}
          <div className="bg-gradient-to-br from-slate-50 to-rose-50 dark:from-slate-900 dark:to-rose-950/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-lg">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center justify-center gap-2">
                <Scale className="w-5 h-5 text-rose-500" />
                AI Paper Debates
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                As agents debate against each others towards truth.
              </p>
            </div>

            {/* Paper Being Read */}
            <div className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 mb-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500">PAPER</div>
                  <div className="text-sm font-medium text-slate-800 dark:text-white">"Attention Is All You Need"</div>
                </div>
              </div>
            </div>

            {/* Arrow Down with "Both Read" */}
            <div className="flex justify-center mb-4">
              <div className="flex flex-col items-center text-slate-400">
                <ArrowDown className="w-5 h-5" />
                <span className="text-[10px] font-medium">Both agents read</span>
              </div>
            </div>

            {/* Three Agents Row: Affirmative - Judge - Negative */}
            <div className="grid grid-cols-3 gap-3 mb-4 items-start">
              {/* Affirmative Agent */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border-2 border-emerald-200 dark:border-emerald-800">
                <div className="flex flex-col items-center text-center mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center mb-1">
                    <ThumbsUp className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-xs text-slate-800 dark:text-white">Affirmative</h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">GPT-4o</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-[10px] text-slate-600 dark:text-slate-400 italic">
                  "Revolutionary attention mechanism..."
                </div>
              </div>

              {/* Judge Agent in the Middle */}
              <div className="relative">
                {/* Connection lines */}
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" style={{ zIndex: 0 }}>
                  <line x1="0" y1="50%" x2="30%" y2="50%" stroke="currentColor" strokeWidth="2" className="text-amber-400" strokeDasharray="4,2" />
                  <line x1="70%" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="2" className="text-amber-400" strokeDasharray="4,2" />
                </svg>
                <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl p-3 shadow-lg border-2 border-amber-300 dark:border-amber-600 relative z-10">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-1">
                      <Gavel className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-xs text-white">Judge</h3>
                    <span className="text-[10px] text-amber-100">Gemini Pro</span>
                    <div className="mt-2 bg-white/20 rounded-lg px-2 py-1">
                      <span className="text-[9px] text-white font-medium">Evaluating...</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Negative Agent */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border-2 border-rose-200 dark:border-rose-800">
                <div className="flex flex-col items-center text-center mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-600 rounded-lg flex items-center justify-center mb-1">
                    <ThumbsDown className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-xs text-slate-800 dark:text-white">Negative</h3>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400">Claude</span>
                </div>
                <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2 text-[10px] text-slate-600 dark:text-slate-400 italic">
                  "Quadratic complexity limits..."
                </div>
              </div>
            </div>

            {/* Crossed Swords */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-slate-400 animate-pulse" />
                <span className="text-xs text-slate-500 font-medium">Debating towards truth</span>
              </div>
            </div>

            {/* Verdict Output */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl px-4 py-3 shadow-md">
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-medium opacity-90">VERDICT</div>
                  <div className="text-sm font-bold">Fair judgment based on evidence</div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center mt-6">
              <Link href="/debates">
                <Button size="sm" className="gap-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600">
                  <Scale className="w-4 h-4" />
                  View AI Debates
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Animated Danmaku Section */}
        <div className="w-full max-w-5xl">
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-4 text-center flex items-center justify-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Live Annotations
          </h2>

          {loadingDanmaku ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-pulse text-slate-400">Loading annotations...</div>
            </div>
          ) : recentDanmaku.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                No annotations yet. Be the first to annotate a paper!
              </CardContent>
            </Card>
          ) : (
            <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 shadow-xl">
              {/* Danmaku tracks - start from right edge (100vw), end at left edge (-100%) */}
              <style>{`
                @keyframes danmaku-scroll {
                  0% {
                    transform: translateX(0);
                  }
                  100% {
                    transform: translateX(calc(-100% - 100vw));
                  }
                }
                .danmaku-track {
                  position: absolute;
                  right: 0;
                  transform: translateX(100%);
                  animation: danmaku-scroll linear infinite;
                  will-change: transform;
                }
                .danmaku-track:hover {
                  animation-play-state: paused;
                }
              `}</style>

              {/* Show latest 10 annotations cycling through 5 tracks */}
              {recentDanmaku.slice(0, 10).map((danmaku, index) => {
                const track = index % 5;
                // Stagger the start times so annotations don't overlap
                const delay = (index * 3);
                // Consistent duration for smooth scrolling
                const duration = 20;

                return (
                  <div
                    key={danmaku.id}
                    className="danmaku-track whitespace-nowrap cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      top: `${track * 18 + 8}%`,
                      animationDuration: `${duration}s`,
                      animationDelay: `${delay}s`,
                    }}
                  >
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
                      <DanmakuUserPopover
                        userId={danmaku.user.id}
                        userName={danmaku.user.displayName}
                        userAvatar={danmaku.user.avatar}
                        avatarColor={danmaku.content.color || '#6366f1'}
                        currentUserId={user?.id}
                      />

                      <span className="text-white/40 text-xs font-mono">
                        {formatTimestamp(danmaku.createdAt)}
                      </span>

                      {danmaku.content.label && (
                        <Badge
                          className="text-xs border-0"
                          style={{
                            backgroundColor: danmaku.content.color + '40',
                            color: danmaku.content.color,
                          }}
                        >
                          {danmaku.content.label}
                        </Badge>
                      )}

                      <span className="text-white text-sm max-w-xs truncate">
                        {danmaku.content.text}
                      </span>

                      <Link href={`/paper/${danmaku.paperId}`} onClick={(e) => e.stopPropagation()}>
                        <span className="text-white/50 text-xs hover:text-white/80 transition-colors">
                          — {danmaku.paperTitle.slice(0, 30)}{danmaku.paperTitle.length > 30 ? '...' : ''}
                        </span>
                      </Link>
                      <LikeButtons
                        targetType="annotation"
                        targetId={danmaku.id}
                        currentUserId={user?.id}
                        size="sm"
                        className="[&_button]:text-white/50 [&_button:hover]:text-white/80"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Gradient overlays for fade effect */}
              <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-slate-900 to-transparent pointer-events-none z-10" />
              <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none z-10" />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <div className="flex items-center justify-center gap-6 text-sm text-slate-500 mb-3">
          <Link href="/about" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            About
          </Link>
          <Link href="/feedback" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Feedback
          </Link>
          <a href="https://github.com/yezhuoyang/danmaku" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            GitHub
          </a>
          <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Documentation
          </a>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Contact developer: John Ye{" "}
          <a
            href="mailto:yezhuoyang@cs.ucla.edu"
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            yezhuoyang@cs.ucla.edu
          </a>
        </p>
      </footer>
    </div>
  );
}
