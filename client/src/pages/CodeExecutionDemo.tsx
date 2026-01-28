/**
 * Code Execution Demo Page
 *
 * A demo that shows an AI agent writing Python code to test research ideas,
 * executing it locally, debugging errors, and generating a final report.
 *
 * Workflow: Idea → Coder → Execute → (Debug Loop) → Report Writer → Done
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/agent-lego/storage';
import { callAI, type AIMessage } from '@/lib/agent-lego/execution/ai-client';
import {
  Play,
  Square,
  Code2,
  Terminal,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Download,
  Settings,
  Blocks,
  ChevronDown,
  Key,
  RotateCcw,
  Bug,
  Sparkles,
  AlertCircle,
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

const MODEL_TO_PROVIDER: Record<string, string> = {
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'claude-sonnet-4': 'anthropic',
  'claude-haiku-4': 'anthropic',
  'gemini-2-pro': 'google',
  'gemini-2-flash': 'google',
};

interface ExecutionStep {
  id: string;
  type: 'code_generation' | 'execution' | 'debug' | 'report';
  status: 'pending' | 'running' | 'completed' | 'failed';
  code?: string;
  output?: string;
  error?: string;
  timestamp: number;
  attempt?: number;
}

interface PythonStatus {
  available: boolean;
  version?: string;
  error?: string;
}

export default function CodeExecutionDemo() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Configuration
  const [researchIdea, setResearchIdea] = useState(
    'Analyze the relationship between the number of attention heads and model performance in transformers. Generate synthetic data and create a visualization.'
  );
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ openai: '', anthropic: '', google: '' });
  const [coderModel, setCoderModel] = useState('gpt-4o');
  const [reportModel, setReportModel] = useState('gpt-4o');
  const [maxDebugAttempts, setMaxDebugAttempts] = useState(3);
  const [showApiConfig, setShowApiConfig] = useState(false);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [pythonStatus, setPythonStatus] = useState<PythonStatus | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Conversation history for debugging
  const [conversationHistory, setConversationHistory] = useState<AIMessage[]>([]);

  // Initialize storage and check Python
  useEffect(() => {
    storage.init().catch(console.error);
    checkPythonStatus();
  }, []);

  // Check Python availability
  const checkPythonStatus = async () => {
    try {
      const response = await fetch('/api/agent-lego/python/status');
      const status = await response.json();
      setPythonStatus(status);
    } catch (error) {
      setPythonStatus({ available: false, error: 'Failed to check Python status' });
    }
  };

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

  const getRequiredProviders = useCallback(() => {
    const providers = new Set<string>();
    providers.add(MODEL_TO_PROVIDER[coderModel]);
    providers.add(MODEL_TO_PROVIDER[reportModel]);
    return Array.from(providers);
  }, [coderModel, reportModel]);

  const hasRequiredApiKeys = useCallback(() => {
    const required = getRequiredProviders();
    return required.every(provider => apiKeys[provider]?.trim());
  }, [getRequiredProviders, apiKeys]);

  // Add step to history
  const addStep = useCallback((step: Omit<ExecutionStep, 'id' | 'timestamp'>) => {
    const newStep: ExecutionStep = {
      ...step,
      id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setSteps(prev => [...prev, newStep]);
    setCurrentStep(newStep.id);
    return newStep.id;
  }, []);

  // Update step
  const updateStep = useCallback((id: string, updates: Partial<ExecutionStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  // Execute Python code
  const executePython = async (code: string, signal: AbortSignal): Promise<{ success: boolean; stdout: string; stderr: string }> => {
    const response = await fetch('/api/agent-lego/python/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, timeout: 60000 }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Execution API error: ${response.statusText}`);
    }

    return response.json();
  };

  // Generate code with AI
  const generateCode = async (
    prompt: string,
    history: AIMessage[],
    signal: AbortSignal
  ): Promise<{ code: string; explanation: string }> => {
    const systemPrompt = `You are an expert Python programmer and data scientist.
Your task is to write Python code to test research ideas and analyze data.

IMPORTANT GUIDELINES:
1. Write complete, runnable Python code
2. Include all necessary imports
3. Use matplotlib for visualizations (save to file, don't show)
4. Print results clearly for analysis
5. Handle potential errors gracefully
6. Keep code focused and efficient

When generating code:
- Always wrap your code in \`\`\`python ... \`\`\` blocks
- After the code, explain what it does briefly
- If debugging, explain what you changed and why`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: prompt },
    ];

    const response = await callAI({
      modelId: coderModel,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
      apiKeys,
      signal,
    });

    // Extract code from response
    const codeMatch = response.content.match(/```python\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : '';
    const explanation = response.content.replace(/```python\n[\s\S]*?```/g, '').trim();

    return { code, explanation };
  };

  // Generate report with AI
  const generateReport = async (
    idea: string,
    codeHistory: Array<{ code: string; output: string; error?: string }>,
    signal: AbortSignal
  ): Promise<string> => {
    const systemPrompt = `You are a research scientist writing a technical report.
Based on the research idea and the code execution results, write a comprehensive report that:
1. Summarizes the research question
2. Describes the methodology (what the code does)
3. Presents the findings and results
4. Discusses limitations and potential improvements
5. Provides conclusions

Format the report in Markdown with clear sections.`;

    const codeContext = codeHistory.map((h, i) =>
      `### Attempt ${i + 1}
\`\`\`python
${h.code}
\`\`\`
**Output:**
\`\`\`
${h.output || '(no output)'}
\`\`\`
${h.error ? `**Error:** ${h.error}` : ''}`
    ).join('\n\n');

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `## Research Idea
${idea}

## Code Execution History
${codeContext}

Please write a comprehensive research report based on the above.` },
    ];

    const response = await callAI({
      modelId: reportModel,
      messages,
      temperature: 0.7,
      maxTokens: 4096,
      apiKeys,
      signal,
    });

    return response.content;
  };

  // Main execution loop
  const handleRun = async () => {
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

    if (!researchIdea.trim()) {
      toast.error('Please enter a research idea');
      return;
    }

    if (!pythonStatus?.available) {
      toast.error('Python is not available on the server');
      return;
    }

    setIsRunning(true);
    setSteps([]);
    setFinalReport(null);
    setConversationHistory([]);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const codeHistory: Array<{ code: string; output: string; error?: string }> = [];
    let currentConversation: AIMessage[] = [];
    let debugAttempt = 0;
    let lastSuccessfulOutput = '';

    try {
      // Step 1: Generate initial code
      const genStepId = addStep({
        type: 'code_generation',
        status: 'running',
        attempt: 1,
      });

      const initialPrompt = `Research Idea: ${researchIdea}

Please write Python code to test this research idea. The code should:
1. Generate or load appropriate data
2. Perform the analysis
3. Create visualizations (save to files)
4. Print clear results and findings`;

      const { code, explanation } = await generateCode(initialPrompt, [], signal);

      if (!code) {
        throw new Error('Failed to generate code');
      }

      currentConversation.push({ role: 'user', content: initialPrompt });
      currentConversation.push({ role: 'assistant', content: `\`\`\`python\n${code}\n\`\`\`\n\n${explanation}` });

      updateStep(genStepId, { status: 'completed', code, output: explanation });

      // Step 2: Execute code
      let execStepId = addStep({
        type: 'execution',
        status: 'running',
        code,
        attempt: 1,
      });

      let result = await executePython(code, signal);
      codeHistory.push({ code, output: result.stdout, error: result.stderr || undefined });

      if (result.success) {
        updateStep(execStepId, { status: 'completed', output: result.stdout });
        lastSuccessfulOutput = result.stdout;
      } else {
        updateStep(execStepId, { status: 'failed', output: result.stdout, error: result.stderr });
      }

      // Step 3: Debug loop if needed
      while (!result.success && debugAttempt < maxDebugAttempts) {
        debugAttempt++;

        const debugStepId = addStep({
          type: 'debug',
          status: 'running',
          attempt: debugAttempt,
        });

        const debugPrompt = `The code failed with the following error:

\`\`\`
${result.stderr}
\`\`\`

Stdout was:
\`\`\`
${result.stdout}
\`\`\`

Please fix the code. Explain what went wrong and provide the corrected version.`;

        currentConversation.push({ role: 'user', content: debugPrompt });

        const { code: fixedCode, explanation: debugExplanation } = await generateCode(
          debugPrompt,
          currentConversation.slice(0, -1), // Don't duplicate the last message
          signal
        );

        if (!fixedCode) {
          updateStep(debugStepId, { status: 'failed', error: 'Failed to generate fixed code' });
          break;
        }

        currentConversation.push({ role: 'assistant', content: `\`\`\`python\n${fixedCode}\n\`\`\`\n\n${debugExplanation}` });

        updateStep(debugStepId, { status: 'completed', code: fixedCode, output: debugExplanation });

        // Execute fixed code
        execStepId = addStep({
          type: 'execution',
          status: 'running',
          code: fixedCode,
          attempt: debugAttempt + 1,
        });

        result = await executePython(fixedCode, signal);
        codeHistory.push({ code: fixedCode, output: result.stdout, error: result.stderr || undefined });

        if (result.success) {
          updateStep(execStepId, { status: 'completed', output: result.stdout });
          lastSuccessfulOutput = result.stdout;
        } else {
          updateStep(execStepId, { status: 'failed', output: result.stdout, error: result.stderr });
        }
      }

      // Step 4: Generate report
      const reportStepId = addStep({
        type: 'report',
        status: 'running',
      });

      const report = await generateReport(researchIdea, codeHistory, signal);
      updateStep(reportStepId, { status: 'completed', output: report });
      setFinalReport(report);

      toast.success('Workflow completed!');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        toast.info('Workflow stopped');
      } else {
        toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleDownloadReport = () => {
    if (!finalReport) return;

    const blob = new Blob([finalReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research_report_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  // Show login required if not authenticated
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>Please sign in to run the Code Execution demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/login')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Code2 className="h-6 w-6 text-emerald-500" />
          Code Execution Demo: AI Coder with Python Backend
        </h1>
        <p className="text-muted-foreground mt-1">
          Watch an AI agent write Python code to test research ideas, execute it locally, debug errors, and generate a report.
        </p>
      </div>

      {/* Python Status Banner */}
      {pythonStatus && !pythonStatus.available && (
        <Card className="mb-4 border-amber-500 bg-amber-50">
          <CardContent className="py-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              Python is not available: {pythonStatus.error}. Make sure Python is installed and accessible.
            </span>
            <Button variant="outline" size="sm" onClick={checkPythonStatus} className="ml-auto">
              <RotateCcw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {pythonStatus?.available && (
        <Card className="mb-4 border-green-500 bg-green-50">
          <CardContent className="py-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-800">
              Python ready: {pythonStatus.version}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Configuration */}
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
                <Label htmlFor="idea">Research Idea</Label>
                <Textarea
                  id="idea"
                  value={researchIdea}
                  onChange={(e) => setResearchIdea(e.target.value)}
                  placeholder="Describe the research idea you want to test with code..."
                  disabled={isRunning}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Debug Attempts</Label>
                <Select
                  value={maxDebugAttempts.toString()}
                  onValueChange={(v) => setMaxDebugAttempts(parseInt(v))}
                  disabled={isRunning}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 attempt</SelectItem>
                    <SelectItem value="2">2 attempts</SelectItem>
                    <SelectItem value="3">3 attempts</SelectItem>
                    <SelectItem value="5">5 attempts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Model Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Agent Models</Label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-emerald-500" />
                      Coder
                    </span>
                    <Select value={coderModel} onValueChange={setCoderModel} disabled={isRunning}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AVAILABLE_MODELS).flatMap(([, models]) =>
                          models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Report Writer
                    </span>
                    <Select value={reportModel} onValueChange={setReportModel} disabled={isRunning}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AVAILABLE_MODELS).flatMap(([, models]) =>
                          models.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* API Keys */}
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

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                {!isRunning ? (
                  <Button
                    onClick={handleRun}
                    className="flex-1"
                    disabled={!hasRequiredApiKeys() || !researchIdea.trim() || !pythonStatus?.available}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Workflow
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>

              {steps.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{completedSteps}/{steps.length} steps</span>
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

          {/* Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs">
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="mt-1">Idea</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Code2 className="h-4 w-4" />
                  </div>
                  <span className="mt-1">Code</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <span className="mt-1">Run</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <Bug className="h-4 w-4" />
                  </div>
                  <span className="mt-1">Debug</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-col items-center">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="mt-1">Report</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right columns: Execution */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="steps">
            <TabsList>
              <TabsTrigger value="steps">Execution Steps</TabsTrigger>
              <TabsTrigger value="code">Code History</TabsTrigger>
              <TabsTrigger value="report" disabled={!finalReport}>
                Report
              </TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="space-y-4 mt-4">
              {steps.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 pr-4">
                    {steps.map((step) => (
                      <Card key={step.id} className={step.id === currentStep ? 'ring-2 ring-blue-500' : ''}>
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {step.type === 'code_generation' && <Code2 className="h-4 w-4 text-emerald-500" />}
                              {step.type === 'execution' && <Terminal className="h-4 w-4 text-blue-500" />}
                              {step.type === 'debug' && <Bug className="h-4 w-4 text-amber-500" />}
                              {step.type === 'report' && <FileText className="h-4 w-4 text-purple-500" />}
                              <CardTitle className="text-sm capitalize">
                                {step.type.replace(/_/g, ' ')}
                                {step.attempt && step.attempt > 1 && ` (Attempt ${step.attempt})`}
                              </CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                              {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                              {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                              <Badge variant={
                                step.status === 'completed' ? 'default' :
                                step.status === 'failed' ? 'destructive' : 'secondary'
                              }>
                                {step.status}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        {(step.code || step.output || step.error) && (
                          <CardContent className="pt-0 space-y-2">
                            {step.code && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Code</Label>
                                <ScrollArea className="h-32 bg-slate-900 rounded p-2">
                                  <pre className="text-xs text-slate-100 font-mono">{step.code}</pre>
                                </ScrollArea>
                              </div>
                            )}
                            {step.output && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Output</Label>
                                <ScrollArea className="h-24 bg-muted rounded p-2">
                                  <pre className="text-xs whitespace-pre-wrap">{step.output}</pre>
                                </ScrollArea>
                              </div>
                            )}
                            {step.error && (
                              <div className="space-y-1">
                                <Label className="text-xs text-red-500">Error</Label>
                                <ScrollArea className="h-24 bg-red-50 rounded p-2">
                                  <pre className="text-xs text-red-600 whitespace-pre-wrap">{step.error}</pre>
                                </ScrollArea>
                              </div>
                            )}
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Blocks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Configure your settings and click "Run Workflow" to start</p>
                    <p className="text-sm mt-2">The AI will write Python code, execute it, debug any errors, and generate a report.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="code" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <div className="p-4 space-y-4">
                      {steps.filter(s => s.code).map((step, i) => (
                        <div key={step.id} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Badge variant="outline">{i + 1}</Badge>
                            {step.type === 'debug' ? 'Debug Fix' : 'Initial Code'}
                            {step.attempt && step.attempt > 1 && ` (Attempt ${step.attempt})`}
                          </div>
                          <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-x-auto">
                            {step.code}
                          </pre>
                        </div>
                      ))}
                      {steps.filter(s => s.code).length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          No code generated yet. Run the workflow to see code.
                        </div>
                      )}
                    </div>
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
