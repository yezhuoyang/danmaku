import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  HelpCircle,
  Lightbulb,
  Filter,
  ArrowLeft,
  Home,
  CheckCircle2,
  Clock,
  Tag,
  LayoutGrid,
  GitBranch,
  Sparkles,
  Loader2,
  Trophy,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ChallengeProblemCard } from "@/components/ChallengeProblemCard";
import { ResearchGitTree } from "@/components/ResearchGitTree";
import * as api from "@/lib/api";
import type {
  ChallengeProblem,
  ChallengeProblemType,
  ChallengeProblemStatus,
  CreateChallengeProblemRequest,
  PromotionSuggestion,
  ChallengeCurationJob,
} from "../../../shared/types";

export default function ChallengeProblems() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [problems, setProblems] = useState<ChallengeProblem[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Get initial search query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || "";

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<ChallengeProblemType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ChallengeProblemStatus | "all">("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "popular" | "most_discussed">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "tree">("grid");

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<ChallengeProblemType>("open_question");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createArea, setCreateArea] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createImportance, setCreateImportance] = useState<"high" | "medium" | "low" | "">("medium");
  const [creating, setCreating] = useState(false);

  // Research Idea specific fields
  const [createMethodology, setCreateMethodology] = useState("");
  const [createExpectedOutcome, setCreateExpectedOutcome] = useState("");
  const [createFeasibility, setCreateFeasibility] = useState<"high" | "medium" | "low" | "">("medium");
  const [createNovelty, setCreateNovelty] = useState<"incremental" | "moderate" | "breakthrough" | "">("moderate");

  // AI Curation
  const [curationDialogOpen, setCurationDialogOpen] = useState(false);
  const [curationLoading, setCurationLoading] = useState(false);
  const [curationSuggestions, setCurationSuggestions] = useState<PromotionSuggestion[]>([]);
  const [promotingIndex, setPromotingIndex] = useState<number | null>(null);

  // Fetch areas on mount
  useEffect(() => {
    api.getChallengeAreas()
      .then(({ areas: areaList }) => setAreas(areaList))
      .catch(console.error);
  }, []);

  // Fetch problems
  useEffect(() => {
    const fetchProblems = async () => {
      setLoading(true);
      try {
        const options: Parameters<typeof api.getChallengeProblems>[0] = {
          limit: 20,
          sort: sortBy === "most_discussed" ? "discussed" : sortBy,
        };
        if (searchQuery) options.q = searchQuery;
        if (typeFilter !== "all") options.type = typeFilter;
        if (statusFilter !== "all") options.status = statusFilter;
        if (areaFilter !== "all") options.area = areaFilter;

        const { problems: data, total: t } = await api.getChallengeProblems(options);
        setProblems(data);
        setTotal(t);
      } catch (error) {
        console.error("Failed to fetch problems:", error);
        toast.error("Failed to load challenge problems");
      } finally {
        setLoading(false);
      }
    };

    fetchProblems();
  }, [searchQuery, typeFilter, statusFilter, areaFilter, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    setCreating(true);
    try {
      const request: CreateChallengeProblemRequest = {
        type: createType,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        area: createArea.trim() || undefined,
        tags: createTags ? createTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
        importance: createImportance || undefined,
      };

      // Add research idea specific fields
      if (createType === "research_idea") {
        if (createMethodology) request.methodology = createMethodology.trim();
        if (createExpectedOutcome) request.expectedOutcome = createExpectedOutcome.trim();
        if (createFeasibility) request.feasibility = createFeasibility as 'high' | 'medium' | 'low';
        if (createNovelty) request.novelty = createNovelty as 'incremental' | 'moderate' | 'breakthrough';
      }

      const { problem } = await api.createChallengeProblem(request);
      toast.success("Challenge problem created!");
      setCreateDialogOpen(false);
      // Reset form
      setCreateTitle("");
      setCreateDescription("");
      setCreateArea("");
      setCreateTags("");
      setCreateImportance("medium");
      setCreateMethodology("");
      setCreateExpectedOutcome("");
      setCreateFeasibility("medium");
      setCreateNovelty("moderate");
      // Navigate to the new problem
      setLocation(`/challenge/${problem.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create challenge problem");
    } finally {
      setCreating(false);
    }
  };

  // AI Curation handlers
  const handleRunCuration = async () => {
    setCurationLoading(true);
    setCurationDialogOpen(true);
    try {
      const { suggestions } = await api.getPromotionSuggestions({ limit: 20 });
      setCurationSuggestions(suggestions);
      if (suggestions.length === 0) {
        toast.info("No new suggestions found. Generate more research ideas first!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to run AI curation");
    } finally {
      setCurationLoading(false);
    }
  };

  const handlePromoteSuggestion = async (suggestion: PromotionSuggestion, index: number) => {
    setPromotingIndex(index);
    try {
      await api.promoteIdeaToChallenge({
        historyId: suggestion.historyId,
        ideaId: suggestion.ideaId,
        title: suggestion.title,
        description: suggestion.description,
        type: 'research_idea',
      });
      toast.success("Promoted to Challenge Problems!");
      // Remove from suggestions
      setCurationSuggestions(prev => prev.filter((_, i) => i !== index));
      // Refresh the problems list
      const { problems: data, total: t } = await api.getChallengeProblems({ limit: 20 });
      setProblems(data);
      setTotal(t);
    } catch (error: any) {
      toast.error(error.message || "Failed to promote suggestion");
    } finally {
      setPromotingIndex(null);
    }
  };

  const questionCount = problems.filter(p => p.type === "open_question").length;
  const ideaCount = problems.filter(p => p.type === "research_idea").length;
  const solvedCount = problems.filter(p => p.status === "solved").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold">Challenge Problems</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Navigation to AI-generated insights */}
            <Link href="/open-questions">
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-4 w-4 mr-2" />
                Open Questions
              </Button>
            </Link>
            <Link href="/research-ideas">
              <Button variant="ghost" size="sm">
                <Lightbulb className="h-4 w-4 mr-2" />
                Research Ideas
              </Button>
            </Link>

            {/* AI Curation Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunCuration}
              disabled={curationLoading}
            >
              {curationLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              AI Curation
            </Button>

            {user && (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Problem
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Challenge Problem</DialogTitle>
                    <DialogDescription>
                      Post a research question or idea for the community to explore.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {/* Type Selection */}
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={createType === "open_question" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCreateType("open_question")}
                          className="flex-1"
                        >
                          <HelpCircle className="h-4 w-4 mr-2" />
                          Open Question
                        </Button>
                        <Button
                          variant={createType === "research_idea" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCreateType("research_idea")}
                          className="flex-1"
                        >
                          <Lightbulb className="h-4 w-4 mr-2" />
                          Research Idea
                        </Button>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        placeholder={createType === "open_question"
                          ? "What is the fundamental limit of...?"
                          : "A novel approach to solving..."}
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={createDescription}
                        onChange={(e) => setCreateDescription(e.target.value)}
                        placeholder="Provide context and details about this problem..."
                        rows={4}
                      />
                    </div>

                    {/* Research Idea specific fields */}
                    {createType === "research_idea" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="methodology">Proposed Methodology</Label>
                          <Textarea
                            id="methodology"
                            value={createMethodology}
                            onChange={(e) => setCreateMethodology(e.target.value)}
                            placeholder="How would you approach this problem?"
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="expectedOutcome">Expected Outcome</Label>
                          <Textarea
                            id="expectedOutcome"
                            value={createExpectedOutcome}
                            onChange={(e) => setCreateExpectedOutcome(e.target.value)}
                            placeholder="What results do you expect?"
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Feasibility</Label>
                            <Select value={createFeasibility} onValueChange={(v) => setCreateFeasibility(v as any)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select feasibility" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Novelty Level</Label>
                            <Select value={createNovelty} onValueChange={(v) => setCreateNovelty(v as any)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select novelty" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="incremental">Incremental</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="breakthrough">Breakthrough</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Area and Tags */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="area">Research Area</Label>
                        <Input
                          id="area"
                          value={createArea}
                          onChange={(e) => setCreateArea(e.target.value)}
                          placeholder="e.g., Quantum Computing"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Importance</Label>
                        <Select value={createImportance} onValueChange={(v) => setCreateImportance(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select importance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        value={createTags}
                        onChange={(e) => setCreateTags(e.target.value)}
                        placeholder="machine learning, transformers, attention"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={creating || !createTitle.trim()}>
                      {creating ? "Creating..." : "Create Problem"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-xs text-muted-foreground">Total Problems</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{ideaCount}</p>
                  <p className="text-xs text-muted-foreground">Research Ideas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{total - solvedCount}</p>
                  <p className="text-xs text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{solvedCount}</p>
                  <p className="text-xs text-muted-foreground">Solved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search challenge problems..."
                className="pl-10"
              />
            </div>
          </form>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="open_question">Questions</SelectItem>
                <SelectItem value="research_idea">Ideas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unsolved">Unsolved</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="most_discussed">Most Discussed</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "tree" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9"
                onClick={() => setViewMode("tree")}
              >
                <GitBranch className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Problems Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-3" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : problems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Challenge Problems Yet</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all" || statusFilter !== "all" || areaFilter !== "all"
                  ? "No problems match your filters. Try adjusting your search criteria."
                  : "Be the first to post a research question or idea!"}
              </p>
              {user && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Problem
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "tree" ? (
          <ResearchGitTree
            problems={problems}
            title={`Research Problems (${total})`}
            onSelectProblem={(id) => setLocation(`/challenge/${id}`)}
            showCrossPaperLinks={true}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {problems.map((problem) => (
              <ChallengeProblemCard key={problem.id} problem={problem} />
            ))}
          </div>
        )}

        {/* Areas Sidebar (shown as tags on mobile) */}
        {areas.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Research Areas
            </h3>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <Badge
                  key={area}
                  variant={areaFilter === area ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setAreaFilter(areaFilter === area ? "all" : area)}
                >
                  {area}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* AI Curation Dialog */}
      <Dialog open={curationDialogOpen} onOpenChange={setCurationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI-Suggested Challenge Problems
            </DialogTitle>
            <DialogDescription>
              The AI has analyzed open questions and research ideas from all papers and suggests
              the following items for promotion to Challenge Problems.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {curationLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Analyzing research ideas...</p>
              </div>
            ) : curationSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-medium">No New Suggestions</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate more open questions or research ideas in papers to see AI suggestions here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {curationSuggestions.length} suggestions found. Click "Promote" to add to Challenge Problems.
                </p>
                {curationSuggestions.map((suggestion, index) => (
                  <Card key={suggestion.ideaId} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              Score: {Math.round(suggestion.score * 100)}%
                            </Badge>
                            {suggestion.paperTitle && (
                              <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                                {suggestion.paperTitle}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium text-sm mb-1 line-clamp-2">{suggestion.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {suggestion.description}
                          </p>
                          {suggestion.reasoning && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic">
                              AI: {suggestion.reasoning}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePromoteSuggestion(suggestion, index)}
                          disabled={promotingIndex === index}
                          className="flex-shrink-0"
                        >
                          {promotingIndex === index ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trophy className="h-3 w-3 mr-1" />
                              Promote
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCurationDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
