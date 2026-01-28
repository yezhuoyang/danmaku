import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Lightbulb,
  Filter,
  ArrowLeft,
  Home,
  ExternalLink,
  Sparkles,
  Loader2,
  ArrowUpRight,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Brain,
  GitBranch,
  Target,
  Rocket,
  Beaker,
  Check,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { ResearchIdeaWithContext, SuggestedParent, ReorganizeSuggestions } from "@/lib/api";

export default function ResearchIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<ResearchIdeaWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [feasibilityFilter, setFeasibilityFilter] = useState<"high" | "medium" | "low" | "all">("all");
  const [noveltyFilter, setNoveltyFilter] = useState<"incremental" | "moderate" | "breakthrough" | "all">("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "novelty" | "feasibility">("recent");

  // Promotion dialog
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ResearchIdeaWithContext | null>(null);
  const [promotionTitle, setPromotionTitle] = useState("");
  const [promotionDescription, setPromotionDescription] = useState("");
  const [promotionArea, setPromotionArea] = useState("");
  const [promoting, setPromoting] = useState(false);

  // Parent suggestions
  const [suggestedParents, setSuggestedParents] = useState<SuggestedParent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [loadingParents, setLoadingParents] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('openai_api_key') || '');

  // Keyword search for challenge problems
  const [challengeSearchQuery, setChallengeSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; type: string; status: string }>>([]);
  const [searchingChallenges, setSearchingChallenges] = useState(false);

  // AI prompt (visible/editable)
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  // AI Reorganization
  const [reorganizeDialogOpen, setReorganizeDialogOpen] = useState(false);
  const [reorganizing, setReorganizing] = useState(false);
  const [reorganizeSuggestions, setReorganizeSuggestions] = useState<ReorganizeSuggestions | null>(null);
  const [parentProblemTitles, setParentProblemTitles] = useState<Record<string, string>>({});
  const [acceptingSuggestion, setAcceptingSuggestion] = useState<number | null>(null);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());

  // Stats
  const [stats, setStats] = useState<api.InsightsStatsResponse | null>(null);

  // Fetch stats on mount
  useEffect(() => {
    api.getInsightsStats()
      .then(setStats)
      .catch(console.error);
  }, []);

  // Fetch ideas
  useEffect(() => {
    const fetchIdeas = async () => {
      setLoading(true);
      try {
        const options: Parameters<typeof api.getResearchIdeas>[0] = {
          limit: 50,
          sort: sortBy,
        };
        if (searchQuery) options.q = searchQuery;
        if (feasibilityFilter !== "all") options.feasibility = feasibilityFilter;
        if (noveltyFilter !== "all") options.novelty = noveltyFilter;

        const { ideas: data, total: t } = await api.getResearchIdeas(options);
        setIdeas(data);
        setTotal(t);
      } catch (error) {
        console.error("Failed to fetch ideas:", error);
        toast.error("Failed to load research ideas");
      } finally {
        setLoading(false);
      }
    };

    fetchIdeas();
  }, [searchQuery, feasibilityFilter, noveltyFilter, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const openPromotionDialog = (idea: ResearchIdeaWithContext) => {
    setSelectedIdea(idea);
    setPromotionTitle(idea.title);
    setPromotionDescription(idea.description || "");
    setPromotionArea("");
    setSuggestedParents([]);
    setSelectedParentId(null);
    setPromotionDialogOpen(true);
  };

  // Search challenge problems by keyword
  const handleSearchChallenges = async () => {
    if (!challengeSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchingChallenges(true);
    try {
      const response = await fetch(`/api/challenges?q=${encodeURIComponent(challengeSearchQuery.trim())}&limit=10`);
      if (!response.ok) throw new Error("Failed to search");
      const data = await response.json();
      setSearchResults(data.problems || []);
    } catch (error) {
      console.error("Failed to search challenges:", error);
      toast.error("Failed to search challenge problems");
    } finally {
      setSearchingChallenges(false);
    }
  };

  // Build default AI prompt
  const buildDefaultAiPrompt = () => {
    const existingProblems = searchResults.length > 0
      ? searchResults.map(p => `- ${p.title} (${p.status})`).join('\n')
      : 'No specific problems selected - will analyze all challenge problems';

    return `You are analyzing whether a new research idea should be linked to existing challenge problems.

NEW RESEARCH IDEA:
Title: ${promotionTitle}
Description: ${promotionDescription}

CANDIDATE PARENT PROBLEMS:
${existingProblems}

Instructions:
1. Analyze if the new idea is related to any of the candidate problems
2. If related, determine which problem is the best parent (most specific but still encompassing)
3. Return a JSON array of suggestions, each with:
   - id: the problem ID
   - title: the problem title
   - confidence: 0-1 score of how well it fits as a parent
   - reasoning: brief explanation

If no good match exists, return an empty array.
The new idea can become a top-level problem.`;
  };

  // Initialize AI prompt when dialog opens
  useEffect(() => {
    if (promotionDialogOpen && selectedIdea) {
      setAiPrompt(buildDefaultAiPrompt());
    }
  }, [promotionDialogOpen, selectedIdea, promotionTitle, promotionDescription, searchResults]);

  const handleSuggestParents = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your OpenAI API key first");
      return;
    }

    // Save to session for future use
    sessionStorage.setItem('openai_api_key', apiKey);

    setLoadingParents(true);
    try {
      const { suggestions } = await api.suggestParentProblem({
        title: promotionTitle,
        description: promotionDescription,
        apiKey: apiKey.trim(),
        provider: 'openai',
        customPrompt: aiPrompt, // Pass custom prompt
        candidateIds: searchResults.length > 0 ? searchResults.map(r => r.id) : undefined,
      });
      setSuggestedParents(suggestions);
      if (suggestions.length === 0) {
        toast.info("No suitable parent problems found - this will be a top-level problem");
      }
    } catch (error) {
      console.error("Failed to suggest parents:", error);
      toast.error("Failed to get parent suggestions");
    } finally {
      setLoadingParents(false);
    }
  };

  const handlePromote = async () => {
    if (!selectedIdea || !promotionTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    setPromoting(true);
    try {
      await api.promoteIdeaToChallenge({
        historyId: selectedIdea.sessionId,
        ideaId: selectedIdea.id,
        title: promotionTitle.trim(),
        description: promotionDescription.trim() || undefined,
        area: promotionArea.trim() || undefined,
        type: 'research_idea',
        parentId: selectedParentId || undefined,
      });
      toast.success("Research idea promoted to Challenge Problems!");
      setPromotionDialogOpen(false);
    } catch (error: any) {
      console.error("Failed to promote:", error);
      toast.error(error.message || "Failed to promote idea");
    } finally {
      setPromoting(false);
    }
  };

  const handleReorganize = async () => {
    const storedKey = sessionStorage.getItem('openai_api_key') || apiKey;
    if (!storedKey) {
      toast.error("Please enter your OpenAI API key in the Promote dialog first");
      return;
    }

    setReorganizing(true);
    setAcceptedSuggestions(new Set());
    setRejectedSuggestions(new Set());
    setParentProblemTitles({});
    try {
      const { suggestions } = await api.reorganizeInsights({
        apiKey: storedKey,
        provider: 'openai',
        scope: 'all',
      });
      setReorganizeSuggestions(suggestions);
      setReorganizeDialogOpen(true);

      // Fetch parent problem titles
      const parentIds = new Set<string>();
      suggestions.promotions?.forEach(p => {
        if (p.suggestedParentId) parentIds.add(p.suggestedParentId);
      });
      suggestions.duplicates?.forEach(d => {
        if (d.existingProblemId) parentIds.add(d.existingProblemId);
      });
      suggestions.relationships?.forEach(r => {
        if (r.targetProblemId) parentIds.add(r.targetProblemId);
      });

      // Fetch titles for each parent ID
      const titles: Record<string, string> = {};
      await Promise.all(
        Array.from(parentIds).map(async (id) => {
          try {
            const { problem } = await api.getChallengeProblem(id);
            titles[id] = problem.title;
          } catch {
            titles[id] = `Unknown (${id.substring(0, 8)}...)`;
          }
        })
      );
      setParentProblemTitles(titles);
    } catch (error) {
      console.error("Failed to reorganize:", error);
      toast.error("Failed to get reorganization suggestions");
    } finally {
      setReorganizing(false);
    }
  };

  // Accept a promotion suggestion
  const handleAcceptPromotion = async (promo: NonNullable<ReorganizeSuggestions['promotions']>[0], index: number) => {
    if (!promo.insight) {
      toast.error("No insight data available for this promotion");
      return;
    }

    setAcceptingSuggestion(index);
    try {
      await api.promoteIdeaToChallenge({
        historyId: promo.insight.sessionId,
        ideaId: promo.insight.ideaId,
        type: promo.insight.type,
        title: promo.suggestedTitle || promo.insight.title,
        description: promo.insight.description,
        parentId: promo.suggestedParentId || undefined,
      });
      toast.success(`Promoted "${promo.suggestedTitle || promo.insight.title}" to Challenge Problems!`);
      setAcceptedSuggestions(prev => new Set([...prev, index]));
    } catch (error: any) {
      console.error("Failed to accept promotion:", error);
      toast.error(error.message || "Failed to promote to challenge problem");
    } finally {
      setAcceptingSuggestion(null);
    }
  };

  // Reject a suggestion (just hide it from the list)
  const handleRejectSuggestion = (index: number) => {
    setRejectedSuggestions(prev => new Set([...prev, index]));
    toast.info("Suggestion dismissed");
  };

  const getFeasibilityBadgeVariant = (feasibility: string) => {
    switch (feasibility) {
      case "high":
        return "default";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getNoveltyBadgeVariant = (novelty: string) => {
    switch (novelty) {
      case "breakthrough":
        return "destructive";
      case "moderate":
        return "default";
      case "incremental":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/challenge-problems">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <h1 className="text-xl font-semibold">Research Ideas</h1>
                <Badge variant="outline" className="ml-2">
                  {total} ideas
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <Home className="h-4 w-4" />
                </Button>
              </Link>
              {user && (
                <Button
                  variant="outline"
                  onClick={handleReorganize}
                  disabled={reorganizing}
                >
                  {reorganizing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  AI Reorganize
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-xs text-muted-foreground">Research Ideas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.papersWithInsights}</p>
                  <p className="text-xs text-muted-foreground">Papers Analyzed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <GitBranch className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalChallengeProblems}</p>
                  <p className="text-xs text-muted-foreground">Challenge Problems</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <ArrowUpRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.promotedIdeas}</p>
                  <p className="text-xs text-muted-foreground">Promoted Ideas</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search ideas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select
                value={feasibilityFilter}
                onValueChange={(v) => setFeasibilityFilter(v as any)}
              >
                <SelectTrigger className="w-[140px]">
                  <Target className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Feasibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Feasibility</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={noveltyFilter}
                onValueChange={(v) => setNoveltyFilter(v as any)}
              >
                <SelectTrigger className="w-[150px]">
                  <Rocket className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Novelty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Novelty</SelectItem>
                  <SelectItem value="breakthrough">Breakthrough</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="incremental">Incremental</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="novelty">By Novelty</SelectItem>
                  <SelectItem value="feasibility">By Feasibility</SelectItem>
                </SelectContent>
              </Select>
            </form>
          </CardContent>
        </Card>

        {/* Ideas List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : ideas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Research Ideas Found</h3>
              <p className="text-muted-foreground mb-4">
                Research ideas are generated when users read papers with AI assistance.
              </p>
              <Link href="/browse">
                <Button>Browse Papers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => (
              <Card key={`${idea.sessionId}-${idea.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={getNoveltyBadgeVariant(idea.novelty)}>
                          {idea.novelty}
                        </Badge>
                        <Badge variant={getFeasibilityBadgeVariant(idea.feasibility)}>
                          {idea.feasibility} feasibility
                        </Badge>
                      </div>
                      <h3 className="text-lg font-medium mb-2">{idea.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {idea.description}
                      </p>
                      {idea.methodology && (
                        <div className="mb-3 p-2 bg-muted/50 rounded text-sm">
                          <span className="font-medium flex items-center gap-1 mb-1">
                            <Beaker className="h-3 w-3" />
                            Methodology:
                          </span>
                          <span className="text-muted-foreground line-clamp-2">{idea.methodology}</span>
                        </div>
                      )}
                      {idea.expectedOutcome && (
                        <div className="mb-3 p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                          <span className="font-medium flex items-center gap-1 mb-1">
                            <Target className="h-3 w-3" />
                            Expected Outcome:
                          </span>
                          <span className="text-muted-foreground line-clamp-2">{idea.expectedOutcome}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {idea.paperTitle && (
                          <Link href={`/paper/${idea.paperId}`}>
                            <span className="flex items-center gap-1 hover:text-foreground">
                              <FileText className="h-3 w-3" />
                              {idea.paperTitle.length > 50
                                ? idea.paperTitle.slice(0, 50) + "..."
                                : idea.paperTitle}
                            </span>
                          </Link>
                        )}
                        <span className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={idea.userAvatar} />
                            <AvatarFallback className="text-[8px]">
                              {idea.userName?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {idea.userName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(idea.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {user && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPromotionDialog(idea)}
                        >
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                          Promote
                        </Button>
                      )}
                      {idea.paperId && (
                        <Link href={`/paper/${idea.paperId}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Paper
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Promotion Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-green-500" />
              Promote to Challenge Problem
            </DialogTitle>
            <DialogDescription>
              Convert this research idea into a tracked challenge problem in the research git tree.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={promotionTitle}
                onChange={(e) => setPromotionTitle(e.target.value)}
                placeholder="Challenge problem title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={promotionDescription}
                onChange={(e) => setPromotionDescription(e.target.value)}
                placeholder="Problem description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Research Area (optional)</Label>
              <Input
                value={promotionArea}
                onChange={(e) => setPromotionArea(e.target.value)}
                placeholder="e.g., Machine Learning, NLP, Computer Vision"
              />
            </div>

            {/* Link to existing challenge problem section */}
            <div className="space-y-3 border-t pt-4">
              <Label>Link to Existing Challenge Problem (optional)</Label>
              <p className="text-xs text-muted-foreground">
                Search for related challenge problems first, then use AI to help choose the best match.
              </p>

              {/* Step 1: Keyword search */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Step 1: Search by keyword</Label>
                <div className="flex gap-2">
                  <Input
                    value={challengeSearchQuery}
                    onChange={(e) => setChallengeSearchQuery(e.target.value)}
                    placeholder="Search challenge problems..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchChallenges();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSearchChallenges}
                    disabled={searchingChallenges}
                  >
                    {searchingChallenges ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    <p className="text-xs text-muted-foreground">
                      Found {searchResults.length} problems - click to select as parent, or use AI below
                    </p>
                    {searchResults.map((problem) => (
                      <div
                        key={problem.id}
                        className={`p-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                          selectedParentId === problem.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedParentId(
                          selectedParentId === problem.id ? null : problem.id
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{problem.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {problem.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: AI suggestion */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-medium">Step 2: AI-assisted selection (optional)</Label>
                <div className="space-y-2">
                  <Label className="text-xs">OpenAI API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="font-mono text-sm"
                  />
                </div>

                {/* Collapsible AI prompt */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={() => setShowAiPrompt(!showAiPrompt)}
                  >
                    <span className="flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      {showAiPrompt ? "Hide AI Prompt (Debug)" : "Show AI Prompt (Debug)"}
                    </span>
                    <span>{showAiPrompt ? "▲" : "▼"}</span>
                  </Button>
                  {showAiPrompt && (
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="AI prompt..."
                      rows={10}
                      className="font-mono text-xs"
                    />
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestParents}
                  disabled={loadingParents || !apiKey.trim()}
                  className="w-full"
                >
                  {loadingParents ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Analyze with AI
                </Button>

                {/* AI suggestions */}
                {suggestedParents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">AI Suggestions:</p>
                    {suggestedParents.map((parent) => (
                      <div
                        key={parent.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedParentId === parent.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedParentId(
                          selectedParentId === parent.id ? null : parent.id
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{parent.title}</span>
                          <Badge variant="outline">
                            {Math.round(parent.confidence * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {parent.reasoning}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected parent summary */}
              {selectedParentId && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Selected: {searchResults.find(r => r.id === selectedParentId)?.title ||
                              suggestedParents.find(p => p.id === selectedParentId)?.title}
                  </p>
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setSelectedParentId(null);
                  setSearchResults([]);
                  setSuggestedParents([]);
                  setChallengeSearchQuery("");
                }}
              >
                Create as top-level problem (no parent)
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromotionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePromote} disabled={promoting}>
              {promoting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Promote to Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Reorganization Dialog */}
      <Dialog open={reorganizeDialogOpen} onOpenChange={setReorganizeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Reorganization Suggestions
            </DialogTitle>
            <DialogDescription>
              AI has analyzed your research ideas and suggests the following changes to the research git tree.
            </DialogDescription>
          </DialogHeader>
          {reorganizeSuggestions && (
            <div className="space-y-6 py-4">
              {reorganizeSuggestions.summary && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{reorganizeSuggestions.summary}</p>
                </div>
              )}

              {reorganizeSuggestions.promotions && reorganizeSuggestions.promotions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    Suggested Promotions ({reorganizeSuggestions.promotions.filter((_, i) => !rejectedSuggestions.has(i)).length})
                  </h4>
                  <div className="space-y-2">
                    {reorganizeSuggestions.promotions.map((promo, i) => {
                      if (rejectedSuggestions.has(i)) return null;
                      const isAccepted = acceptedSuggestions.has(i);
                      const isAccepting = acceptingSuggestion === i;

                      return (
                        <Card key={i} className={isAccepted ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">
                                {promo.suggestedTitle || promo.insight?.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {Math.round(promo.confidence * 100)}% confidence
                                </Badge>
                                {isAccepted && (
                                  <Badge className="bg-green-500">Accepted</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{promo.reasoning}</p>
                            {promo.suggestedParentId && (
                              <p className="text-xs mt-2">
                                <span className="text-muted-foreground">Link to: </span>
                                <Link href={`/challenge/${promo.suggestedParentId}`}>
                                  <span className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    {parentProblemTitles[promo.suggestedParentId] || promo.suggestedParentId}
                                  </span>
                                </Link>
                              </p>
                            )}
                            {!isAccepted && (
                              <div className="flex gap-2 mt-3 pt-3 border-t">
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptPromotion(promo, i)}
                                  disabled={isAccepting}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {isAccepting ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Accepting...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="h-3 w-3 mr-1" />
                                      Accept
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectSuggestion(i)}
                                  disabled={isAccepting}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {reorganizeSuggestions.newBranches && reorganizeSuggestions.newBranches.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-blue-500" />
                    Suggested New Branches ({reorganizeSuggestions.newBranches.length})
                  </h4>
                  <div className="space-y-2">
                    {reorganizeSuggestions.newBranches.map((branch, i) => (
                      <Card key={i}>
                        <CardContent className="p-3">
                          <span className="font-medium">{branch.title}</span>
                          <p className="text-sm text-muted-foreground mt-1">{branch.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{branch.reasoning}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {reorganizeSuggestions.duplicates && reorganizeSuggestions.duplicates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Potential Duplicates ({reorganizeSuggestions.duplicates.length})
                  </h4>
                  <div className="space-y-2">
                    {reorganizeSuggestions.duplicates.map((dup, i) => (
                      <Card key={i}>
                        <CardContent className="p-3">
                          <p className="text-sm">{dup.reasoning}</p>
                          <p className="text-xs mt-2">
                            <span className="text-muted-foreground">Similar to: </span>
                            <Link href={`/challenge/${dup.existingProblemId}`}>
                              <span className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                {parentProblemTitles[dup.existingProblemId] || dup.existingProblemId}
                              </span>
                            </Link>
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {reorganizeSuggestions.error && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                  <p className="text-sm text-destructive">{reorganizeSuggestions.error}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReorganizeDialogOpen(false)}>
              Close
            </Button>
            <Link href="/challenge-problems">
              <Button>
                <GitBranch className="h-4 w-4 mr-2" />
                View Challenge Problems
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
