import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Bot,
  Search,
  Trash2,
  ExternalLink,
  Calendar,
  Key,
  MessageCircle,
  Zap,
  Eye,
  EyeOff,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type { AiSessionWithPaper } from "../lib/api";
import { toast } from "sonner";

export default function MyAiSessions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [sessions, setSessions] = useState<AiSessionWithPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    loadSessions();
  }, [user]);

  async function loadSessions() {
    try {
      const { sessions: data } = await api.getMyAiSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load AI sessions:", error);
      toast.error("Failed to load AI sessions");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      await api.deleteMyAiSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success("AI session deleted");
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete session");
    }
  }

  // Filter sessions by search query
  const filteredSessions = sessions.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.paperTitle.toLowerCase().includes(query) ||
      s.title.toLowerCase().includes(query)
    );
  });

  // Format token count
  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  // Calculate token usage percentage
  const getTokenUsagePercent = (session: AiSessionWithPaper) => {
    const totalUsed = session.totalPromptTokens + session.totalCompletionTokens;
    return Math.min((totalUsed / session.maxContextTokens) * 100, 100);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/profile/${user.id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Profile
              </Button>
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5" />
              My AI Sessions
            </h1>
          </div>
          <Badge variant="secondary">{sessions.length} total</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sessions by paper title or session name..."
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No AI sessions yet</p>
              <p className="text-muted-foreground mt-2">
                Start reading papers and create AI sessions to see them here.
              </p>
              <Link href="/browse">
                <Button className="mt-4">Browse Papers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No matching sessions</p>
              <p className="text-muted-foreground mt-2">
                Try a different search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((session) => {
              const tokenUsagePercent = getTokenUsagePercent(session);
              const totalTokens = session.totalPromptTokens + session.totalCompletionTokens;
              const hasAnalysis = session.sentenceAnalysis && Object.keys(session.sentenceAnalysis).length > 0;

              return (
                <Card key={session.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bot className="w-4 h-4 text-muted-foreground" />
                          {session.title}
                        </CardTitle>
                        <Link href={`/paper/${session.paperId}`}>
                          <p className="text-sm text-muted-foreground mt-1 hover:text-primary cursor-pointer">
                            {session.paperTitle}
                            {session.paperArxivId && ` (arXiv:${session.paperArxivId})`}
                          </p>
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.isActive && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        <Link href={`/paper/${session.paperId}/read`}>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {session.messages.length} messages
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {session.conversationRounds} rounds
                        </Badge>
                        {session.apiKeySet ? (
                          <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                            <Key className="w-3 h-3" />
                            API Key Set
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1 text-yellow-600">
                            <Key className="w-3 h-3" />
                            No API Key
                          </Badge>
                        )}
                        {session.isPublic ? (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            Private
                          </Badge>
                        )}
                        {hasAnalysis && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            AI Read Complete
                          </Badge>
                        )}
                      </div>

                      {/* Token Usage */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Token Usage</span>
                          <span className="font-medium">
                            {formatTokens(totalTokens)} / {formatTokens(session.maxContextTokens)} ({tokenUsagePercent.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={tokenUsagePercent} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Prompt: {formatTokens(session.totalPromptTokens)}</span>
                          <span>Completion: {formatTokens(session.totalCompletionTokens)}</span>
                        </div>
                      </div>

                      {/* Model Info */}
                      <div className="text-sm text-muted-foreground">
                        Model: <span className="font-medium">{session.modelUsed || "gpt-4o"}</span>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Created {new Date(session.createdAt * 1000).toLocaleString()}
                          </p>
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Updated {new Date(session.updatedAt * 1000).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          {deletingId === session.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(session.id)}
                              >
                                Confirm Delete
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(session.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
