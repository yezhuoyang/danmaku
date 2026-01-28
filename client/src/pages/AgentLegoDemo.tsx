/**
 * Agent Lego Demo Page
 *
 * A standalone demo page that runs a pre-configured research pipeline:
 * Paper Fetcher → Researcher → Writer → Notification
 */

import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/agent-lego/storage';
import { WorkflowExecutor, type ExecutionState } from '@/lib/agent-lego/execution';
import { createDemoWorkflow } from '@/lib/agent-lego/demo-workflow';
import type { Workflow, WorkflowBlock, BlockStatus } from '@shared/types';
import {
  Play,
  Pause,
  Square,
  Search,
  BookOpen,
  Lightbulb,
  FileText,
  Bell,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Download,
  RefreshCw,
  Settings,
  Blocks,
  ChevronDown,
  Key,
} from 'lucide-react';

// Available models per provider
const AVAILABLE_MODELS = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4', name: 'Claude Haiku 4' },
  ],
  google: [
    { id: 'gemini-2-pro', name: 'Gemini 2.0 Pro' },
    { id: 'gemini-2-flash', name: 'Gemini 2.0 Flash' },
  ],
};

// Model to provider mapping
const MODEL_TO_PROVIDER: Record<string, string> = {
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'claude-sonnet-4': 'anthropic',
  'claude-haiku-4': 'anthropic',
  'gemini-2-pro': 'google',
  'gemini-2-flash': 'google',
};

// Block status icons
const STATUS_ICONS: Record<BlockStatus, React.ReactNode> = {
  idle: <div className="w-3 h-3 rounded-full bg-gray-300" />,
  waiting: <Loader2 className="h-3 w-3 animate-spin text-amber-500" />,
  running: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
  completed: <CheckCircle className="h-3 w-3 text-green-500" />,
  failed: <XCircle className="h-3 w-3 text-red-500" />,
};

// Block type icons
const BLOCK_ICONS: Record<string, React.ReactNode> = {
  paper_fetcher: <Search className="h-5 w-5" />,
  researcher: <Lightbulb className="h-5 w-5" />,
  writer: <FileText className="h-5 w-5" />,
  notification: <Bell className="h-5 w-5" />,
};

interface BlockStatusCardProps {
  block: WorkflowBlock;
  isActive: boolean;
  output?: unknown;
}

