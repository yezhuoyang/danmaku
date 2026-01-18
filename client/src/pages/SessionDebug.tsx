import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Bug,
  Bot,
  User,
  Clock,
  MessageSquare,
  BookOpen,
  Key,
  Globe,
  Lock,
  AlertCircle,
  FileText,
} from "lucide-react";
import * as api from "../lib/api";
import type { AiAgentHistory, Paper } from "../../../shared/types";

// Format timestamp to readable date/time
function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export default function SessionDebug() {
  const [, params] = useRoute("/paper/:paperId/session/:sessionId/debug");
  const paperId = params?.paperId;
  const sessionId = params?.sessionId;

  const [session, setSession] = useState<AiAgentHistory | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!paperId || !sessionId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Load paper and session data
        const [paperResult, historiesResult] = await Promise.all([
          api.getPaper(paperId),
          api.getAiAgentHistories(paperId),
        ]);

        setPaper(paperResult.paper);

        // Find the specific session
        const foundSession = historiesResult.histories.find(
          (h) => h.id === sessionId
        );
        if (foundSession) {
          setSession(foundSession);
        } else {
          setError("Session not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [paperId, sessionId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 p-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 p-8">
        <div className="max-w-4xl mx-auto">
          <Link href={paperId ? `/paper/${paperId}` : "/"}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                <p className="text-red-600">{error || "Session not found"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href={`/paper/${paperId}`}>
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Paper
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-orange-500" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              Session Debug View
            </h1>
          </div>
        </div>

        {/* Paper Info */}
        {paper && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                <FileText className="w-4 h-4" />
                Paper
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-slate-800 dark:text-white">
                {paper.title}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Session Metadata */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              Session: {session.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">ID:</span>
                <code className="ml-2 text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  {session.id}
                </code>
              </div>
              <div>
                <span className="text-slate-500">User:</span>
                <span className="ml-2">{session.userName}</span>
              </div>
              <div>
                <span className="text-slate-500">Created:</span>
                <span className="ml-2">{formatDateTime(session.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-500">Updated:</span>
                <span className="ml-2">{formatDateTime(session.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Status:</span>
                {session.isActive && (
                  <Badge className="bg-indigo-500 text-white">Active</Badge>
                )}
                {session.isPublic ? (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="w-3 h-3" />
                    Public
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="w-3 h-3" />
                    Private
                  </Badge>
                )}
                {session.apiKeySet && (
                  <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                    <Key className="w-3 h-3" />
                    API Key Set
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-slate-500">Messages:</span>
                <span className="ml-2">{session.messages.length}</span>
              </div>
            </div>

            {/* Token Usage */}
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Token Usage</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Prompt:</span>
                  <span className="ml-2 font-mono">
                    {(session.totalPromptTokens ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Completion:</span>
                  <span className="ml-2 font-mono">
                    {(session.totalCompletionTokens ?? 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Max:</span>
                  <span className="ml-2 font-mono">
                    {(session.maxContextTokens ?? 128000).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-slate-500 text-sm">Rounds:</span>
                <span className="ml-2 font-mono">
                  {session.conversationRounds ?? 0}
                </span>
              </div>
            </div>

            {/* AI Reading Status */}
            {session.sentenceAnalysis && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    AI Reading Analysis
                  </h4>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-400">
                  {Object.keys(session.sentenceAnalysis).length} sentences analyzed
                  {session.figureTableAnalysis && (
                    <>, {Object.keys(session.figureTableAnalysis).length} figures/tables</>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              Full Conversation History ({session.messages.length} messages)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {session.messages.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                No messages in this session
              </p>
            ) : (
              <div className="space-y-4">
                {session.messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      message.role === "user"
                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800"
                        : message.role === "assistant"
                        ? "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {message.role === "user" ? (
                          <User className="w-4 h-4 text-indigo-600" />
                        ) : message.role === "assistant" ? (
                          <Bot className="w-4 h-4 text-slate-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="font-medium text-sm capitalize">
                          {message.role}
                        </span>
                        <span className="text-xs text-slate-500">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatDateTime(message.timestamp)}</span>
                        <span className="text-slate-400">
                          ({formatRelativeTime(message.timestamp)})
                        </span>
                      </div>
                    </div>

                    {/* Message Content */}
                    <div className="text-sm whitespace-pre-wrap font-mono bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-700 overflow-x-auto">
                      {message.content}
                    </div>

                    {/* Character count */}
                    <div className="mt-2 text-xs text-slate-400 text-right">
                      {message.content.length.toLocaleString()} characters
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Raw Sentence Analysis (collapsed by default) */}
        {session.sentenceAnalysis && (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
              View Raw Sentence Analysis JSON ({Object.keys(session.sentenceAnalysis).length} entries)
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-4">
                <pre className="text-xs overflow-auto max-h-96 p-4 bg-slate-100 dark:bg-slate-800 rounded">
                  {JSON.stringify(session.sentenceAnalysis, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </details>
        )}

        {/* Raw Figure/Table Analysis (collapsed by default) */}
        {session.figureTableAnalysis && Object.keys(session.figureTableAnalysis).length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
              View Raw Figure/Table Analysis JSON ({Object.keys(session.figureTableAnalysis).length} entries)
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-4">
                <pre className="text-xs overflow-auto max-h-96 p-4 bg-slate-100 dark:bg-slate-800 rounded">
                  {JSON.stringify(session.figureTableAnalysis, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </details>
        )}
      </div>
    </div>
  );
}
