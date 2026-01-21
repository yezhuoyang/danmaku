import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, FileText, X, Link as LinkIcon } from "lucide-react";
import * as api from "@/lib/api";
import type { PaperWithStats } from "../../../shared/types";

interface LinkPaperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPaperId?: string;
  currentPaperTitle?: string;
  onLinkPaper: (paperId: string) => Promise<void>;
  onUnlinkPaper: () => Promise<void>;
}

export function LinkPaperDialog({
  open,
  onOpenChange,
  currentPaperId,
  currentPaperTitle,
  onLinkPaper,
  onUnlinkPaper,
}: LinkPaperDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PaperWithStats[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  // Search for papers
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearching(true);
      try {
        const { papers } = await api.listPapers({ q: searchQuery, limit: 10 });
        setSearchResults(papers);
      } catch (error) {
        console.error("Failed to search papers:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleLinkPaper = async (paperId: string) => {
    setLinking(true);
    try {
      await onLinkPaper(paperId);
      toast.success("Paper linked successfully!");
      onOpenChange(false);
      setSearchQuery("");
    } catch (error: any) {
      toast.error(error.message || "Failed to link paper");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkPaper = async () => {
    setLinking(true);
    try {
      await onUnlinkPaper();
      toast.success("Paper unlinked");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to unlink paper");
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link Paper to Question
          </DialogTitle>
          <DialogDescription>
            Connect a research paper that is related to this question.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current linked paper */}
          {currentPaperId && currentPaperTitle && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Currently linked:</p>
                    <p className="text-sm text-muted-foreground">{currentPaperTitle}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-500 hover:text-red-600"
                  onClick={handleUnlinkPaper}
                  disabled={linking}
                >
                  <X className="h-4 w-4 mr-1" />
                  Unlink
                </Button>
              </div>
            </div>
          )}

          {/* Search for papers */}
          <div className="space-y-2">
            <Label>Search Papers</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or arXiv ID..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Search results */}
          {searchQuery && (
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {searching ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No papers found
                </div>
              ) : (
                <div className="divide-y">
                  {searchResults.map((paper) => (
                    <button
                      key={paper.id}
                      className={`w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        paper.id === currentPaperId
                          ? "bg-indigo-50 dark:bg-indigo-900/20"
                          : ""
                      }`}
                      onClick={() => handleLinkPaper(paper.id)}
                      disabled={linking || paper.id === currentPaperId}
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">
                            {paper.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {paper.authors.slice(0, 3).join(", ")}
                            {paper.authors.length > 3 && " et al."}
                          </p>
                          {paper.arxivId && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                              arXiv:{paper.arxivId}
                            </p>
                          )}
                        </div>
                        {paper.id === currentPaperId && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400">
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
