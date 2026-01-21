import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { DebateSession, DebateSpeaker, UpdateDebateConfigRequest } from "@shared/types";
import {
  DebateLayout,
  DebateControls,
  ApiKeyDialog,
  PromptEditorDialog,
} from "@/components/debate";
import * as api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Scale,
  FileText,
  BookOpen,
  AlertCircle,
} from "lucide-react";

// Default prompts (should match server-side)
const DEFAULT_PROMPTS = {
  affirmative: `You are the AFFIRMATIVE debater in an academic research debate. Your role is to argue IN FAVOR of the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments supporting the proposition
2. Use evidence, logic, and research to support your claims
3. Respond to counterarguments from the negative side
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid counterpoints while defending your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}`,
  negative: `You are the NEGATIVE debater in an academic research debate. Your role is to argue AGAINST the proposition.

DEBATE TOPIC: {topic}

YOUR OBJECTIVES:
1. Present compelling arguments opposing the proposition
2. Challenge the affirmative's claims with evidence and logic
3. Identify weaknesses in pro-arguments
4. Maintain academic rigor and intellectual honesty
5. Cite provided background materials when relevant

DEBATE RULES:
- Stay focused on the topic
- Be respectful but assertive
- Acknowledge valid points while maintaining your position
- Keep responses concise (200-400 words per turn)
- Do not repeat arguments already made

{backgroundKnowledge}

{paperContext}`,
  judge: `You are the JUDGE in an academic research debate. Your role is to moderate and ultimately decide the debate.

DEBATE TOPIC: {topic}

YOUR RESPONSIBILITIES:
1. Monitor the debate for rule violations
2. Intervene if arguments become off-topic or circular
3. Ensure both sides get fair opportunity to speak
4. Track the strength of arguments from both sides
5. Deliver a final verdict when the debate concludes

INTERVENTION TRIGGERS:
- Off-topic discussion (redirect back to the proposition)
- Repeated arguments (ask for new points)
- Personal attacks (warn and redirect)
- Factual inaccuracies (request clarification)
- Circular reasoning (note it for the record)

WHEN CONCLUDING:
Provide a structured verdict:
1. Summary of strongest affirmative arguments
2. Summary of strongest negative arguments
3. Key points of contention
4. Your decision (Affirmative wins / Negative wins / Draw)
5. Reasoning for your decision

You will be prompted to intervene or conclude. Respond with "NO_INTERVENTION" if the debate is proceeding well.

{backgroundKnowledge}

{paperContext}`,
};

