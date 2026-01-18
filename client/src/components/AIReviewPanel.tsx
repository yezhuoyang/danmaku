import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LikeButtons } from '@/components/ui/LikeButtons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronUp,
  Bot,
  Lightbulb,
  FileText,
  AlertTriangle,
  CheckCircle2,
  PenTool,
  BookOpen,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkles,
  Code,
  Eye,
  Trash2,
} from 'lucide-react';
import type { AiReview, AiAgentHistory } from '../../../shared/types';

interface AIReviewPanelProps {
  reviews: AiReview[];
  onGenerateReview?: (customPrompt?: string) => void;
  onDeleteReview?: (reviewId: string) => void;
  isGenerating?: boolean;
  activeSession?: AiAgentHistory | null; // The currently active AI session
  currentUserId?: string; // Current logged-in user ID for like/dislike functionality
}

// Default prompt for generating AI reviews
const DEFAULT_REVIEW_PROMPT = `Based on the following AI analysis of an academic paper, please generate a comprehensive conference-style peer review. The review should be critical, balanced, and constructive.

{ANALYSIS_REPORT}

IMPORTANT GUIDELINES FOR EVIDENCE-BASED REVIEW:
- Every judgment must be supported by specific evidence from the paper
- Cite concrete examples: mention specific sections, paragraphs, figures, tables, equations, or data points
- Avoid vague or high-level comments like "the paper is well-written" or "the methodology is sound"
- Instead, be explicit: "In Section 3.2, Equation (5) appears to have a sign error because..." or "Table 2 shows a 15% improvement, but the baseline comparison in Section 4.1 does not account for..."
- When identifying weaknesses, specify exactly where the issue occurs (e.g., "The claim in paragraph 2 of Section 5 that X leads to Y contradicts the data shown in Figure 3")
- When praising strengths, point to specific contributions (e.g., "The novel attention mechanism described in Section 3.3 achieves state-of-the-art results as demonstrated in Table 4")
- For technical concerns, reference specific equations, algorithms, or experimental setups
- All criticisms and praise should be traceable to concrete content in the paper

CRITICAL FORMAT REQUIREMENTS:
- DO NOT use any markdown formatting (no **, no *, no #, no backticks)
- Use ONLY plain text
- Each field must start with its exact label followed by a colon
- Each field's content must be on the same line or immediately following lines until the next field label

Generate a review with the following EXACT structure and format. Each rating should be a number from 1-4:

PAPER_SUMMARY: [2-3 paragraph summary of what this paper does, its main contributions, and methodology]

SIGNIFICANCE_OF_PROBLEM: [1-4]
SIGNIFICANCE_OF_PROBLEM_TEXT: [One sentence. 1=minor problem, 2=important but studied, 3=important and emerging, 4=fundamental and critical]

NOVELTY_OF_SOLUTION: [1-4]
NOVELTY_OF_SOLUTION_TEXT: [One sentence. 1=incremental, 2=some novelty, 3=significant novelty, 4=highly novel]

CORRECTNESS: [1-4]
CORRECTNESS_TEXT: [One sentence. 1=major errors, 2=minor errors, 3=no factual mistakes, 4=rigorous proofs]

WRITING_QUALITY: [1-4]
WRITING_QUALITY_TEXT: [One sentence. 1=hard to read, 2=reasonable, 3=well-written, 4=excellent]

RELATED_WORK: [1-4]
RELATED_WORK_TEXT: [One sentence. 1=not up-to-date, 2=adequate, 3=comprehensive, 4=exemplary]

ROBUSTNESS_OF_EVALUATION: [1-4]
ROBUSTNESS_OF_EVALUATION_TEXT: [One sentence. 1=missing experiments, 2=basic evaluation, 3=well-executed, 4=comprehensive]

ADVANCEMENT_DISCIPLINES: [comma-separated list of relevant fields, e.g., Computer Architecture, Machine Learning]

STRENGTHS:
[Bullet points of 3-5 key strengths, each starting with a dash on a new line]

WEAKNESSES:
[Bullet points of 3-5 key weaknesses, each starting with a dash on a new line]

COMMENTS_FOR_AUTHORS:
[2-3 paragraphs with detailed, constructive feedback for the authors. Include specific questions, suggestions for improvement, and comments on technical aspects.]

COMMENTS_FOR_READERS:
[1-2 paragraphs with meta-comments about the paper's contribution to the field, potential impact, and any concerns about the review process or scope.]`;

