import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Lightbulb,
  Link as LinkIcon,
  Plus,
  Search,
  X,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import * as api from "@/lib/api";
import type {
  ChallengeIdeaLink,
  ChallengeProblem,
  IdeaLinkRelationship,
} from "../../../shared/types";

const RELATIONSHIP_LABELS: Record<IdeaLinkRelationship, { label: string; color: string }> = {
  addresses: {
    label: 'Addresses',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  partial: {
    label: 'Partially Addresses',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  inspired_by: {
    label: 'Inspired By',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

interface LinkedIdeasPanelProps {
  questionId: string;
  currentUserId?: string;
  onUpdate?: () => void;
}

export function LinkedIdeasPanel({ questionId, currentUserId, onUpdate }: LinkedIdeasPanelProps) {
  const [links, setLinks] = useState<ChallengeIdeaLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Search for ideas to link
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChallengeProblem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<ChallengeProblem | null>(null);
  const [relationship, setRelationship] = useState<IdeaLinkRelationship>("addresses");
  const [notes, setNotes] = useState("");
  const [linking, setLinking] = useState(false);

  // Fetch linked ideas
  useEffect(() => {
    setLoading(true);
    api.getLinkedIdeas(questionId)
      .then(({ links }) => setLinks(links))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [questionId]);

  // Search for ideas
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setSearching(true);
      try {
        const { problems } = await api.getChallengeProblems({
          q: searchQuery,
          type: 'research_idea',
          limit: 10,
        });
        // Filter out already linked ideas
        const linkedIds = new Set(links.map(l => l.ideaId));
        setSearchResults(problems.filter(p => !linkedIds.has(p.id)));
      } catch (error) {
        console.error("Failed to search ideas:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, links]);

  const handleLink = async () => {
    if (!selectedIdea) return;

    setLinking(true);
    try {
      await api.linkIdeaToQuestion(questionId, {
        ideaId: selectedIdea.id,
        relationship,
        notes: notes.trim() || undefined,
      });
      toast.success("Idea linked successfully!");
      // Refresh links
      const { links: newLinks } = await api.getLinkedIdeas(questionId);
      setLinks(newLinks);
      // Reset form
      setDialogOpen(false);
      setSearchQuery("");
      setSelectedIdea(null);
      setRelationship("addresses");
      setNotes("");
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to link idea");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      await api.removeIdeaLink(questionId, linkId);
      toast.success("Link removed");
      setLinks(links.filter(l => l.id !== linkId));
      onUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove link");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-purple-500" />
            Linked Research Ideas
            <Badge variant="secondary" className="text-xs">
              {links.length}
            </Badge>
          </CardTitle>

          {currentUserId && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-3 w-3 mr-1" />
                  Link Idea
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Link Research Idea</DialogTitle>
                  <DialogDescription>
                    Connect a research idea that addresses or relates to this question.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Search for ideas */}
                  <div className="space-y-2">
                    <Label>Search Research Ideas</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by title or description..."
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Search results */}
                  {searchQuery && (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      {searching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No research ideas found
                        </div>
                      ) : (
                        <div className="divide-y">
                          {searchResults.map((idea) => (
                            <button
                              key={idea.id}
                              className={`w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                selectedIdea?.id === idea.id
                                  ? "bg-indigo-50 dark:bg-indigo-900/20"
                                  : ""
                              }`}
                              onClick={() => setSelectedIdea(idea)}
                            >
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {idea.title}
                                  </p>
                                  {idea.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {idea.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected idea */}
                  {selectedIdea && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">{selectedIdea.title}</p>
                            <p className="text-xs text-muted-foreground">
                              by {selectedIdea.userName}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedIdea(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Relationship */}
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Select value={relationship} onValueChange={(v) => setRelationship(v as IdeaLinkRelationship)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="addresses">Directly Addresses</SelectItem>
                        <SelectItem value="partial">Partially Addresses</SelectItem>
                        <SelectItem value="inspired_by">Inspired By</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Explain how this idea relates to the question..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleLink} disabled={!selectedIdea || linking}>
                    {linking ? "Linking..." : "Link Idea"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No research ideas linked yet</p>
            {currentUserId && (
              <p className="text-xs mt-1">
                Link ideas that address this question
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Lightbulb className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/challenge/${link.ideaId}`}>
                          <span className="text-sm font-medium hover:text-indigo-600 dark:hover:text-indigo-400 truncate">
                            {link.idea?.title || "Research Idea"}
                          </span>
                        </Link>
                        <Badge className={`text-xs ${RELATIONSHIP_LABELS[link.relationship].color}`}>
                          {RELATIONSHIP_LABELS[link.relationship].label}
                        </Badge>
                      </div>
                      {link.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {link.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Avatar className="w-4 h-4">
                          <AvatarFallback className="text-[8px]">
                            {link.userName?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>Linked by {link.userName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link href={`/challenge/${link.ideaId}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                    {currentUserId === link.userId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        onClick={() => handleUnlink(link.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
