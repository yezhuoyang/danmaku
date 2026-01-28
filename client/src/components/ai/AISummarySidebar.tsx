import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FileText, Sparkles, X, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sentence } from '@/components/annotations/types';
import { getSentenceLabelName, getColorForSentenceLabel, SentenceLabel } from '@/lib/ai-document-annotator';

interface AISentenceAnalysis {
  label: string;
  comment?: string;
  flags?: {
    correctnessIssue?: boolean;
    novelty?: boolean;
    consistencyIssue?: boolean;
  };
}

interface AISummarySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sentences: Sentence[];
  aiAnalysis: Map<string, AISentenceAnalysis>;
  currentPage: number;
  totalPages: number;
  onGoToPage: (page: number) => void;
  onSelectSentence?: (sentenceId: string) => void;
  position?: 'left' | 'right';
}

// Group sentences by page
function groupSentencesByPage(sentences: Sentence[]): Map<number, Sentence[]> {
  const grouped = new Map<number, Sentence[]>();
  for (const sentence of sentences) {
    const page = sentence.pageNumber;
    if (!grouped.has(page)) {
      grouped.set(page, []);
    }
    grouped.get(page)!.push(sentence);
  }
  return grouped;
}

// Generate page summary from AI analysis
function generatePageSummary(
  pageSentences: Sentence[],
  aiAnalysis: Map<string, AISentenceAnalysis>
): { summary: string; keyPoints: string[]; labels: Map<string, number> } {
  const labels = new Map<string, number>();
  const keyPoints: string[] = [];

  for (const sentence of pageSentences) {
    const analysis = aiAnalysis.get(sentence.id);
    if (analysis) {
      // Count labels
      const labelName = getSentenceLabelName(analysis.label as SentenceLabel);
      labels.set(labelName, (labels.get(labelName) || 0) + 1);

      // Collect key insights (novelty or important conclusions)
      if (analysis.flags?.novelty && analysis.comment) {
        keyPoints.push(analysis.comment);
      } else if (
        (analysis.label === 'conclusion' || analysis.label === 'contribution') &&
        analysis.comment
      ) {
        keyPoints.push(analysis.comment);
      }
    }
  }

  // Generate summary text
  const totalAnalyzed = Array.from(aiAnalysis.keys()).filter(id =>
    pageSentences.some(s => s.id === id)
  ).length;

  const summary = totalAnalyzed > 0
    ? `${totalAnalyzed} sentences analyzed`
    : 'Not yet analyzed';

  return { summary, keyPoints: keyPoints.slice(0, 3), labels };
}

// Label badge component
function LabelBadge({ label, count }: { label: string; count: number }) {
  const colorClass = getColorForSentenceLabel(label.toLowerCase().replace(/\s+/g, '_') as SentenceLabel);
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}
    >
      {label}: {count}
    </span>
  );
}

