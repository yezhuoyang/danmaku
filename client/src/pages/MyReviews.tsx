import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Search,
  Trash2,
  ExternalLink,
  Calendar,
  Star,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type { UserReviewWithPaper } from "../lib/api";
import { toast } from "sonner";

export default function MyReviews() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [reviews, setReviews] = useState<UserReviewWithPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    loadReviews();
  }, [user]);

  async function loadReviews() {
    try {
      const { reviews: data } = await api.getMyReviews();
      setReviews(data);
    } catch (error) {
      console.error("Failed to load reviews:", error);
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(reviewId: string) {
    try {
      await api.deleteMyReview(reviewId);
      setReviews(reviews.filter((r) => r.id !== reviewId));
      toast.success("Review deleted");
      setDeletingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete review");
    }
  }

  // Filter reviews by search query
  const filteredReviews = reviews.filter((r) => {
    const query = searchQuery.toLowerCase();
    return (
      r.paperTitle.toLowerCase().includes(query) ||
      r.paperSummary.toLowerCase().includes(query) ||
      r.strengths.toLowerCase().includes(query) ||
      r.weaknesses.toLowerCase().includes(query)
    );
  });

  // Calculate average score for a review
  const getAverageScore = (review: UserReviewWithPaper) => {
    const scores = [
      review.significanceOfProblem,
      review.noveltyOfSolution,
      review.correctness,
      review.writingQuality,
      review.relatedWork,
      review.robustnessOfEvaluation,
    ];
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
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
              <FileText className="w-5 h-5" />
              My Reviews
            </h1>
          </div>
          <Badge variant="secondary">{reviews.length} total</Badge>
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
              placeholder="Search reviews by paper title, summary, or content..."
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No reviews yet</p>
              <p className="text-muted-foreground mt-2">
                Start reading papers and write reviews to see them here.
              </p>
              <Link href="/browse">
                <Button className="mt-4">Browse Papers</Button>
              </Link>
            </CardContent>
          </Card>
        ) : filteredReviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No matching reviews</p>
              <p className="text-muted-foreground mt-2">
                Try a different search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {review.paperTitle}
                      </CardTitle>
                      {review.paperArxivId && (
                        <p className="text-sm text-muted-foreground mt-1">
                          arXiv:{review.paperArxivId}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {getAverageScore(review)}/4
                      </Badge>
                      <Link href={`/paper/${review.paperId}`}>
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Summary Preview */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Summary</p>
                      <p className="text-sm line-clamp-2">{review.paperSummary}</p>
                    </div>

                    {/* Scores Grid */}
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Significance</p>
                        <p className="font-medium">{review.significanceOfProblem}/4</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Novelty</p>
                        <p className="font-medium">{review.noveltyOfSolution}/4</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Correctness</p>
                        <p className="font-medium">{review.correctness}/4</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Writing</p>
                        <p className="font-medium">{review.writingQuality}/4</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Related Work</p>
                        <p className="font-medium">{review.relatedWork}/4</p>
                      </div>
                      <div className="text-center p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Evaluation</p>
                        <p className="font-medium">{review.robustnessOfEvaluation}/4</p>
                      </div>
                    </div>

                    {/* Expand/Collapse Details */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setExpandedId(expandedId === review.id ? null : review.id)}
                    >
                      {expandedId === review.id ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-1" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Show Details
                        </>
                      )}
                    </Button>

                    {expandedId === review.id && (
                      <div className="space-y-3 pt-3 border-t">
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-1">Strengths</p>
                          <p className="text-sm whitespace-pre-wrap">{review.strengths}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-600 mb-1">Weaknesses</p>
                          <p className="text-sm whitespace-pre-wrap">{review.weaknesses}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-1">Comments for Authors</p>
                          <p className="text-sm whitespace-pre-wrap">{review.commentsForAuthors}</p>
                        </div>
                        {review.commentsForReaders && (
                          <div>
                            <p className="text-sm font-medium mb-1">Comments for Readers</p>
                            <p className="text-sm whitespace-pre-wrap">{review.commentsForReaders}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Updated {new Date(review.updatedAt * 1000).toLocaleString()}
                      </p>
                      <div>
                        {deletingId === review.id ? (
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(review.id)}
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
                            onClick={() => setDeletingId(review.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
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
