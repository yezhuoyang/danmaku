import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LikeButtons } from '@/components/ui/LikeButtons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Star,
  HelpCircle,
  Code,
  Eye,
  Trash2,
} from 'lucide-react';
import type { NecessaryBackground, BackgroundConcept, AiAgentHistory } from '../../../shared/types';

// Default prompt template for background generation
const DEFAULT_BACKGROUND_PROMPT = `You are an academic expert analyzing a research paper to identify necessary background knowledge.

Paper Title: {PAPER_TITLE}
{PAPER_ABSTRACT}

This paper contains:
{LABEL_COUNTS}

{NOVELTY_POINTS}

Please identify 5-10 background concepts that a reader should understand before reading this paper.

IMPORTANT GUIDELINES FOR EVIDENCE-BASED RECOMMENDATIONS:
- Every concept you recommend must be directly tied to specific content in the paper
- In your explanation, cite concrete examples from the paper that require this background knowledge
- Be specific: instead of "understanding neural networks is helpful", say "Section 3.1 describes a transformer architecture with multi-head attention (Equation 4), which requires understanding of attention mechanisms and matrix operations"
- Reference specific sections, equations, figures, or terminology from the paper that would be unclear without this background
- Explain exactly which parts of the paper become inaccessible without each concept
- Prioritize concepts based on how many sections/equations/figures in the paper depend on them

Format your response as a JSON array with this structure:
[
  {
    "concept": "Concept Name",
    "explanation": "Why this concept is necessary, with specific references to sections/equations/figures in the paper that require it...",
    "importance": "critical" | "important" | "helpful"
  },
  ...
]

Only output the JSON array, no other text.`;

// Prompt Editor Dialog component
interface BackgroundPromptEditorDialogProps {
  defaultPrompt: string;
  onGenerate: (prompt?: string) => void;
  isGenerating?: boolean;
  disabled?: boolean;
}

function BackgroundPromptEditorDialog({
  defaultPrompt,
  onGenerate,
  isGenerating,
  disabled,
}: BackgroundPromptEditorDialogProps) {
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
          <Eye className="w-3 h-3" />
          <Code className="w-3 h-3" />
          View/Edit Prompt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-500" />
            Background Generation Prompt
          </DialogTitle>
          <DialogDescription>
            View and customize the prompt used to generate necessary background knowledge.
            The following placeholders are available: {'{PAPER_TITLE}'}, {'{PAPER_ABSTRACT}'}, {'{LABEL_COUNTS}'}, {'{NOVELTY_POINTS}'}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          <Textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter your custom prompt..."
          />
        </div>
        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={editedPrompt === defaultPrompt}
          >
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !editedPrompt.trim()}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Background
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface NecessaryBackgroundPanelProps {
  backgrounds: NecessaryBackground[];
  onGenerateBackground?: (customPrompt?: string) => void;
  onDeleteBackground?: (backgroundId: string) => void;
  isGenerating?: boolean;
  activeSession?: AiAgentHistory | null;
  currentUserId?: string;
}

