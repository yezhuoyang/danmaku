import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookOpen, Loader2, CheckCircle2, AlertCircle, Play, Settings2 } from 'lucide-react';
import {
  startBackgroundReading,
  getAiAgentHistories,
  getPaperBackgroundJobs,
  getReadingWorkflows,
} from '@/lib/api';
import type { AiAgentHistory, BackgroundReadingJob, ReadingWorkflowConfig, AnalysisLevel, LevelPromptConfig } from '../../../shared/types';
import { QuestionInputPanel } from './ai/reading-workflow/QuestionInputPanel';

interface StartBackgroundReadingButtonProps {
  paperId: string;
  paperTitle: string;
  arxivId?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onJobStarted?: (jobId: string) => void;
}

// Default prompts for each level
const DEFAULT_PROMPTS: Record<AnalysisLevel, { system: string; user: string }> = {
  sentence: {
    system: 'You are a research paper analysis assistant. Analyze each sentence and categorize it.',
    user: `Analyze this sentence from a research paper:
{{content}}

Context: {{context}}

Categorize as one of: Introduction, Background, Methodology, Result, Discussion, Conclusion, Related Work.
Also identify if it contains: Novelty, Key Finding, Limitation, Future Work.`,
  },
  paragraph: {
    system: 'You are a research paper analysis assistant. Analyze the given paragraph and provide structured analysis.',
    user: `Analyze this paragraph:
{{content}}

Context: {{context}}

Provide JSON with: summary, mainPoint, connectionToPrevious, label, flags (isKeyParagraph, containsNovelty).`,
  },
  section: {
    system: 'You are a research paper analysis assistant. Analyze the given section and provide structured analysis.',
    user: `Analyze this section titled "{{sectionTitle}}":
{{content}}

Provide JSON with: summary, keyContributions[], relationshipToGoals, label, flags (isCoreSection, containsMainResults).`,
  },
};

const DEFAULT_LABELS: Record<AnalysisLevel, string[]> = {
  sentence: ['Introduction', 'Background', 'Methodology', 'Result', 'Discussion', 'Conclusion', 'Related Work'],
  paragraph: ['Introduction', 'Background', 'Methodology', 'Results', 'Discussion', 'Conclusion', 'Related Work'],
  section: ['Abstract', 'Introduction', 'Background', 'Methodology', 'Experiments', 'Results', 'Discussion', 'Conclusion', 'Related Work', 'Appendix'],
};

function createDefaultLevelConfig(level: AnalysisLevel, enabled: boolean): LevelPromptConfig {
  return {
    level,
    enabled,
    systemPrompt: DEFAULT_PROMPTS[level].system,
    userPromptTemplate: DEFAULT_PROMPTS[level].user,
    labels: DEFAULT_LABELS[level],
    temperature: 0.3,
    maxTokens: level === 'section' ? 1500 : 1000,
  };
}

// Built-in workflow presets
const BUILTIN_PRESETS: ReadingWorkflowConfig[] = [
  {
    id: 'preset-standard',
    name: 'Standard Analysis',
    description: 'Basic sentence-by-sentence analysis. Fast and comprehensive.',
    userId: 'system',
    isPublic: true,
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
    strategy: 'standard',
    strategyConfig: {},
    levelConfigs: {
      sentence: createDefaultLevelConfig('sentence', true),
      paragraph: createDefaultLevelConfig('paragraph', false),
      section: createDefaultLevelConfig('section', false),
    },
    processingOptions: {
      preserveContext: true,
      contextWindowSize: 3,
    },
  },
  {
    id: 'preset-deep-reading',
    name: 'Deep Reading',
    description: 'Comprehensive multi-level analysis: sentences, paragraphs, and sections.',
    userId: 'system',
    isPublic: true,
    createdAt: 0,
    updatedAt: 0,
    strategy: 'standard',
    strategyConfig: {},
    levelConfigs: {
      sentence: createDefaultLevelConfig('sentence', true),
      paragraph: createDefaultLevelConfig('paragraph', true),
      section: createDefaultLevelConfig('section', true),
    },
    processingOptions: {
      preserveContext: true,
      contextWindowSize: 5,
    },
  },
  {
    id: 'preset-question-guided',
    name: 'Question-Guided Reading',
    description: 'Read with specific questions in mind. AI focuses on finding answers.',
    userId: 'system',
    isPublic: true,
    createdAt: 0,
    updatedAt: 0,
    strategy: 'question_guided',
    strategyConfig: {
      questions: [],
    },
    levelConfigs: {
      sentence: {
        ...createDefaultLevelConfig('sentence', true),
        userPromptTemplate: `Analyze this sentence from a research paper:
{{content}}

Context: {{context}}

Questions to keep in mind while reading:
{{questions}}

Categorize the sentence and note if it helps answer any of the questions.`,
      },
      paragraph: createDefaultLevelConfig('paragraph', false),
      section: createDefaultLevelConfig('section', false),
    },
    processingOptions: {
      preserveContext: true,
      contextWindowSize: 3,
    },
  },
  {
    id: 'preset-rethink',
    name: 'Reflective Reading',
    description: 'AI reflects after each paragraph to deepen understanding.',
    userId: 'system',
    isPublic: true,
    createdAt: 0,
    updatedAt: 0,
    strategy: 'rethink',
    strategyConfig: {
      reflectAfter: 'paragraph' as AnalysisLevel,
      reflectionPrompt: `Based on the paragraph just analyzed, reflect on:
1. What is the most important insight?
2. How does this connect to the paper's main argument?
3. Are there any gaps or questions that arise?`,
    },
    levelConfigs: {
      sentence: createDefaultLevelConfig('sentence', true),
      paragraph: createDefaultLevelConfig('paragraph', true),
      section: createDefaultLevelConfig('section', false),
    },
    processingOptions: {
      preserveContext: true,
      contextWindowSize: 5,
    },
  },
];

