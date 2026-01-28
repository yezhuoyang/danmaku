import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bug,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Loader2,
  Zap,
  MessageSquare,
  FileText,
  Clock,
  CloudCog,
} from "lucide-react";
import type { BackgroundReadingJob, BackgroundDebugEntry } from "../../../../shared/types";

// Convert background debug entries to AIDebugEntry format
function convertBackgroundEntries(bgEntries: BackgroundDebugEntry[]): AIDebugEntry[] {
  return bgEntries.map(entry => ({
    id: entry.id,
    timestamp: new Date(entry.timestamp),
    type: entry.type,
    pageNumber: entry.pageNumber,
    prompt: entry.prompt,
    response: entry.response,
    error: entry.error,
    sentenceCount: entry.sentenceCount,
    figureTableCount: entry.figureTableCount,
    duration: entry.duration,
    tokens: entry.promptTokens !== undefined ? {
      prompt: entry.promptTokens || 0,
      completion: entry.completionTokens || 0,
      total: (entry.promptTokens || 0) + (entry.completionTokens || 0),
    } : undefined,
  }));
}

export interface AIDebugEntry {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  pageNumber: number;
  /** For request: the prompt sent */
  prompt?: string;
  /** For response: the raw response */
  response?: string;
  /** Token usage */
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Time taken in ms */
  duration?: number;
  /** Error message if any */
  error?: string;
  /** Parsed sentence count */
  sentenceCount?: number;
  /** Parsed figure/table count */
  figureTableCount?: number;
}

export interface AIDebugStats {
  totalTokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  totalRounds: number;
  successfulRounds: number;
  failedRounds: number;
  totalDuration: number;
  averageRoundDuration: number;
}

interface AIDebugPanelProps {
  entries: AIDebugEntry[];
  stats: AIDebugStats;
  isReading: boolean;
  progress: { current: number; total: number } | null;
  onClose: () => void;
  backgroundJob?: BackgroundReadingJob | null;
}

