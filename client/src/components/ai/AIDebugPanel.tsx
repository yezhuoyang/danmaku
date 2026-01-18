import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

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
}

export function AIDebugPanel({
  entries,
  stats,
  isReading,
  progress,
  onClose,
}: AIDebugPanelProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries come in
  useEffect(() => {
    if (scrollRef.current && isReading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, isReading]);

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
            {isReading && (
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 bg-amber-500/20 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span className="text-xs text-amber-300">Reading...</span>
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
        {progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Page {progress.current} of {progress.total}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
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
            <div className="text-lg font-bold text-white">{formatTokens(stats.totalTokensUsed)}</div>
            <div className="text-[10px] text-slate-500">
              {formatTokens(stats.promptTokens)} in / {formatTokens(stats.completionTokens)} out
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Rounds</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.totalRounds}</div>
            <div className="text-[10px] text-slate-500">
              <span className="text-green-400">{stats.successfulRounds}</span> ok / <span className="text-red-400">{stats.failedRounds}</span> fail
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Time</span>
            </div>
            <div className="text-lg font-bold text-white">{formatDuration(stats.totalDuration)}</div>
            <div className="text-[10px] text-slate-500">
              ~{formatDuration(stats.averageRoundDuration)}/page
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-2.5 border border-slate-700">
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Analyzed</span>
            </div>
            <div className="text-lg font-bold text-white">
              {entries.filter(e => e.type === 'response').reduce((sum, e) => sum + (e.sentenceCount || 0), 0)}
            </div>
            <div className="text-[10px] text-slate-500">sentences</div>
          </div>
        </div>
      </div>

      {/* Entries List */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Bug className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No debug entries yet</p>
              <p className="text-xs mt-1">Click "Let Agent Read" to start</p>
            </div>
          ) : (
            entries.map((entry) => (
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
