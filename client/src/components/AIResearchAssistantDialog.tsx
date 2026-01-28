import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Search,
  Loader2,
  ExternalLink,
  Calendar,
  Quote,
  Check,
  LogIn,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RotateCcw,
  Brain,
  Lightbulb,
  Target,
  Coins,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "../lib/api";
import type { AICuratedPaper, AISearchResponse } from "../lib/api";
import type { PaperWithStats } from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";

interface AIResearchAssistantDialogProps {
  onPapersAdded?: (papers: PaperWithStats[]) => void;
}

// AI-curated paper card with relevance reasoning
function CuratedPaperCard({
  curatedPaper,
  isSelected,
  onToggle,
  isAdding,
}: {
  curatedPaper: AICuratedPaper;
  isSelected: boolean;
  onToggle: () => void;
  isAdding?: boolean;
}) {
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const paper = curatedPaper.paper;

  return (
    <div
      className={`p-3 rounded-lg border transition-colors ${
        isSelected
          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
          : "border-border hover:border-indigo-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          disabled={isAdding}
          className="mt-1"
        />
        <div className="flex-1 min-w-0">
          {/* Relevance score badge */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs ${
                  curatedPaper.relevanceScore >= 8
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                    : curatedPaper.relevanceScore >= 6
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                <Target className="h-3 w-3 mr-1" />
                Relevance: {curatedPaper.relevanceScore}/10
              </Badge>
            </div>
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-indigo-500 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Title */}
          <h4 className="font-medium text-sm line-clamp-2">{paper.title}</h4>

          {/* Authors */}
          <p className="text-xs text-muted-foreground mt-1">
            {paper.authors.slice(0, 3).join(", ")}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
          </p>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 mt-2">
            {paper.year && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                {paper.year}
              </Badge>
            )}
            {paper.citationCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Quote className="h-3 w-3" />
                {paper.citationCount} citations
              </Badge>
            )}
            {paper.venue && (
              <Badge variant="outline" className="text-xs truncate max-w-[150px]">
                {paper.venue}
              </Badge>
            )}
            {paper.arxivId && (
              <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                arXiv:{paper.arxivId}
              </Badge>
            )}
            {paper.isOpenAccess && (
              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Open Access
              </Badge>
            )}
          </div>

          {/* Matched aspects */}
          {curatedPaper.matchedAspects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {curatedPaper.matchedAspects.map((aspect, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-indigo-50 dark:bg-indigo-950/50">
                  {aspect}
                </Badge>
              ))}
            </div>
          )}

          {/* AI reasoning */}
          <div className="mt-2 p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {curatedPaper.reasoning}
              </p>
            </div>
          </div>

          {/* Abstract */}
          {paper.abstract && (
            <div className="mt-2">
              <p
                className={`text-xs text-muted-foreground ${
                  showFullAbstract ? "" : "line-clamp-2"
                }`}
              >
                {paper.abstract}
              </p>
              {paper.abstract.length > 200 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullAbstract(!showFullAbstract);
                  }}
                  className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1"
                >
                  {showFullAbstract ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Show more
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIResearchAssistantDialog({
  onPapersAdded,
}: AIResearchAssistantDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [researchIdea, setResearchIdea] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("gpt-4o");
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchResponse, setSearchResponse] = useState<AISearchResponse | null>(null);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());

  // Load saved API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("ai-research-assistant-api-key");
    const savedModel = localStorage.getItem("ai-research-assistant-model");
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModelId(savedModel);
  }, []);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchResponse(null);
      setSelectedPapers(new Set());
    }
  }, [open]);

  // If not logged in, show login prompt
  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
            <Bot className="h-4 w-4" />
            AI Research Assistant
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              Please log in to use the AI Research Assistant.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Link href="/login">
              <Button className="w-full" onClick={() => setOpen(false)}>
                <LogIn className="h-4 w-4 mr-2" />
                Log In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="w-full" onClick={() => setOpen(false)}>
                Create Account
              </Button>
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSearch = async () => {
    if (!researchIdea.trim()) {
      toast.error("Please describe your research idea");
      return;
    }

    if (!apiKey.trim()) {
      toast.error("Please enter your API key");
      return;
    }

    // Save API key and model to localStorage
    localStorage.setItem("ai-research-assistant-api-key", apiKey);
    localStorage.setItem("ai-research-assistant-model", modelId);

    setIsSearching(true);
    setSearchResponse(null);
    setSelectedPapers(new Set());

    try {
      const result = await api.aiPaperSearch({
        researchIdea: researchIdea.trim(),
        apiKey,
        modelId,
        maxPapers: 10,
      });

      setSearchResponse(result);

      if (result.papers.length === 0) {
        toast.info(result.message || "No relevant papers found. Try rephrasing your research idea.");
      } else {
        toast.success(`Found ${result.papers.length} relevant papers`);
      }
    } catch (error: any) {
      console.error("AI search error:", error);
      if (error.message?.includes("API")) {
        toast.error(error.message);
      } else {
        toast.error("Failed to search papers. Please check your API key and try again.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleRetry = () => {
    setSearchResponse(null);
    setSelectedPapers(new Set());
  };

  const togglePaperSelection = (paperId: string) => {
    setSelectedPapers((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (searchResponse?.papers) {
      setSelectedPapers(new Set(searchResponse.papers.map((p) => p.paper.semanticScholarId)));
    }
  };

  const deselectAll = () => {
    setSelectedPapers(new Set());
  };

  const handleAddSelected = async () => {
    if (!searchResponse || selectedPapers.size === 0) {
      toast.error("Please select at least one paper");
      return;
    }

    const papersToAdd = searchResponse.papers
      .filter((p) => selectedPapers.has(p.paper.semanticScholarId))
      .map((p) => ({
        arxivId: p.paper.arxivId || undefined,
        title: p.paper.title,
        authors: p.paper.authors,
        abstract: p.paper.abstract || undefined,
      }));

    setIsAdding(true);
    try {
      const result = await api.batchAddPapers(papersToAdd);

      const added = result.summary.added;
      const existing = result.summary.existing;
      const errors = result.summary.errors;

      if (added > 0) {
        toast.success(`Added ${added} new paper${added > 1 ? "s" : ""}`);
      }
      if (existing > 0) {
        toast.info(`${existing} paper${existing > 1 ? "s" : ""} already exist${existing === 1 ? "s" : ""}`);
      }
      if (errors > 0) {
        toast.warning(`${errors} paper${errors > 1 ? "s" : ""} failed to add`);
      }

      // Collect successfully added papers
      const addedPapers = result.results
        .filter((r): r is { paper: PaperWithStats; isNew: boolean } => "paper" in r)
        .map((r) => r.paper);

      if (addedPapers.length > 0) {
        onPapersAdded?.(addedPapers);
      }

      // Close dialog if all added successfully
      if (errors === 0) {
        setOpen(false);
      }
    } catch (error) {
      toast.error("Failed to add papers");
      console.error(error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
          <Bot className="h-4 w-4" />
          AI Research Assistant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            AI Research Assistant
          </DialogTitle>
          <DialogDescription>
            Describe your research idea and let AI find the most relevant papers with reasoning
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Input Section */}
          {!searchResponse && (
            <div className="space-y-4">
              {/* Research Idea Input */}
              <div className="space-y-2">
                <Label htmlFor="research-idea">Research Idea / Problem</Label>
                <Textarea
                  id="research-idea"
                  placeholder="Describe your research idea or the problem you want to solve...&#10;&#10;Example: I want to develop a more efficient attention mechanism for transformer models that reduces computational complexity while maintaining accuracy for long-sequence tasks."
                  value={researchIdea}
                  onChange={(e) => setResearchIdea(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* API Key and Model Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Enter your OpenAI/Anthropic API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your key is stored locally and never sent to our servers
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEFAULT_AI_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                disabled={isSearching || !researchIdea.trim() || !apiKey.trim()}
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    AI is analyzing and searching...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Find Relevant Papers
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results Section */}
          {searchResponse && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* AI Analysis Summary */}
              <div className="space-y-3 mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 text-indigo-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm">AI Analysis</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {searchResponse.analysis}
                    </p>
                  </div>
                </div>

                {/* Key Aspects */}
                <div className="flex flex-wrap gap-1.5">
                  {searchResponse.keyAspects.map((aspect, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {aspect}
                    </Badge>
                  ))}
                </div>

                {/* Search Queries Used */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {searchResponse.searchQueries.length} search queries used
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {searchResponse.searchQueries.map((sq, i) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium">"{sq.query}"</span>
                        <span className="ml-2 text-slate-400">- {sq.rationale}</span>
                      </li>
                    ))}
                  </ul>
                </details>

                {/* Token usage */}
                {searchResponse.tokensUsed && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Coins className="h-3 w-3" />
                    {searchResponse.tokensUsed.toLocaleString()} tokens used
                    {searchResponse.papersAnalyzed && (
                      <span className="ml-2">| {searchResponse.papersAnalyzed} papers analyzed</span>
                    )}
                  </div>
                )}
              </div>

              {/* Papers List */}
              {searchResponse.papers.length > 0 ? (
                <>
                  {/* Selection controls */}
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {selectedPapers.size} of {searchResponse.papers.length} selected
                      </span>
                      <Button variant="ghost" size="sm" onClick={selectAll}>
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={deselectAll}>
                        Deselect All
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1">
                      <RotateCcw className="h-3 w-3" />
                      Try Again
                    </Button>
                  </div>

                  {/* Paper list */}
                  <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="space-y-2 pb-2">
                      {searchResponse.papers.map((curatedPaper) => (
                        <CuratedPaperCard
                          key={curatedPaper.paper.semanticScholarId}
                          curatedPaper={curatedPaper}
                          isSelected={selectedPapers.has(curatedPaper.paper.semanticScholarId)}
                          onToggle={() => togglePaperSelection(curatedPaper.paper.semanticScholarId)}
                          isAdding={isAdding}
                        />
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Add button */}
                  <div className="pt-3 border-t mt-2">
                    <Button
                      onClick={handleAddSelected}
                      disabled={selectedPapers.size === 0 || isAdding}
                      className="w-full"
                    >
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Add {selectedPapers.size} Paper{selectedPapers.size !== 1 ? "s" : ""} to Platform
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                  <AlertCircle className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-muted-foreground mb-2">
                    {searchResponse.message || "No relevant papers found for your research idea."}
                  </p>
                  <Button variant="outline" onClick={handleRetry} className="mt-2">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try with Different Keywords
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
