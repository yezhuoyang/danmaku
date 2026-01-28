import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Play, Trash2, Plus, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getReadingWorkflows,
  createReadingWorkflow,
  updateReadingWorkflow,
  deleteReadingWorkflow,
} from '@/lib/api';
import type {
  ReadingWorkflowConfig,
  ReadingStrategyType,
  AnalysisLevel,
  LevelPromptConfig,
} from '@shared/types';
import { StrategySelector } from './StrategySelector';
import { LevelConfigPanel } from './LevelConfigPanel';
import { QuestionInputPanel } from './QuestionInputPanel';

interface ReadingWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWorkflow: (workflow: ReadingWorkflowConfig | null) => void;
  onStartReading: (workflow: ReadingWorkflowConfig, questions?: string[]) => void;
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

function createDefaultWorkflow(userId: string): Omit<ReadingWorkflowConfig, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'New Workflow',
    description: '',
    userId,
    isPublic: false,
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
  };
}

// Built-in workflow presets (always available, not stored in database)
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

export function ReadingWorkflowDialog({
  open,
  onOpenChange,
  onSelectWorkflow,
  onStartReading,
}: ReadingWorkflowDialogProps) {
  const [workflows, setWorkflows] = useState<ReadingWorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReadingWorkflowConfig | null>(null);
  const [editedWorkflow, setEditedWorkflow] = useState<Partial<ReadingWorkflowConfig> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'select' | 'edit'>('select');

  // Load workflows when dialog opens
  useEffect(() => {
    if (open) {
      loadWorkflows();
    }
  }, [open]);

  async function loadWorkflows() {
    setIsLoading(true);
    try {
      const response = await getReadingWorkflows();
      // Merge built-in presets with user workflows
      const allWorkflows = [...BUILTIN_PRESETS, ...response.workflows];
      setWorkflows(allWorkflows);
      // Auto-select default workflow if available
      if (!selectedWorkflow) {
        const defaultWf = allWorkflows.find(w => w.isDefault);
        if (defaultWf) {
          setSelectedWorkflow(defaultWf);
        }
      }
    } catch (error) {
      // Even if API fails, still show built-in presets
      setWorkflows(BUILTIN_PRESETS);
      if (!selectedWorkflow) {
        setSelectedWorkflow(BUILTIN_PRESETS[0]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectWorkflow(workflow: ReadingWorkflowConfig) {
    setSelectedWorkflow(workflow);
    setEditedWorkflow(null);
  }

  function handleCreateNew() {
    const newWorkflow = createDefaultWorkflow('');
    setEditedWorkflow(newWorkflow);
    setSelectedWorkflow(null);
    setActiveTab('edit');
  }

  function handleEditWorkflow(workflow: ReadingWorkflowConfig) {
    setEditedWorkflow({ ...workflow });
    setActiveTab('edit');
  }

  async function handleSaveWorkflow() {
    if (!editedWorkflow) return;

    setIsSaving(true);
    try {
      if (editedWorkflow.id) {
        // Update existing
        const response = await updateReadingWorkflow(editedWorkflow.id, {
          name: editedWorkflow.name,
          description: editedWorkflow.description,
          strategy: editedWorkflow.strategy,
          strategyConfig: editedWorkflow.strategyConfig,
          levelConfigs: editedWorkflow.levelConfigs,
          processingOptions: editedWorkflow.processingOptions,
          isPublic: editedWorkflow.isPublic,
        });
        setWorkflows(workflows.map(w => w.id === response.workflow.id ? response.workflow : w));
        setSelectedWorkflow(response.workflow);
        toast.success('Workflow updated');
      } else {
        // Create new
        const response = await createReadingWorkflow({
          name: editedWorkflow.name || 'New Workflow',
          description: editedWorkflow.description,
          strategy: editedWorkflow.strategy || 'standard',
          strategyConfig: editedWorkflow.strategyConfig,
          levelConfigs: editedWorkflow.levelConfigs || {},
          processingOptions: editedWorkflow.processingOptions,
          isPublic: editedWorkflow.isPublic,
        });
        setWorkflows([...workflows, response.workflow]);
        setSelectedWorkflow(response.workflow);
        toast.success('Workflow created');
      }
      setEditedWorkflow(null);
      setActiveTab('select');
    } catch (error) {
      toast.error('Failed to save workflow');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteWorkflow(workflow: ReadingWorkflowConfig) {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await deleteReadingWorkflow(workflow.id);
      setWorkflows(workflows.filter(w => w.id !== workflow.id));
      if (selectedWorkflow?.id === workflow.id) {
        setSelectedWorkflow(null);
      }
      toast.success('Workflow deleted');
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  }

  function handleStartReading() {
    const workflowToUse = editedWorkflow || selectedWorkflow;
    if (workflowToUse) {
      onStartReading(workflowToUse as ReadingWorkflowConfig, questions);
      onOpenChange(false);
    }
  }

  const currentWorkflow = editedWorkflow || selectedWorkflow;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Reading Workflow Configuration
          </DialogTitle>
          <DialogDescription>
            Configure how the AI analyzes the paper - select a strategy, customize prompts, and enable multi-level analysis.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'select' | 'edit')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Select Workflow</TabsTrigger>
            <TabsTrigger value="edit">
              {editedWorkflow?.id ? 'Edit Workflow' : editedWorkflow ? 'New Workflow' : 'Edit'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  {workflows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No workflows yet. Create one to get started.
                    </p>
                  ) : (
                    workflows.map((workflow) => (
                      <div
                        key={workflow.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedWorkflow?.id === workflow.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => handleSelectWorkflow(workflow)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {workflow.name}
                              {workflow.userId === 'system' && (
                                <span className="text-xs bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded">
                                  Built-in
                                </span>
                              )}
                              {workflow.isDefault && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                  Default
                                </span>
                              )}
                              {workflow.isPublic && workflow.userId !== 'system' && (
                                <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">
                                  Public
                                </span>
                              )}
                            </div>
                            {workflow.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {workflow.description}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                              <span>Strategy: {workflow.strategy}</span>
                              <span>|</span>
                              <span>
                                Levels: {['sentence', 'paragraph', 'section']
                                  .filter(l => workflow.levelConfigs?.[l as AnalysisLevel]?.enabled)
                                  .join(', ') || 'None'}
                              </span>
                            </div>
                          </div>
                          {/* Only show edit/delete for user-created workflows */}
                          {workflow.userId !== 'system' && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditWorkflow(workflow);
                                }}
                              >
                                <Settings2 className="w-4 h-4" />
                              </Button>
                              {!workflow.isDefault && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteWorkflow(workflow);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Button variant="outline" onClick={handleCreateNew} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Workflow
                </Button>

                {/* Question Input for question-guided mode */}
                {selectedWorkflow?.strategy === 'question_guided' && (
                  <QuestionInputPanel
                    questions={questions}
                    onChange={setQuestions}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="edit" className="space-y-4">
            {editedWorkflow ? (
              <>
                {/* Basic Info */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input
                      id="name"
                      value={editedWorkflow.name || ''}
                      onChange={(e) =>
                        setEditedWorkflow({ ...editedWorkflow, name: e.target.value })
                      }
                      placeholder="My Reading Workflow"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editedWorkflow.description || ''}
                      onChange={(e) =>
                        setEditedWorkflow({ ...editedWorkflow, description: e.target.value })
                      }
                      placeholder="Describe what this workflow is for..."
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="public"
                      checked={editedWorkflow.isPublic || false}
                      onCheckedChange={(checked) =>
                        setEditedWorkflow({ ...editedWorkflow, isPublic: checked })
                      }
                    />
                    <Label htmlFor="public">Make this workflow public</Label>
                  </div>
                </div>

                {/* Strategy Selection */}
                <StrategySelector
                  value={editedWorkflow.strategy || 'standard'}
                  onChange={(strategy) =>
                    setEditedWorkflow({ ...editedWorkflow, strategy })
                  }
                  strategyConfig={editedWorkflow.strategyConfig}
                  onConfigChange={(config) =>
                    setEditedWorkflow({ ...editedWorkflow, strategyConfig: config })
                  }
                />

                {/* Level Configurations */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Analysis Levels</Label>
                  {(['sentence', 'paragraph', 'section'] as AnalysisLevel[]).map((level) => (
                    <LevelConfigPanel
                      key={level}
                      level={level}
                      config={
                        editedWorkflow.levelConfigs?.[level] ||
                        createDefaultLevelConfig(level, level === 'sentence')
                      }
                      onChange={(config) =>
                        setEditedWorkflow({
                          ...editedWorkflow,
                          levelConfigs: {
                            ...editedWorkflow.levelConfigs,
                            [level]: config,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a workflow to edit or create a new one.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === 'edit' && editedWorkflow && (
            <Button onClick={handleSaveWorkflow} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Workflow
            </Button>
          )}
          <Button
            onClick={handleStartReading}
            disabled={!currentWorkflow}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Reading
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
