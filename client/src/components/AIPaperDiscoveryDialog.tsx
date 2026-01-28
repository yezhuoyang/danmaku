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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Search,
  TrendingUp,
  Users,
  Loader2,
  ExternalLink,
  BookOpen,
  Calendar,
  Quote,
  Check,
  LogIn,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "../lib/api";
import type { DiscoveredPaper } from "../lib/api";
import type { PaperWithStats } from "../../../shared/types";

interface AIPaperDiscoveryDialogProps {
  onPapersAdded?: (papers: PaperWithStats[]) => void;
  relatedToPaperId?: string;
  relatedToPaperTitle?: string;
}

// Paper result card component
function DiscoveredPaperCard({
  paper,
  isSelected,
  onToggle,
  isAdding,
}: {
  paper: DiscoveredPaper;
  isSelected: boolean;
  onToggle: () => void;
  isAdding?: boolean;
}) {
  const [showFullAbstract, setShowFullAbstract] = useState(false);

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
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm line-clamp-2">{paper.title}</h4>
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

          <p className="text-xs text-muted-foreground mt-1">
            {paper.authors.slice(0, 3).join(", ")}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
          </p>

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

export function AIPaperDiscoveryDialog({
  onPapersAdded,
  relatedToPaperId,
  relatedToPaperTitle,
}: AIPaperDiscoveryDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingTopic, setTrendingTopic] = useState("machine learning");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [papers, setPapers] = useState<DiscoveredPaper[]>([]);
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState(relatedToPaperId ? "related" : "search");
  const [relationType, setRelationType] = useState<"recommendations" | "citations" | "references">(
    "recommendations"
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPapers([]);
      setSelectedPapers(new Set());
      setOffset(0);
      setHasMore(false);
      setSearchQuery("");
    }
  }, [open]);

  // If not logged in, show login prompt
  if (!user) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Discover
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Login Required</DialogTitle>
            <DialogDescription>
              Please log in to discover and add papers.
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
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setIsLoading(true);
    setPapers([]);
    setOffset(0);
    setSelectedPapers(new Set());

    try {
      const result = await api.discoverPapers({
        q: searchQuery.trim(),
        limit: 10,
        offset: 0,
      });
      setPapers(result.papers);
      setHasMore(result.hasMore);
      setOffset(result.offset + result.papers.length);

      if (result.papers.length === 0) {
        toast.info("No papers found. Try different keywords.");
      }
    } catch (error) {
      toast.error("Failed to search papers");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoading) return;

    setIsLoading(true);
    try {
      const result = await api.discoverPapers({
        q: searchQuery.trim(),
        limit: 10,
        offset,
      });
      setPapers((prev) => [...prev, ...result.papers]);
      setHasMore(result.hasMore);
      setOffset(result.offset + result.papers.length);
    } catch (error) {
      toast.error("Failed to load more papers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetTrending = async () => {
    setIsLoading(true);
    setPapers([]);
    setSelectedPapers(new Set());

    try {
      const result = await api.getTrendingPapers({
        topic: trendingTopic,
        limit: 15,
      });
      setPapers(result.papers);
      setHasMore(false);

      if (result.papers.length === 0) {
        toast.info("No trending papers found for this topic.");
      }
    } catch (error) {
      toast.error("Failed to get trending papers");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetRelated = async () => {
    if (!relatedToPaperId) return;

    setIsLoading(true);
    setPapers([]);
    setSelectedPapers(new Set());

    try {
      const result = await api.getRelatedPapers(relatedToPaperId, relationType, 15);
      setPapers(result.papers);
      setHasMore(false);

      if (result.papers.length === 0) {
        toast.info("No related papers found. The paper may not be indexed in Semantic Scholar.");
      }
    } catch (error) {
      toast.error("Failed to get related papers");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
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
    setSelectedPapers(new Set(papers.map((p) => p.semanticScholarId)));
  };

  const deselectAll = () => {
    setSelectedPapers(new Set());
  };

  const handleAddSelected = async () => {
    if (selectedPapers.size === 0) {
      toast.error("Please select at least one paper");
      return;
    }

    const papersToAdd = papers
      .filter((p) => selectedPapers.has(p.semanticScholarId))
      .map((p) => ({
        arxivId: p.arxivId || undefined,
        title: p.title,
        authors: p.authors,
        abstract: p.abstract || undefined,
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

      // Clear selection and close dialog if all added
      if (errors === 0) {
        setOpen(false);
      } else {
        // Only deselect successfully added papers
        const successIds = new Set(
          papers
            .filter((p) => {
              const resultItem = result.results.find((r) =>
                "paper" in r && r.paper.title === p.title
              );
              return resultItem && "paper" in resultItem;
            })
            .map((p) => p.semanticScholarId)
        );
        setSelectedPapers((prev) => {
          const next = new Set(prev);
          successIds.forEach((id) => next.delete(id));
          return next;
        });
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
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Discover
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500" />
            AI Paper Discovery
          </DialogTitle>
          <DialogDescription>
            Search for papers using Semantic Scholar's AI-powered search
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className={`grid w-full ${relatedToPaperId ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="trending" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Trending
            </TabsTrigger>
            {relatedToPaperId && (
              <TabsTrigger value="related" className="gap-2">
                <Users className="h-4 w-4" />
                Related
              </TabsTrigger>
            )}
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="space-y-2 mb-4">
              <Label htmlFor="search-query">Search Query</Label>
              <div className="flex gap-2">
                <Input
                  id="search-query"
                  placeholder="e.g., transformer attention mechanism, BERT language model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isLoading || !searchQuery.trim()}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {papers.length > 0 && (
              <PaperResults
                papers={papers}
                selectedPapers={selectedPapers}
                onToggle={togglePaperSelection}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onAddSelected={handleAddSelected}
                onLoadMore={hasMore ? loadMore : undefined}
                isLoading={isLoading}
                isAdding={isAdding}
              />
            )}
          </TabsContent>

          {/* Trending Tab */}
          <TabsContent value="trending" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="space-y-2 mb-4">
              <Label htmlFor="trending-topic">Topic</Label>
              <div className="flex gap-2">
                <Input
                  id="trending-topic"
                  placeholder="e.g., machine learning, computer vision..."
                  value={trendingTopic}
                  onChange={(e) => setTrendingTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGetTrending()}
                />
                <Button onClick={handleGetTrending} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get trending papers from the past two years, sorted by citation count
              </p>
            </div>

            {papers.length > 0 && (
              <PaperResults
                papers={papers}
                selectedPapers={selectedPapers}
                onToggle={togglePaperSelection}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                onAddSelected={handleAddSelected}
                isLoading={isLoading}
                isAdding={isAdding}
              />
            )}
          </TabsContent>

          {/* Related Tab */}
          {relatedToPaperId && (
            <TabsContent value="related" className="flex-1 flex flex-col min-h-0 mt-4">
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">Finding papers related to:</p>
                  <p className="font-medium text-sm line-clamp-2">{relatedToPaperTitle}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={relationType === "recommendations" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRelationType("recommendations")}
                    className="flex-1"
                  >
                    Recommended
                  </Button>
                  <Button
                    variant={relationType === "citations" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRelationType("citations")}
                    className="flex-1"
                  >
                    Cited By
                  </Button>
                  <Button
                    variant={relationType === "references" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRelationType("references")}
                    className="flex-1"
                  >
                    References
                  </Button>
                </div>

                <Button onClick={handleGetRelated} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <BookOpen className="h-4 w-4 mr-2" />
                  )}
                  Find {relationType === "recommendations" ? "Recommended" : relationType === "citations" ? "Citing" : "Referenced"} Papers
                </Button>
              </div>

              {papers.length > 0 && (
                <PaperResults
                  papers={papers}
                  selectedPapers={selectedPapers}
                  onToggle={togglePaperSelection}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  onAddSelected={handleAddSelected}
                  isLoading={isLoading}
                  isAdding={isAdding}
                />
              )}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Paper results list component
function PaperResults({
  papers,
  selectedPapers,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onAddSelected,
  onLoadMore,
  isLoading,
  isAdding,
}: {
  papers: DiscoveredPaper[];
  selectedPapers: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddSelected: () => void;
  onLoadMore?: () => void;
  isLoading?: boolean;
  isAdding?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Selection controls */}
      <div className="flex items-center justify-between mb-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {selectedPapers.size} of {papers.length} selected
          </span>
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeselectAll}>
            Deselect All
          </Button>
        </div>
      </div>

      {/* Paper list */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-2 pb-2">
          {papers.map((paper) => (
            <DiscoveredPaperCard
              key={paper.semanticScholarId}
              paper={paper}
              isSelected={selectedPapers.has(paper.semanticScholarId)}
              onToggle={() => onToggle(paper.semanticScholarId)}
              isAdding={isAdding}
            />
          ))}

          {onLoadMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Load More
            </Button>
          )}
        </div>
      </ScrollArea>

      {/* Add button */}
      <div className="pt-3 border-t mt-2">
        <Button
          onClick={onAddSelected}
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
    </div>
  );
}
