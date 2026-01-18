import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  Cpu,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import * as api from "@/lib/api";
import type { AiModelRanking } from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";
import type { ModelDetailResponse } from "@/lib/api";

// Provider colors for badges
const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  anthropic: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  google: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  xai: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  meta: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  deepseek: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  alibaba: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  mistral: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  cohere: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  custom: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
};

// Provider full names
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  meta: 'Meta',
  deepseek: 'DeepSeek',
  alibaba: 'Alibaba',
  mistral: 'Mistral AI',
  cohere: 'Cohere',
  custom: 'Custom',
};

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

// Model rankings list page
function ModelRankingsList() {
  const [rankings, setRankings] = useState<AiModelRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    api.getModelRankings({ limit: 100 }) // Get all rankings at once
      .then(({ rankings }) => {
        setRankings(rankings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Generate display rankings: merge API rankings with default models
  const displayRankings: AiModelRanking[] = (() => {
    // Create a map of existing rankings by modelId
    const rankingsMap = new Map(rankings.map(r => [r.modelId, r]));

    // Start with all default models
    const allModels: AiModelRanking[] = DEFAULT_AI_MODELS.map((model) => {
      // Check if we have ranking data for this model
      const existing = rankingsMap.get(model.id);
      if (existing) {
        return existing;
      }
      // Return default entry with zero stats
      return {
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        likeCount: 0,
        dislikeCount: 0,
        score: 0,
        sessionCount: 0,
      };
    });

    // Sort by score (descending), then by name
    allModels.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.modelName.localeCompare(b.modelName);
    });

    // Assign ranks
    return allModels.map((model, index) => ({ ...model, rank: index + 1 }));
  })();

  // Paginate the display rankings
  const paginatedRankings = displayRankings.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(displayRankings.length / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              AI Model Arena
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Ranking AI models by community votes on their generated content
            </p>
          </div>
        </div>

        {/* Rankings */}
        {loading ? (
          <Card>
            <CardContent className="py-6">
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedRankings.map((model) => (
                    <Link key={model.modelId} href={`/model-rankings/${model.modelId}`}>
                      <a className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Rank */}
                        <RankBadge rank={model.rank || 0} />

                        {/* Model Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {model.modelName}
                            </span>
                            <Badge className={`text-xs ${PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.custom}`}>
                              {PROVIDER_NAMES[model.provider] || model.provider}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {model.sessionCount} sessions
                            </span>
                          </div>
                        </div>

                        {/* Votes */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <ThumbsUp className="w-4 h-4" />
                            <span className="font-medium">{model.likeCount}</span>
                          </div>
                          <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                            <ThumbsDown className="w-4 h-4" />
                            <span className="font-medium">{model.dislikeCount}</span>
                          </div>
                          <div className={`text-xl font-bold min-w-[60px] text-right ${
                            model.score > 0 ? 'text-green-600 dark:text-green-400' :
                            model.score < 0 ? 'text-red-500 dark:text-red-400' :
                            'text-slate-500'
                          }`}>
                            {model.score > 0 ? '+' : ''}{model.score}
                          </div>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400 px-4">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Explanation */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">How Rankings Work</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              <strong>Score</strong> = Total Likes - Total Dislikes from AI-generated content
            </p>
            <p>
              Votes are collected from:
            </p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>AI Reviews generated by the model</li>
              <li>Necessary Background content generated by the model</li>
            </ul>
            <p>
              When you create an AI session, select the model you're using. The community's votes
              on the generated content contribute to that model's ranking.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Model detail page
function ModelDetail() {
  const params = useParams<{ modelId: string }>();
  const [model, setModel] = useState<ModelDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.modelId) {
      setLoading(true);
      api.getModelDetails(params.modelId)
        .then(setModel)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.modelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/model-rankings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rankings
            </Button>
          </Link>
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <p className="text-slate-500">Model not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/model-rankings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rankings
            </Button>
          </Link>
        </div>

        {/* Model Info Card */}
        <Card className="mb-8">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {model.modelName}
                  </h1>
                  <Badge className={`text-sm ${PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.custom}`}>
                    {PROVIDER_NAMES[model.provider] || model.provider}
                  </Badge>
                </div>
                {model.description && (
                  <p className="text-slate-600 dark:text-slate-400 mt-2">
                    {model.description}
                  </p>
                )}
                {model.contextWindow && (
                  <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                    Context window: {(model.contextWindow / 1000).toFixed(0)}K tokens
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t dark:border-slate-700">
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  model.score > 0 ? 'text-green-600 dark:text-green-400' :
                  model.score < 0 ? 'text-red-500 dark:text-red-400' :
                  'text-slate-700 dark:text-slate-300'
                }`}>
                  {model.score > 0 ? '+' : ''}{model.score}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">Score</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {model.likeCount}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <ThumbsUp className="w-3 h-3" /> Likes
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-500 dark:text-red-400">
                  {model.dislikeCount}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <ThumbsDown className="w-3 h-3" /> Dislikes
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">
                  {model.sessionCount}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> Sessions
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Recent Sessions Using This Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {model.recentSessions.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                No sessions found for this model
              </p>
            ) : (
              <div className="divide-y dark:divide-slate-700">
                {model.recentSessions.map((session) => (
                  <Link key={session.id} href={`/paper/${session.paperId}`}>
                    <a className="flex items-center gap-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors -mx-4 px-4 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {session.title}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          Paper: {session.paperTitle}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          by {session.userName} • {new Date(session.createdAt * 1000).toLocaleDateString()}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main component that handles routing
export default function ModelRankings() {
  const params = useParams<{ modelId?: string }>();

  if (params.modelId) {
    return <ModelDetail />;
  }

  return <ModelRankingsList />;
}