export default function DebateView() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [debate, setDebate] = useState<DebateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);

  // Dialog states
  const [apiKeyDialog, setApiKeyDialog] = useState<{
    open: boolean;
    agent: 'affirmative' | 'negative' | 'judge';
  }>({ open: false, agent: 'affirmative' });

  const [promptDialog, setPromptDialog] = useState<{
    open: boolean;
    agent: 'affirmative' | 'negative' | 'judge';
  }>({ open: false, agent: 'affirmative' });

  // Auto-continue ref
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  // Load debate
  const loadDebate = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getDebate(id);
      setDebate(data);
    } catch (error) {
      console.error("Failed to load debate:", error);
      setLocation("/debates");
    } finally {
      setIsLoading(false);
    }
  }, [id, setLocation]);

  useEffect(() => {
    loadDebate();
  }, [loadDebate]);

  // Auto-play loop
  useEffect(() => {
    if (!debate || debate.status !== 'active' || !autoPlay) return;

    const interval = setInterval(async () => {
      if (!autoPlayRef.current) return;

      try {
        const data = await api.continueDebate(id!);
        setDebate(data.session);

        // Stop if concluded
        if (data.session.status === 'concluded') {
          setAutoPlay(false);
        }
      } catch (error) {
        console.error("Auto-continue failed:", error);
      }
    }, 3000); // Continue every 3 seconds

    return () => clearInterval(interval);
  }, [debate?.status, autoPlay, id]);

  // Actions
  const handleStart = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const data = await api.startDebate(id);
      setDebate(data.session);
      setAutoPlay(true);
      toast.success("Debate started!");
    } catch (error: any) {
      toast.error(error.message || "Failed to start debate");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const data = await api.continueDebate(id);
      setDebate(data.session);
    } catch (error: any) {
      toast.error(error.message || "Failed to continue debate");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    setAutoPlay(false);
    setIsActionLoading(true);
    try {
      const data = await api.pauseDebate(id);
      setDebate(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to pause debate");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const data = await api.resumeDebate(id);
      setDebate(data);
      setAutoPlay(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to resume debate");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConclude = async () => {
    if (!id) return;
    setAutoPlay(false);
    setIsActionLoading(true);
    try {
      const data = await api.concludeDebate(id);
      setDebate(data.session);
      toast.success("Debate concluded!");
    } catch (error: any) {
      toast.error(error.message || "Failed to conclude debate");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleIntervene = async (message: string, targetAgent?: DebateSpeaker) => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const data = await api.interveneDebate(id, message, targetAgent);
      setDebate(data);
      toast.success("Intervention added");
    } catch (error: any) {
      toast.error(error.message || "Failed to intervene");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSetApiKey = async (apiKey: string) => {
    if (!id) return;
    setIsActionLoading(true);
    try {
      const data = await api.setDebateApiKey(id, apiKeyDialog.agent, apiKey);
      setDebate(data);
      setApiKeyDialog({ ...apiKeyDialog, open: false });
      toast.success("API key saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save API key");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdatePrompt = async (prompt: string) => {
    if (!id || !debate) return;
    setIsActionLoading(true);
    try {
      const configKey = `${promptDialog.agent}Config` as keyof Pick<UpdateDebateConfigRequest, 'affirmativeConfig' | 'negativeConfig' | 'judgeConfig'>;
      const updateData: UpdateDebateConfigRequest = {
        [configKey]: {
          systemPrompt: prompt,
        },
      };
      const data = await api.updateDebateConfig(id, updateData);
      setDebate(data);
      setPromptDialog({ ...promptDialog, open: false });
      toast.success("Prompt updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update prompt");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Check if all API keys are set
  const allKeysSet = debate &&
    debate.affirmativeConfig.apiKeySet &&
    debate.negativeConfig.apiKeySet &&
    debate.judgeConfig.apiKeySet;

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="grid grid-cols-3 gap-4 h-[600px]">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Debate not found</h3>
            <Button asChild>
              <Link href="/debates">Back to Debates</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/debates">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-500" />
                {debate.title}
              </h1>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {debate.topic}
              </p>
            </div>

            {/* Background knowledge indicator */}
            {debate.backgroundKnowledge && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Has context
              </Badge>
            )}

            {/* Linked papers indicator */}
            {debate.paperIds.length > 0 && (
              <Badge variant="outline" className="hidden sm:flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {debate.paperIds.length} paper{debate.paperIds.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Setup warning */}
          {debate.status === 'setup' && !allKeysSet && (
            <div className="mt-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Set API keys for all agents before starting the debate
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 container mx-auto p-4 min-h-0">
        <DebateLayout
          debate={debate}
          onEditAffirmativeConfig={() => setPromptDialog({ open: true, agent: 'affirmative' })}
          onEditNegativeConfig={() => setPromptDialog({ open: true, agent: 'negative' })}
          onEditJudgeConfig={() => setPromptDialog({ open: true, agent: 'judge' })}
          onSetAffirmativeApiKey={() => setApiKeyDialog({ open: true, agent: 'affirmative' })}
          onSetNegativeApiKey={() => setApiKeyDialog({ open: true, agent: 'negative' })}
          onSetJudgeApiKey={() => setApiKeyDialog({ open: true, agent: 'judge' })}
        />
      </div>

      {/* Controls */}
      <DebateControls
        status={debate.status}
        turnCount={debate.turnCount}
        maxTurns={debate.maxTurns}
        autoPlay={autoPlay}
        onAutoPlayChange={setAutoPlay}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onContinue={handleContinue}
        onConclude={handleConclude}
        onIntervene={handleIntervene}
        isLoading={isActionLoading}
      />

      {/* API Key Dialog */}
      <ApiKeyDialog
        open={apiKeyDialog.open}
        onOpenChange={(open) => setApiKeyDialog({ ...apiKeyDialog, open })}
        agent={apiKeyDialog.agent}
        modelId={
          apiKeyDialog.agent === 'affirmative' ? debate.affirmativeConfig.modelId :
          apiKeyDialog.agent === 'negative' ? debate.negativeConfig.modelId :
          debate.judgeConfig.modelId
        }
        onSubmit={handleSetApiKey}
        isLoading={isActionLoading}
      />

      {/* Prompt Editor Dialog */}
      <PromptEditorDialog
        open={promptDialog.open}
        onOpenChange={(open) => setPromptDialog({ ...promptDialog, open })}
        agent={promptDialog.agent}
        currentPrompt={
          promptDialog.agent === 'affirmative' ? debate.affirmativeConfig.systemPrompt :
          promptDialog.agent === 'negative' ? debate.negativeConfig.systemPrompt :
          debate.judgeConfig.systemPrompt
        }
        defaultPrompt={DEFAULT_PROMPTS[promptDialog.agent]}
        onSubmit={handleUpdatePrompt}
        isLoading={isActionLoading}
      />
    </div>
  );
}