export function AISummarySidebar({
  isOpen,
  onToggle,
  sentences,
  aiAnalysis,
  currentPage,
  totalPages,
  onGoToPage,
  onSelectSentence,
  position = 'right',
}: AISummarySidebarProps) {
  const [expandedPages, setExpandedPages] = useState<Set<number>>(new Set([currentPage]));

  // Group sentences by page
  const sentencesByPage = useMemo(() => groupSentencesByPage(sentences), [sentences]);

  // Generate summaries for each page
  const pageSummaries = useMemo(() => {
    const summaries = new Map<number, ReturnType<typeof generatePageSummary>>();
    for (let page = 1; page <= totalPages; page++) {
      const pageSentences = sentencesByPage.get(page) || [];
      summaries.set(page, generatePageSummary(pageSentences, aiAnalysis));
    }
    return summaries;
  }, [sentencesByPage, aiAnalysis, totalPages]);

  // Toggle page expansion
  const togglePage = (page: number) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(page)) {
      newExpanded.delete(page);
    } else {
      newExpanded.add(page);
    }
    setExpandedPages(newExpanded);
  };

  // Get sentences with analysis for a page
  const getAnalyzedSentences = (page: number) => {
    const pageSentences = sentencesByPage.get(page) || [];
    return pageSentences
      .map(sentence => ({
        sentence,
        analysis: aiAnalysis.get(sentence.id),
      }))
      .filter(item => item.analysis);
  };

  // Collapsed state - just show a toggle button
  if (!isOpen) {
    return (
      <div
        className={`absolute top-1/2 -translate-y-1/2 z-20 ${
          position === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        <Button
          variant="default"
          size="sm"
          onClick={onToggle}
          className={`h-24 w-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg ${
            position === 'left' ? 'rounded-l-none rounded-r-lg' : 'rounded-r-none rounded-l-lg'
          }`}
          title="Show AI Summary"
        >
          <div className="flex flex-col items-center gap-1">
            {position === 'left' ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-medium [writing-mode:vertical-rl]">Summary</span>
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`absolute top-0 bottom-0 z-20 w-72 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl flex flex-col ${
        position === 'left'
          ? 'left-0 border-r'
          : 'right-0 border-l'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-600">
        <div className="flex items-center gap-2 text-white">
          <BookOpen className="w-4 h-4" />
          <span className="font-medium text-sm">AI Reading Summary</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-7 w-7 p-0 text-white hover:bg-white/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {aiAnalysis.size === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No AI analysis yet</p>
              <p className="text-xs mt-1">Click "Let Agent Read" to analyze the paper</p>
            </div>
          ) : (
            Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              const summary = pageSummaries.get(page);
              const isExpanded = expandedPages.has(page);
              const isCurrentPage = page === currentPage;
              const analyzedSentences = getAnalyzedSentences(page);
              const hasAnalysis = analyzedSentences.length > 0;

              return (
                <Collapsible
                  key={page}
                  open={isExpanded}
                  onOpenChange={() => togglePage(page)}
                >
                  <div
                    className={`rounded-lg border ${
                      isCurrentPage
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    {/* Page Header */}
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-t-lg transition-colors"
                        onClick={() => {
                          if (!isExpanded) {
                            onGoToPage(page);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 ${
                            hasAnalysis ? 'text-indigo-500' : 'text-slate-400'
                          }`} />
                          <span className={`text-sm font-medium ${
                            isCurrentPage ? 'text-indigo-700 dark:text-indigo-300' : ''
                          }`}>
                            Page {page}
                          </span>
                          {isCurrentPage && (
                            <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasAnalysis && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {analyzedSentences.length} analyzed
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    {/* Page Summary Content */}
                    <CollapsibleContent>
                      <div className="px-2 pb-2 space-y-2">
                        {/* Label distribution */}
                        {summary && summary.labels.size > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Array.from(summary.labels.entries()).map(([label, count]) => (
                              <LabelBadge key={label} label={label} count={count} />
                            ))}
                          </div>
                        )}

                        {/* Key points */}
                        {summary && summary.keyPoints.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Key Insights
                            </p>
                            {summary.keyPoints.map((point, idx) => (
                              <p
                                key={idx}
                                className="text-xs text-slate-600 dark:text-slate-300 pl-2 border-l-2 border-indigo-400"
                              >
                                {point.length > 100 ? point.slice(0, 100) + '...' : point}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Sentence list */}
                        {analyzedSentences.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Analyzed Sentences
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {analyzedSentences.slice(0, 10).map(({ sentence, analysis }) => (
                                <button
                                  key={sentence.id}
                                  onClick={() => {
                                    onGoToPage(page);
                                    onSelectSentence?.(sentence.id);
                                  }}
                                  className="w-full text-left p-1.5 rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <div className="flex items-start gap-1.5">
                                    <span
                                      className={`shrink-0 text-[9px] px-1 py-0.5 rounded ${
                                        getColorForSentenceLabel(analysis!.label as SentenceLabel)
                                      }`}
                                    >
                                      {getSentenceLabelName(analysis!.label as SentenceLabel)}
                                    </span>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">
                                      {sentence.text.slice(0, 80)}...
                                    </p>
                                  </div>
                                </button>
                              ))}
                              {analyzedSentences.length > 10 && (
                                <p className="text-[10px] text-slate-400 text-center py-1">
                                  +{analyzedSentences.length - 10} more sentences
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {!hasAnalysis && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-2">
                            No analysis for this page
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer with stats */}
      {aiAnalysis.size > 0 && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{aiAnalysis.size} sentences analyzed</span>
            <span>{totalPages} pages</span>
          </div>
        </div>
      )}
    </div>
  );
}