export function StartBackgroundReadingButton({
  paperId,
  paperTitle,
  arxivId,
  variant = 'default',
  size = 'default',
  className = '',
  onJobStarted,
}: StartBackgroundReadingButtonProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AiAgentHistory[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingJobs, setExistingJobs] = useState<BackgroundReadingJob[]>([]);

  // Workflow configuration state
  const [workflows, setWorkflows] = useState<ReadingWorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReadingWorkflowConfig | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'session' | 'workflow'>('session');

  // Fetch sessions, workflows, and existing jobs when dialog opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setSuccess(null);

      Promise.all([
        getAiAgentHistories(paperId),
        getPaperBackgroundJobs(paperId),
        getReadingWorkflows().catch(() => ({ workflows: [] })),
      ])
        .then(([historyResponse, jobsResponse, workflowResponse]) => {
          // Filter sessions that have an API key set
          const validSessions = historyResponse.histories.filter(
            (s: AiAgentHistory) => s.apiKeySet
          );
          setSessions(validSessions);
          setExistingJobs(jobsResponse.jobs);

          // Merge built-in presets with user workflows
          const allWorkflows = [...BUILTIN_PRESETS, ...workflowResponse.workflows];
          setWorkflows(allWorkflows);

          // Auto-select defaults
          if (validSessions.length > 0 && !selectedSessionId) {
            setSelectedSessionId(validSessions[0].id);
          }
          if (!selectedWorkflow) {
            const defaultWf = allWorkflows.find(w => w.isDefault);
            setSelectedWorkflow(defaultWf || allWorkflows[0]);
          }
        })
        .catch(err => {
          setError(err.message || 'Failed to load data');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, paperId]);

  const handleStart = async () => {
    if (!selectedSessionId) {
      setError('Please select a session');
      return;
    }

    if (!selectedWorkflow) {
      setError('Please select a reading workflow');
      return;
    }

    // Check if there's already a running job for this session
    const activeJob = existingJobs.find(
      job => job.sessionId === selectedSessionId &&
        (job.status === 'pending' || job.status === 'running')
    );

    if (activeJob) {
      setError('A background reading job is already running for this session');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      // Prepare workflow config with questions if using question-guided strategy
      const workflowConfig = {
        ...selectedWorkflow,
        strategyConfig: selectedWorkflow.strategy === 'question_guided'
          ? { ...selectedWorkflow.strategyConfig, questions }
          : selectedWorkflow.strategyConfig,
      };

      const response = await startBackgroundReading(paperId, selectedSessionId, workflowConfig);
      setSuccess(`Background reading started! Job ID: ${response.jobId.slice(0, 8)}...`);
      onJobStarted?.(response.jobId);

      // Close dialog after short delay
      setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to start background reading');
    } finally {
      setStarting(false);
    }
  };

  // Check if paper has an ArXiv ID
  if (!arxivId) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <BookOpen className="h-4 w-4 mr-2" />
        Background Read
      </Button>
    );
  }

  const activeJob = existingJobs.find(
    job => job.status === 'pending' || job.status === 'running'
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {activeJob ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Reading... ({activeJob.progress.percentComplete}%)
            </>
          ) : (
            <>
              <BookOpen className="h-4 w-4 mr-2" />
              Background Read
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Start Background Reading
          </DialogTitle>
          <DialogDescription>
            Start AI reading for this paper in the background. Reading will continue even if you navigate away or close the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Paper info card */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Paper</Label>
            <p className="text-sm font-medium mt-1 line-clamp-2">{paperTitle}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                No AI sessions with API keys found. Create a session and set your API key by entering Reading Mode first.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'session' | 'workflow')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="session">Session</TabsTrigger>
                <TabsTrigger value="workflow" className="flex items-center gap-1">
                  <Settings2 className="h-3 w-3" />
                  Workflow
                </TabsTrigger>
              </TabsList>

              <TabsContent value="session" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="session" className="text-sm">Select AI Session</Label>
                  <Select
                    value={selectedSessionId || undefined}
                    onValueChange={setSelectedSessionId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a session..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map(session => (
                        <SelectItem key={session.id} value={session.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{session.title || 'Untitled Session'}</span>
                            <span className="text-xs text-muted-foreground">
                              ({session.modelUsed || 'gpt-4o-mini'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="workflow" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label className="text-sm">Reading Workflow</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {workflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedWorkflow?.id === workflow.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedWorkflow(workflow)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{workflow.name}</span>
                          {workflow.userId === 'system' && (
                            <span className="text-[10px] bg-slate-500/10 text-slate-500 px-1.5 py-0.5 rounded">
                              Built-in
                            </span>
                          )}
                          {workflow.isDefault && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {workflow.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {workflow.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question Input for question-guided mode */}
                {selectedWorkflow?.strategy === 'question_guided' && (
                  <div className="border-t pt-3">
                    <QuestionInputPanel
                      questions={questions}
                      onChange={setQuestions}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {activeJob && !loading && (
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                A background reading job is already running ({activeJob.progress.percentComplete}% complete).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading || starting || sessions.length === 0 || !!activeJob || !selectedSessionId || !selectedWorkflow}
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Reading
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StartBackgroundReadingButton;
