import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageCircle,
  Search,
  Trash2,
  ExternalLink,
  FileText,
  Calendar,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type { AnnotationWithPaper } from "../lib/api";
import { toast } from "sonner";

export default function MyComments() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [comments, setComments] = useState<AnnotationWithPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    loadComments();
  }, [user]);

  async function loadComments() {
    try {
      const { comments: data } = await api.getMyComments();
      setComments(data);
    } catch (error) {
      console.error("Failed to load comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(comment: AnnotationWithPaper) {
    try {
      await api.deleteAnnotation(comment.paperId, comment.id);
      setComments(comments.filter((c) => c.id !== comment.id));
      toast.success("Comment deleted");
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete comment");
    }
  }

  // Filter comments by search query
  const filteredComments = comments.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.paperTitle.toLowerCase().includes(query) ||
      c.content.text.toLowerCase().includes(query) ||
      (c.content.label && c.content.label.toLowerCase().includes(query)) ||
      (c.sentenceId && c.sentenceId.toLowerCase().includes(query))
    );
  });

  // Group by paper
  const commentsByPaper = filteredComments.reduce((acc, comment) => {
    const paperId = comment.paperId;
    if (!acc[paperId]) {
      acc[paperId] = {
        paperId,
        paperTitle: comment.paperTitle,
        paperArxivId: comment.paperArxivId,
        comments: [],
      };
    }
    acc[paperId].comments.push(comment);
    return acc;
  }, {} as Record<string, { paperId: string; paperTitle: string; paperArxivId?: string; comments: AnnotationWithPaper[] }>);

  const papers = Object.values(commentsByPaper);

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
              <MessageCircle className="w-5 h-5" />
              My Comments
            </h1>
          </div>
          <Badge variant="secondary">{comments.length} total</Badge>
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
              placeholder="Search comments by paper title, content, or sentence..."
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : comments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No comments yet</p>
              <p className="text-muted-foreground mt-2">
                Start reading papers and add comments on sentences or figures to see them here.
              </p>
              <Link href="/browse">
                <Button className="mt-4">Browse Papers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredComments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No matching comments</p>
              <p className="text-muted-foreground mt-2">
                Try a different search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {papers.map((paper) => (
              <Card key={paper.paperId}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {paper.paperTitle}
                      </CardTitle>
                      {paper.paperArxivId && (
                        <p className="text-sm text-muted-foreground mt-1">
                          arXiv:{paper.paperArxivId}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/paper/${paper.paperId}`}>
                        <Button variant="outline" size="sm">
                          View Paper
                        </Button>
                      </Link>
                      <Link href={`/paper/${paper.paperId}/read`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Read
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paper.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 bg-muted rounded-lg relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: comment.content.color,
                                  color: comment.content.color,
                                }}
                              >
                                {comment.content.type}
                              </Badge>
                              {comment.content.label && (
                                <Badge variant="secondary" className="text-xs">
                                  {comment.content.label}
                                </Badge>
                              )}
                              {comment.sentenceId && (
                                <Badge variant="outline" className="text-xs">
                                  {comment.sentenceId}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Page {comment.pageNumber}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content.text}</p>
                            {comment.content.latex && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                LaTeX: {comment.content.latex}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(comment.createdAt * 1000).toLocaleString()}
                            </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {deletingId === comment.id ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(comment)}
                                >
                                  Confirm
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
                                onClick={() => setDeletingId(comment.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