export function AIDebugPanel({
  entries,
  stats,
  isReading,
  progress,
  onClose,
  backgroundJob,
}: AIDebugPanelProps) {
  // Determine effective reading state (foreground or background)
  const isBackgroundReading = backgroundJob && (backgroundJob.status === 'running' || backgroundJob.status === 'pending');
  const effectiveIsReading = isReading || isBackgroundReading;
  const effectiveProgress = isBackgroundReading
    ? { current: backgroundJob.progress.currentPage, total: backgroundJob.progress.totalPages }
    : progress;

  // Calculate background job duration
  const getBackgroundJobDuration = (): number => {
    if (!backgroundJob?.timing?.startedAt) return 0;
    const startTime = backgroundJob.timing.startedAt * 1000;
    const endTime = backgroundJob.timing.completedAt
      ? backgroundJob.timing.completedAt * 1000
      : Date.now();
    return endTime - startTime;
  };

  // Use background job stats when background reading is active (prioritize over empty foreground stats)
  const effectiveStats: AIDebugStats = isBackgroundReading
    ? {
        totalTokensUsed: backgroundJob.tokens
          ? (backgroundJob.tokens.promptTokens || 0) + (backgroundJob.tokens.completionTokens || 0)
          : 0,
        promptTokens: backgroundJob.tokens?.promptTokens || 0,
        completionTokens: backgroundJob.tokens?.completionTokens || 0,
        totalRounds: backgroundJob.progress.currentPage,
        successfulRounds: backgroundJob.progress.currentPage,
        failedRounds: 0,
        totalDuration: getBackgroundJobDuration(),
        averageRoundDuration: backgroundJob.progress.currentPage > 0
          ? getBackgroundJobDuration() / backgroundJob.progress.currentPage
          : 0,
      }
    : stats;
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Combine foreground entries with background entries
  const effectiveEntries = useMemo(() => {
    // Prefer foreground entries if available
    if (entries.length > 0) {
      return entries;
    }
    // Use background entries if available (show even after job completed)
    if (backgroundJob?.debugEntries && backgroundJob.debugEntries.length > 0) {
      return convertBackgroundEntries(backgroundJob.debugEntries);
    }
    return [];
  }, [entries, backgroundJob?.debugEntries]);

  // Auto-scroll to bottom when new entries come in
  useEffect(() => {
    if (scrollRef.current && effectiveIsReading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [effectiveEntries.length, effectiveIsReading]);

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTokens = (count: number) => {
    if (count < 1000) return count.toString();
    return `${(count / 1000).toFixed(1)}k`;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-slate-900 border-l border-slate-700 shadow-2xl z-[200] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-white">AI Debug Console</h2>
            {effectiveIsReading && (
              <div className={`flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full ${
                isBackgroundReading ? 'bg-blue-500/20' : 'bg-amber-500/20'
              }`}>
                {isBackgroundReading ? (
                  <CloudCog className="w-3 h-3 animate-pulse text-blue-400" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                )}
                <span className={`text-xs ${isBackgroundReading ? 'text-blue-300' : 'text-amber-300'}`}>
                  {isBackgroundReading ? 'Background...' : 'Reading...'}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        {effectiveProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Page {effectiveProgress.current} of {effectiveProgress.total}</span>
              <span>{Math.round((effectiveProgress.current / effectiveProgress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isBackgroundReading
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}
                style={{ width: `${(effectiveProgress.current / effectiveProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="flex-shrink-0 p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Tokens</span>
            </div>
            <div className="text-lg font-bold text-white">{formatTokens(effectiveStats.totalTokensUsed)}</div>
            <div className="text-[10px] text-slate-500">
              {formatTokens(effectiveStats.promptTokens)} in / {formatTokens(effectiveStats.completionTokens)} out
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Rounds</span>
            </div>
            <div className="text-lg font-bold text-white">{effectiveStats.totalRounds}</div>
            <div className="text-[10px] text-slate-500">
              <span className="text-green-400">{effectiveStats.successfulRounds}</span> ok / <span className="text-red-400">{effectiveStats.failedRounds}</span> fail
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Time</span>
            </div>
            <div className="text-lg font-bold text-white">{formatDuration(effectiveStats.totalDuration)}</div>
            <div className="text-[10px] text-slate-500">
              ~{formatDuration(effectiveStats.averageRoundDuration)}/page
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Analyzed</span>
            </div>
            <div className="text-lg font-bold text-white">
              {effectiveEntries.filter(e => e.type === 'response').reduce((sum, e) => sum + (e.sentenceCount || 0), 0)}
            </div>
            <div className="text-[10px] text-slate-500">sentences</div>
          </div>
        </div>
      </div>

      {/* Entries List */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {effectiveEntries.length === 0 ? (
            effectiveIsReading ? (
              <div className="text-center py-12 text-slate-500">
                <CloudCog className="w-12 h-12 mx-auto mb-3 text-blue-400 animate-pulse" />
                <p className="text-sm text-blue-300">
                  {isBackgroundReading ? 'Background' : 'Foreground'} Reading in Progress
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  Page {effectiveProgress?.current || 0} of {effectiveProgress?.total || '?'}
                </p>
                <p className="text-xs mt-2 text-slate-500">
                  Waiting for debug entries...
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Bug className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No debug entries yet</p>
                <p className="text-xs mt-1">Click "Let Agent Read" to start</p>
              </div>
            )
          ) : (
            effectiveEntries.map((entry) => (
              <DebugEntry
                key={entry.id}
                entry={entry}
                isExpanded={expandedEntries.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
                onCopy={(text) => copyToClipboard(text, entry.id)}
                isCopied={copiedId === entry.id}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-slate-700 bg-slate-800/50 text-xs text-slate-500 text-center">
        Debug data is stored in memory only and cleared on page refresh
      </div>
    </div>
  );
}

interface DebugEntryProps {
  entry: AIDebugEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  isCopied: boolean;
}

function DebugEntry({ entry, isExpanded, onToggle, onCopy, isCopied }: DebugEntryProps) {
  const getEntryColor = () => {
    switch (entry.type) {
      case 'request': return 'border-blue-500/50 bg-blue-900/20';
      case 'response': return 'border-green-500/50 bg-green-900/20';
      case 'error': return 'border-red-500/50 bg-red-900/20';
    }
  };

  const getEntryIcon = () => {
    switch (entry.type) {
      case 'request': return <ChevronUp className="w-3.5 h-3.5 text-blue-400" />;
      case 'response': return <ChevronDown className="w-3.5 h-3.5 text-green-400" />;
      case 'error': return <X className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  const getEntryLabel = () => {
    switch (entry.type) {
      case 'request': return 'Request';
      case 'response': return 'Response';
      case 'error': return 'Error';
    }
  };

  const content = entry.prompt || entry.response || entry.error || '';

  return (
    <div className={`rounded-lg border ${getEntryColor()}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {getEntryIcon()}
          <span className="text-xs font-medium text-slate-300">
            Page {entry.pageNumber} - {getEntryLabel()}
          </span>
          {entry.tokens && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
              {entry.tokens.total} tokens
            </span>
          )}
          {entry.duration && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400">
              {entry.duration}ms
            </span>
          )}
          {entry.sentenceCount !== undefined && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-800/50 rounded text-green-300">
              {entry.sentenceCount} sentences
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {entry.timestamp.toLocaleTimeString()}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-slate-700/50">
          <div className="mt-2 flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">
              {entry.type === 'request' ? 'Prompt' : entry.type === 'response' ? 'Response' : 'Error'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(content)}
              className="h-6 px-2 text-xs text-slate-400 hover:text-white"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <pre className="text-xs text-slate-300 bg-slate-950 rounded p-3 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words font-mono">
            {content.length > 5000 ? content.slice(0, 5000) + '\n\n... (truncated)' : content}
          </pre>
        </div>
      )}
    </div>
  );
}

// Helper to create initial empty stats
export function createEmptyStats(): AIDebugStats {
  return {
    totalTokensUsed: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalRounds: 0,
    successfulRounds: 0,
    failedRounds: 0,
    totalDuration: 0,
    averageRoundDuration: 0,
  };
}