// Prompt editing dialog component
function PromptEditorDialog({
  defaultPrompt,
  onGenerate,
  isGenerating,
  disabled,
}: {
  defaultPrompt: string;
  onGenerate: (prompt?: string) => void;
  isGenerating: boolean;
  disabled: boolean;
}) {
  const [editedPrompt, setEditedPrompt] = useState(defaultPrompt);
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = () => {
    onGenerate(editedPrompt !== defaultPrompt ? editedPrompt : undefined);
    setIsOpen(false);
  };

  const handleReset = () => {
    setEditedPrompt(defaultPrompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
        >
          <Code className="w-3 h-3" />
          View/Edit Prompt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-500" />
            Review Generation Prompt
          </DialogTitle>
          <DialogDescription>
            View and customize the prompt used to generate AI reviews. The placeholder {'{ANALYSIS_REPORT}'} will be replaced with the actual analysis data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="h-[400px] font-mono text-xs resize-none"
            placeholder="Enter your custom prompt..."
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Review
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Rating item component for consistent display
function RatingItem({
  label,
  score,
  text,
  icon: Icon,
  maxScore = 4,
}: {
  label: string;
  score: number;
  text: string;
  icon: React.ElementType;
  maxScore?: number;
}) {
  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.75) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (ratio >= 0.5) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400';
    return 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className={`p-2 rounded-lg ${getScoreColor(score, maxScore)}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <Badge variant="outline" className={`font-mono ${getScoreColor(score, maxScore)}`}>
            {score}/{maxScore}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{text}</p>
      </div>
    </div>
  );
}

// Single review card component
function ReviewCard({ review, index, onDelete, currentUserId }: { review: AiReview; index: number; onDelete?: (id: string) => void; currentUserId?: string }) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors py-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                AI Review #{index + 1}
                <Badge variant="secondary" className="text-xs font-normal">
                  {review.generatedBy}
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generated on {formatDate(review.generatedAt)}
              </p>
            </div>
            {/* Like/Dislike buttons */}
            <LikeButtons
              targetType="ai_review"
              targetId={review.id}
              currentUserId={currentUserId}
              size="md"
            />
          </div>
          <div className="flex items-center gap-1">
            {onDelete && (
              isDeleting ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(review.id);
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleting(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleting(true);
                  }}
                  title="Delete review"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable content */}
      {isExpanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Paper Summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Paper Summary
              </h4>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              {review.paperSummary}
            </p>
          </div>

          <Separator />

          {/* Ratings */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Evaluation Scores
            </h4>
            <div className="space-y-1">
              <RatingItem
                label="Significance of the Problem"
                score={review.significanceOfProblem}
                text={review.significanceOfProblemText}
                icon={Lightbulb}
              />
              <RatingItem
                label="Novelty of the Solution"
                score={review.noveltyOfSolution}
                text={review.noveltyOfSolutionText}
                icon={Sparkles}
              />
              <RatingItem
                label="Correctness"
                score={review.correctness}
                text={review.correctnessText}
                icon={CheckCircle2}
              />
              <RatingItem
                label="Writing Quality"
                score={review.writingQuality}
                text={review.writingQualityText}
                icon={PenTool}
              />
              <RatingItem
                label="Related Work"
                score={review.relatedWork}
                text={review.relatedWorkText}
                icon={BookOpen}
              />
              <RatingItem
                label="Robustness of Evaluation"
                score={review.robustnessOfEvaluation}
                text={review.robustnessOfEvaluationText}
                icon={BarChart3}
              />
            </div>
          </div>

          {/* Advancement Disciplines */}
          {review.advancementDisciplines && review.advancementDisciplines.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Advancement in Core Disciplines
                </h4>
                <div className="flex flex-wrap gap-2">
                  {review.advancementDisciplines.map((discipline, i) => (
                    <Badge key={i} variant="secondary">
                      {discipline}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                Strengths
              </h4>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
              {review.strengths.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">
                Weaknesses
              </h4>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
              {review.weaknesses.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Comments for Authors */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Comments for Authors
              </h4>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              {review.commentsForAuthors.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Comments for Readers (if any) */}
          {review.commentsForPC && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                  Comments for Readers
                </h4>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                {review.commentsForPC.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function AIReviewPanel({ reviews, onGenerateReview, onDeleteReview, isGenerating, activeSession, currentUserId }: AIReviewPanelProps) {
  // Check if the active session has AI reading completed
  const hasAiRead = activeSession?.sentenceAnalysis && Object.keys(activeSession.sentenceAnalysis).length > 0;
  const sentenceCount = activeSession?.sentenceAnalysis ? Object.keys(activeSession.sentenceAnalysis).length : 0;

  // Determine if we can generate a review
  const canGenerateReview = hasAiRead && onGenerateReview;
  const buttonDisabled = isGenerating || !hasAiRead;

  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            AI Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              No AI reviews yet for this paper
            </p>
            {onGenerateReview && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 justify-center">
                  <Button
                    onClick={() => onGenerateReview()}
                    disabled={buttonDisabled}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Generating Review...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Create Review
                      </>
                    )}
                  </Button>
                  <PromptEditorDialog
                    defaultPrompt={DEFAULT_REVIEW_PROMPT}
                    onGenerate={onGenerateReview}
                    isGenerating={isGenerating || false}
                    disabled={buttonDisabled}
                  />
                </div>
                {!hasAiRead && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {activeSession ? (
                      <>
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        AI must read the paper first. Enter Reading Mode and click "Let Agent Read".
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Create an AI Session first, then enter Reading Mode to let the AI read the paper.
                      </>
                    )}
                  </p>
                )}
                {hasAiRead && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    Session "{activeSession?.title}" has analyzed {sentenceCount} sentences. Ready to generate review.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <Bot className="h-5 w-5 text-indigo-500" />
          AI Reviews ({reviews.length})
        </h2>
        {onGenerateReview && (
          <div className="flex items-center gap-2">
            {!hasAiRead && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                AI needs to read first
              </span>
            )}
            <Button
              onClick={() => onGenerateReview()}
              disabled={buttonDisabled}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Create Review
                </>
              )}
            </Button>
            <PromptEditorDialog
              defaultPrompt={DEFAULT_REVIEW_PROMPT}
              onGenerate={onGenerateReview}
              isGenerating={isGenerating || false}
              disabled={buttonDisabled}
            />
          </div>
        )}
      </div>
      <div className="space-y-4">
        {reviews.map((review, index) => (
          <ReviewCard key={review.id} review={review} index={index} onDelete={onDeleteReview} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