// Badge for importance level
function ImportanceBadge({ importance }: { importance: BackgroundConcept['importance'] }) {
  const config = {
    critical: {
      icon: Star,
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
      label: 'Critical',
    },
    important: {
      icon: Lightbulb,
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
      label: 'Important',
    },
    helpful: {
      icon: HelpCircle,
      className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
      label: 'Helpful',
    },
  };

  const { icon: Icon, className, label } = config[importance] || config.helpful;

  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

// Single concept card
function ConceptCard({ concept }: { concept: BackgroundConcept }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-slate-900 dark:text-white">
              {concept.concept}
            </h4>
            <ImportanceBadge importance={concept.importance} />
          </div>
          <p className={`text-sm text-slate-600 dark:text-slate-400 ${!isExpanded ? 'line-clamp-2' : ''}`}>
            {concept.explanation}
          </p>
        </div>
        {concept.explanation.length > 150 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Single background set (from one generation)
function BackgroundSet({ background, index, onDelete, currentUserId }: { background: NecessaryBackground; index: number; onDelete?: (id: string) => void; currentUserId?: string }) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group concepts by importance
  const criticalConcepts = background.concepts.filter(c => c.importance === 'critical');
  const importantConcepts = background.concepts.filter(c => c.importance === 'important');
  const helpfulConcepts = background.concepts.filter(c => c.importance === 'helpful');

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors py-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Background #{index + 1}
                <Badge variant="secondary" className="text-xs font-normal">
                  {background.concepts.length} concepts
                </Badge>
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generated on {formatDate(background.generatedAt)} by {background.generatedBy}
              </p>
            </div>
            {/* Like/Dislike buttons */}
            <LikeButtons
              targetType="necessary_background"
              targetId={background.id}
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
                      onDelete(background.id);
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
                  title="Delete background"
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

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Critical concepts */}
          {criticalConcepts.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Critical Prerequisites ({criticalConcepts.length})
              </h5>
              <div className="space-y-2">
                {criticalConcepts.map((concept, i) => (
                  <ConceptCard key={i} concept={concept} />
                ))}
              </div>
            </div>
          )}

          {/* Important concepts */}
          {importantConcepts.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Important Concepts ({importantConcepts.length})
              </h5>
              <div className="space-y-2">
                {importantConcepts.map((concept, i) => (
                  <ConceptCard key={i} concept={concept} />
                ))}
              </div>
            </div>
          )}

          {/* Helpful concepts */}
          {helpfulConcepts.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Helpful Background ({helpfulConcepts.length})
              </h5>
              <div className="space-y-2">
                {helpfulConcepts.map((concept, i) => (
                  <ConceptCard key={i} concept={concept} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function NecessaryBackgroundPanel({
  backgrounds,
  onGenerateBackground,
  onDeleteBackground,
  isGenerating,
  activeSession,
  currentUserId,
}: NecessaryBackgroundPanelProps) {
  // Check requirements for generating background
  const hasAiRead = activeSession?.sentenceAnalysis && Object.keys(activeSession.sentenceAnalysis).length > 0;
  const hasApiKey = activeSession?.apiKeySet;
  const canGenerate = hasAiRead && hasApiKey && onGenerateBackground;
  const buttonDisabled = isGenerating || !hasAiRead || !hasApiKey;

  if (backgrounds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-purple-500" />
            Background you need to read this paper
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              No background knowledge generated yet
            </p>
            {onGenerateBackground && (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    onClick={() => onGenerateBackground()}
                    disabled={buttonDisabled}
                    className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Background
                      </>
                    )}
                  </Button>
                  <BackgroundPromptEditorDialog
                    defaultPrompt={DEFAULT_BACKGROUND_PROMPT}
                    onGenerate={onGenerateBackground}
                    isGenerating={isGenerating}
                    disabled={buttonDisabled}
                  />
                </div>
                {!hasAiRead && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    AI must read the paper first. Enter Reading Mode and click "Let Agent Read".
                  </p>
                )}
                {hasAiRead && !hasApiKey && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Please set an API key in your active session first.
                  </p>
                )}
                {canGenerate && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Ready to generate background knowledge for this paper.
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
          <BookOpen className="h-5 w-5 text-purple-500" />
          Background you need to read this paper
        </h2>
        {onGenerateBackground && (
          <div className="flex items-center gap-2">
            {!hasAiRead && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                AI needs to read first
              </span>
            )}
            {hasAiRead && !hasApiKey && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Set API key first
              </span>
            )}
            <Button
              onClick={() => onGenerateBackground()}
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
                  Generate New
                </>
              )}
            </Button>
            <BackgroundPromptEditorDialog
              defaultPrompt={DEFAULT_BACKGROUND_PROMPT}
              onGenerate={onGenerateBackground}
              isGenerating={isGenerating}
              disabled={buttonDisabled}
            />
          </div>
        )}
      </div>
      <div className="space-y-4">
        {backgrounds.map((background, index) => (
          <BackgroundSet key={background.id} background={background} index={index} onDelete={onDeleteBackground} currentUserId={currentUserId} />
        ))}
      </div>
    </div>
  );
}
