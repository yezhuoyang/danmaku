import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DebateSession, DebateStatus, CreateDebateRequest } from "@shared/types";
import { DebateSetupDialog } from "@/components/debate";
import * as api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  MessageSquare,
  Play,
  Pause,
  CheckCircle2,
  Settings,
  Trash2,
  Scale,
  Bot,
  Clock,
  Trophy,
  Search,
} from "lucide-react";

const statusConfig: Record<DebateStatus, { label: string; color: string; icon: React.ReactNode }> = {
  setup: {
    label: "Setup",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: <Settings className="h-3 w-3" />,
  },
  active: {
    label: "Active",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: <Play className="h-3 w-3" />,
  },
  paused: {
    label: "Paused",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: <Pause className="h-3 w-3" />,
  },
  concluded: {
    label: "Concluded",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

export default function Debates() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { user } = useAuth();
  const [debates, setDebates] = useState<DebateSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get search query from URL
  const urlParams = new URLSearchParams(searchString);
  const initialQuery = urlParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  useEffect(() => {
    if (user) {
      loadDebates();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadDebates = async () => {
    try {
      const data = await api.getDebates();
      setDebates(data);
    } catch (error) {
      console.error("Failed to load debates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data: CreateDebateRequest) => {
    setIsCreating(true);
    try {
      const newDebate = await api.createDebate(data);
      setIsCreateOpen(false);
      setLocation(`/debate/${newDebate.id}`);
    } catch (error) {
      console.error("Failed to create debate:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.deleteDebate(deleteId);
      setDebates(debates.filter(d => d.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Failed to delete debate:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Filter debates based on search query
  const filteredDebates = useMemo(() => {
    if (!searchQuery.trim()) return debates;
    const query = searchQuery.toLowerCase();
    return debates.filter(
      (debate) =>
        debate.title.toLowerCase().includes(query) ||
        debate.topic.toLowerCase().includes(query) ||
        debate.affirmativeConfig.modelId.toLowerCase().includes(query) ||
        debate.negativeConfig.modelId.toLowerCase().includes(query) ||
        debate.judgeConfig.modelId.toLowerCase().includes(query)
    );
  }, [debates, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL with search query
    if (searchQuery.trim()) {
      setLocation(`/debates?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      setLocation("/debates");
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>
              Please sign in to create and manage AI debates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Scale className="h-8 w-8 text-purple-500" />
            AI Research Debates
          </h1>
          <p className="text-muted-foreground mt-1">
            Create multi-agent debates on research topics
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Debate
        </Button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search debates by title, topic, or model..."
            className="pl-10 pr-4"
          />
        </div>
      </form>

      {/* Debates List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : debates.length === 0 ? (
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No debates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI research debate to get started.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Debate
            </Button>
          </CardContent>
        </Card>
      ) : filteredDebates.length === 0 ? (
        <Card className="max-w-md mx-auto text-center">
          <CardContent className="pt-8 pb-8">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No matching debates</h3>
            <p className="text-muted-foreground mb-4">
              No debates found matching "{searchQuery}". Try a different search term.
            </p>
            <Button variant="outline" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDebates.map((debate) => {
            const status = statusConfig[debate.status];
            return (
              <Card
                key={debate.id}
                className="hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => setLocation(`/debate/${debate.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">
                      {debate.title}
                    </CardTitle>
                    <Badge className={status.color}>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1">
                    {debate.topic}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Agent models */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1 text-green-500" />
                      {debate.affirmativeConfig.modelId}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1 text-red-500" />
                      {debate.negativeConfig.modelId}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Scale className="h-3 w-3 mr-1 text-purple-500" />
                      {debate.judgeConfig.modelId}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {debate.turnCount}/{debate.maxTurns} turns
                    </span>
                    {debate.winner && (
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-yellow-500" />
                        {debate.winner === 'draw' ? 'Draw' :
                         debate.winner === 'affirmative' ? 'Pro wins' : 'Con wins'}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(debate.createdAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(debate.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <DebateSetupDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
        isLoading={isCreating}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this debate and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