function BlockStatusCard({ block, isActive, output }: BlockStatusCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`transition-all ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-muted">
              {BLOCK_ICONS[block.type] || <Blocks className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-sm">{block.name}</CardTitle>
              <CardDescription className="text-xs capitalize">{block.type.replace(/_/g, ' ')}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {STATUS_ICONS[block.status]}
            <Badge variant={block.status === 'completed' ? 'default' : block.status === 'failed' ? 'destructive' : 'secondary'}>
              {block.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {(block.lastOutput !== undefined || output !== undefined) && (
        <CardContent className="pt-0">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide Output' : 'Show Output'}
          </Button>
          {expanded && (
            <ScrollArea className="h-40 mt-2 p-2 bg-muted rounded text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(output ?? block.lastOutput, null, 2)}
              </pre>
            </ScrollArea>
          )}
        </CardContent>
      )}
      {block.lastError && (
        <CardContent className="pt-0">
          <div className="text-xs text-red-500 p-2 bg-red-50 rounded">
            {block.lastError}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function AgentLegoDemo() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Demo state
  const [topic, setTopic] = useState('transformer attention mechanisms');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ openai: '', anthropic: '', google: '' });
  const [researcherModel, setResearcherModel] = useState('gpt-4o');
  const [writerModel, setWriterModel] = useState('gpt-4o');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [executor, setExecutor] = useState<WorkflowExecutor | null>(null);
  const [logs, setLogs] = useState<Array<{ timestamp: number; message: string; data?: unknown }>>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);

  // Initialize storage
  useEffect(() => {
    storage.init().catch(console.error);
  }, []);

  // Load saved API keys
  useEffect(() => {
    async function loadApiKeys() {
      try {
        await storage.init();
        const keys = await storage.getApiKeys();
        setApiKeys({
          openai: keys.openai || '',
          anthropic: keys.anthropic || '',
          google: keys.google || '',
        });
      } catch (e) {
        console.error('Failed to load API keys:', e);
      }
    }
    loadApiKeys();
  }, []);

  // Save API key when changed
  const handleApiKeyChange = useCallback(async (provider: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }));
    try {
      const keys = await storage.getApiKeys();
      keys[provider] = key;
      await storage.saveApiKeys(keys);
    } catch (e) {
      console.error('Failed to save API key:', e);
    }
  }, []);

  // Check if required API keys are configured
  const getRequiredProviders = useCallback(() => {
    const providers = new Set<string>();
    providers.add(MODEL_TO_PROVIDER[researcherModel]);
    providers.add(MODEL_TO_PROVIDER[writerModel]);
    return Array.from(providers);
  }, [researcherModel, writerModel]);

  const hasRequiredApiKeys = useCallback(() => {
    const required = getRequiredProviders();
    return required.every(provider => apiKeys[provider]?.trim());
  }, [getRequiredProviders, apiKeys]);

  // Create and run workflow
  const handleRun = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in first');
      return;
    }

    if (!hasRequiredApiKeys()) {
      const missing = getRequiredProviders().filter(p => !apiKeys[p]?.trim());
      toast.error(`Missing API keys for: ${missing.join(', ')}`);
      setShowApiConfig(true);
      return;
    }

    if (!topic.trim()) {
      toast.error('Please enter a research topic');
      return;
    }

    // Create workflow with configured models
    const newWorkflow = createDemoWorkflow(user.id, topic);

    // Update block configs with selected models
    newWorkflow.blocks.forEach(block => {
      if (block.type === 'researcher') {
        block.config.modelId = researcherModel;
      } else if (block.type === 'writer') {
        block.config.modelId = writerModel;
      }
    });

    setWorkflow(newWorkflow);
    setLogs([]);
    setFinalReport(null);
    setIsRunning(true);
    setIsPaused(false);

    // Add initial input to first block (paper fetcher)
    newWorkflow.blocks[0].lastInput = topic;

    // Create executor with all configured API keys
    const newExecutor = new WorkflowExecutor(newWorkflow, {
      apiKeys: apiKeys,
      onBlockStart: (blockId) => {
        setLogs((prev) => [...prev, { timestamp: Date.now(), message: `Starting block: ${blockId}` }]);
        setWorkflow((w) => {
          if (!w) return w;
          return {
            ...w,
            blocks: w.blocks.map((b) => (b.id === blockId ? { ...b, status: 'running' } : b)),
          };
        });
      },
      onBlockComplete: (blockId, result) => {
        setLogs((prev) => [
          ...prev,
          { timestamp: Date.now(), message: `Completed block: ${blockId}`, data: result },
        ]);
        setWorkflow((w) => {
          if (!w) return w;
          return {
            ...w,
            blocks: w.blocks.map((b) =>
              b.id === blockId ? { ...b, status: 'completed', lastOutput: result.output } : b
            ),
          };
        });

        // Check if this is the notification block (final output)
        const block = newWorkflow.blocks.find((b) => b.id === blockId);
        if (block?.type === 'notification' && result.output) {
          const output = result.output as { fullContent?: string };
          if (output.fullContent) {
            setFinalReport(output.fullContent);
          }
        }
      },
      onBlockError: (blockId, error) => {
        setLogs((prev) => [...prev, { timestamp: Date.now(), message: `Error in block ${blockId}: ${error}` }]);
        setWorkflow((w) => {
          if (!w) return w;
          return {
            ...w,
            blocks: w.blocks.map((b) =>
              b.id === blockId ? { ...b, status: 'failed', lastError: error } : b
            ),
          };
        });
      },
      onStatusChange: (status) => {
        setLogs((prev) => [...prev, { timestamp: Date.now(), message: `Workflow status: ${status}` }]);
        if (status === 'completed') {
          toast.success('Workflow completed successfully!');
          setIsRunning(false);
        } else if (status === 'failed') {
          toast.error('Workflow failed');
          setIsRunning(false);
        } else if (status === 'paused') {
          setIsPaused(true);
        }
      },
      onProgress: (completed, total) => {
        setLogs((prev) => [...prev, { timestamp: Date.now(), message: `Progress: ${completed}/${total} blocks` }]);
      },
    });

    setExecutor(newExecutor);

    try {
      const state = await newExecutor.execute();
      setExecutionState(state);
    } catch (error) {
      toast.error(`Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunning(false);
    }
  }, [user, apiKeys, topic, researcherModel, writerModel, hasRequiredApiKeys, getRequiredProviders]);

  // Pause workflow
  const handlePause = useCallback(() => {
    if (executor) {
      executor.pause();
      setIsPaused(true);
    }
  }, [executor]);

  // Resume workflow
  const handleResume = useCallback(async () => {
    if (executor) {
      setIsPaused(false);
      try {
        const state = await executor.resume();
        setExecutionState(state);
      } catch (error) {
        toast.error(`Resume error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }, [executor]);

  // Stop workflow
  const handleStop = useCallback(() => {
    if (executor) {
      executor.stop();
      setIsRunning(false);
      setIsPaused(false);
      toast.info('Workflow stopped');
    }
  }, [executor]);

  // Download report
  const handleDownloadReport = useCallback(() => {
    if (!finalReport) return;

    const blob = new Blob([finalReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_report_${topic.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  }, [finalReport, topic]);

  // Show login required if not authenticated
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>Please sign in to run the Agent Lego demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/login')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = workflow
    ? Math.round((workflow.blocks.filter((b) => b.status === 'completed').length / workflow.blocks.length) * 100)
    : 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Blocks className="h-6 w-6 text-indigo-500" />
          Agent Lego Demo: Research Pipeline
        </h1>
        <p className="text-muted-foreground mt-1">
          Watch a multi-agent workflow fetch papers from arXiv, analyze them with AI, and generate a research report.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Configuration and Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Research Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., transformer attention mechanisms"
                  disabled={isRunning}
                />
              </div>

              <Separator />

              {/* Per-Agent Model Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Agent Models</Label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Researcher
                    </span>
                    <Select
                      value={researcherModel}
                      onValueChange={setResearcherModel}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                          models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Writer
                    </span>
                    <Select
                      value={writerModel}
                      onValueChange={setWriterModel}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AVAILABLE_MODELS).map(([provider, models]) => (
                          models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* API Keys Configuration */}
              <Collapsible open={showApiConfig} onOpenChange={setShowApiConfig}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-2 h-auto">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Key className="h-4 w-4" />
                      API Keys
                      {hasRequiredApiKeys() ? (
                        <Badge variant="default" className="ml-2">Configured</Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">Required</Badge>
                      )}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showApiConfig ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Configure API keys for the providers your selected models need.
                    Keys are stored locally in your browser.
                  </p>

                  {getRequiredProviders().map(provider => (
                    <div key={provider} className="space-y-1">
                      <Label htmlFor={`api-${provider}`} className="text-sm capitalize flex items-center gap-2">
                        {provider}
                        {apiKeys[provider]?.trim() ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-500" />
                        )}
                      </Label>
                      <Input
                        id={`api-${provider}`}
                        type="password"
                        value={apiKeys[provider] || ''}
                        onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                        placeholder={provider === 'openai' ? 'sk-...' : provider === 'anthropic' ? 'sk-ant-...' : 'AI...'}
                        disabled={isRunning}
                        className="font-mono text-xs"
                      />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button onClick={handleRun} className="flex-1" disabled={!hasRequiredApiKeys() || !topic.trim()}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Workflow
                  </Button>
                ) : isPaused ? (
                  <Button onClick={handleResume} className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={handlePause} variant="secondary" className="flex-1">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                <Button onClick={handleStop} variant="destructive" disabled={!isRunning}>
                  <Square className="h-4 w-4" />
                </Button>
              </div>

              {isRunning && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {finalReport && (
                <Button onClick={handleDownloadReport} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Pipeline visualization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Search className="h-4 w-4" />
                  </div>
                  <span className="text-xs mt-1">Fetch</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <span className="text-xs mt-1">Analyze</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-xs mt-1">Write</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span className="text-xs mt-1">Notify</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right columns: Blocks and Output */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="blocks">
            <TabsList>
              <TabsTrigger value="blocks">Block Status</TabsTrigger>
              <TabsTrigger value="logs">Execution Logs</TabsTrigger>
              <TabsTrigger value="report" disabled={!finalReport}>
                Report
              </TabsTrigger>
            </TabsList>

            <TabsContent value="blocks" className="space-y-4 mt-4">
              {workflow ? (
                workflow.blocks.map((block) => (
                  <BlockStatusCard
                    key={block.id}
                    block={block}
                    isActive={block.status === 'running'}
                    output={executionState?.blockOutputs.get(block.id)}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Blocks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Configure your settings and click "Run Workflow" to start</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {logs.length > 0 ? (
                      <div className="p-4 space-y-2">
                        {logs.map((log, i) => (
                          <div key={i} className="text-sm">
                            <span className="text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="ml-2">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        No logs yet. Run the workflow to see execution logs.
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="report" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Research Report</span>
                    <Button size="sm" variant="outline" onClick={handleDownloadReport}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-sans">{finalReport}</pre>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
