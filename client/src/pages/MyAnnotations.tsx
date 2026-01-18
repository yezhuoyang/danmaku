import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Search,
  Trash2,
  ExternalLink,
  FileText,
  Calendar,
  Filter,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type { AnnotationWithPaper } from "../lib/api";
import { toast } from "sonner";

export default function MyAnnotations() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [annotations, setAnnotations] = useState<AnnotationWithPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    loadAnnotations();
  }, [user]);

  async function loadAnnotations() {
    try {
      // Get only danmaku (annotations with highlightRegion), not comments
      const { annotations: data } = await api.getMyDanmaku();
      setAnnotations(data);
    } catch (error) {
      console.error("Failed to load annotations:", error);
      toast.error("Failed to load annotations");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(annotation: AnnotationWithPaper) {
    try {
      await api.deleteAnnotation(annotation.paperId, annotation.id);
      setAnnotations(annotations.filter((a) => a.id !== annotation.id));
      toast.success("Annotation deleted");
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete annotation");
    }
  }

  // Filter annotations by search query
  const filteredAnnotations = annotations.filter((a) => {
    const query = searchQuery.toLowerCase();
    return (
      a.paperTitle.toLowerCase().includes(query) ||
      a.content.text.toLowerCase().includes(query) ||
      (a.content.label && a.content.label.toLowerCase().includes(query))
    );
  });

  // Group by paper
  const annotationsByPaper = filteredAnnotations.reduce((acc, annotation) => {
    const paperId = annotation.paperId;
    if (!acc[paperId]) {
      acc[paperId] = {
        paperId,
        paperTitle: annotation.paperTitle,
        paperArxivId: annotation.paperArxivId,
        annotations: [],
      };
    }
    acc[paperId].annotations.push(annotation);
    return acc;
  }, {} as Record<string, { paperId: string; paperTitle: string; paperArxivId?: string; annotations: AnnotationWithPaper[] }>);

  const papers = Object.values(annotationsByPaper);

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
              <MessageSquare className="w-5 h-5" />
              My Annotations
            </h1>
          </div>
          <Badge variant="secondary">{annotations.length} total</Badge>
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
              placeholder="Search annotations by paper title or content..."
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : annotations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No annotations yet</p>
              <p className="text-muted-foreground mt-2">
                Start reading papers and add annotations to see them here.
              </p>
              <Link href="/browse">
                <Button className="mt-4">Browse Papers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredAnnotations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No matching annotations</p>
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
                    {paper.annotations.map((annotation) => (
                      <div
                        key={annotation.id}
                        className="p-3 bg-muted rounded-lg relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                style={{
                                  borderColor: annotation.content.color,
                                  color: annotation.content.color,
                                }}
                              >
                                {annotation.content.type}
                              </Badge>
                              {annotation.content.label && (
                                <Badge variant="secondary" className="text-xs">
                                  {annotation.content.label}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Page {annotation.pageNumber}
                              </span>
                            </div>
                            <p className="text-sm">{annotation.content.text}</p>
                            {annotation.content.latex && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                LaTeX: {annotation.content.latex}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(annotation.createdAt * 1000).toLocaleString()}
                            </p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {deletingId === annotation.id ? (
                              <div className="flex gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(annotation)}
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
                                onClick={() => setDeletingId(annotation.id)}
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
