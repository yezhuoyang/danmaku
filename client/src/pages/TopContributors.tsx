import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  ArrowLeft,
  FileText,
  MessageSquare,
  Bot,
  Star,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Info,
} from "lucide-react";
import * as api from "@/lib/api";
import type { TopContributor } from "../../../shared/types";

// Rank badge component
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
        3
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-lg">
      {rank}
    </div>
  );
}

// Contribution breakdown component
function ContributionBreakdown({ contributor }: { contributor: TopContributor }) {
  const breakdown = [
    { label: "Papers Uploaded", count: contributor.papersUploaded, points: contributor.papersUploaded * 10, multiplier: 10, icon: FileText, color: "text-purple-500" },
    { label: "Reviews Written", count: contributor.reviewsWritten, points: contributor.reviewsWritten * 5, multiplier: 5, icon: Star, color: "text-yellow-500" },
    { label: "Public AI Sessions", count: contributor.publicAiSessions, points: contributor.publicAiSessions * 3, multiplier: 3, icon: Bot, color: "text-blue-500" },
    { label: "Comments Posted", count: contributor.commentsPosted, points: contributor.commentsPosted * 1, multiplier: 1, icon: MessageSquare, color: "text-green-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {breakdown.map((item) => (
        <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center">
          <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
          <div className="text-lg font-bold text-slate-800 dark:text-slate-200">{item.count}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{item.label}</div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            +{item.points} pts ({item.multiplier}x)
          </div>
        </div>
      ))}
    </div>
  );
}

// Top contributors list page
function TopContributorsList() {
  const [contributors, setContributors] = useState<TopContributor[]>([]);
  const [totalContributors, setTotalContributors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.getTopContributors({ limit: pageSize, offset: page * pageSize })
      .then(({ contributors, totalContributors }) => {
        setContributors(contributors);
        setTotalContributors(totalContributors);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(totalContributors / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Top Contributors</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Scoring Explanation Card */}
        <Card className="mb-8 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Calculator className="w-5 h-5" />
              How Contribution Score is Calculated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Your contribution score reflects your activity and impact on the platform. The score is calculated using the following formula:
              </p>

              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-indigo-200 dark:border-indigo-700">
                <code className="text-sm font-mono text-indigo-700 dark:text-indigo-300">
                  Total Score = (Papers × 10) + (Reviews × 5) + (AI Sessions × 3) + (Comments × 1)
                </code>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Papers Uploaded</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">10 points each</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">Highest value - sharing papers helps everyone</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                    <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Reviews Written</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">5 points each</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Quality peer feedback is valuable</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Public AI Sessions</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">3 points each</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Sharing AI insights benefits the community</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Comments Posted</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">1 point each</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">Discussions enrich paper understanding</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rankings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                Contributor Rankings
              </CardTitle>
              <Badge variant="secondary">
                {totalContributors} total contributors
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : contributors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No contributors yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Be the first to contribute by uploading papers, writing reviews, or adding comments!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {contributors.map((contributor) => (
                  <div
                    key={contributor.userId}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank */}
                      <RankBadge rank={contributor.rank || 0} />

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <Link href={`/profile/${contributor.userId}`}>
                            <a className="flex items-center gap-2 hover:underline">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={contributor.userAvatar} />
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                  {contributor.userName.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {contributor.userName}
                              </span>
                            </a>
                          </Link>
                          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0">
                            {contributor.totalScore} points
                          </Badge>
                        </div>

                        {/* Contribution Breakdown */}
                        <ContributionBreakdown contributor={contributor} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-slate-500">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function TopContributors() {
  return <TopContributorsList />;
}
