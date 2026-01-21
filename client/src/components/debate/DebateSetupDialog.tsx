import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateDebateRequest, DEFAULT_AI_MODELS, AiModelProvider } from "@shared/types";
import { Bot, Scale, Sparkles } from "lucide-react";

interface DebateSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateDebateRequest) => void;
  isLoading?: boolean;
}

// Provider display names
const PROVIDER_NAMES: Record<AiModelProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  meta: 'Meta',
  deepseek: 'DeepSeek',
  alibaba: 'Alibaba',
  mistral: 'Mistral',
  cohere: 'Cohere',
  custom: 'Custom',
};

// Group models by provider for better organization
const AI_MODELS_BY_PROVIDER = DEFAULT_AI_MODELS.reduce((acc, model) => {
  if (!acc[model.provider]) {
    acc[model.provider] = [];
  }
  acc[model.provider].push(model);
  return acc;
}, {} as Record<AiModelProvider, typeof DEFAULT_AI_MODELS>);

export function DebateSetupDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: DebateSetupDialogProps) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [backgroundKnowledge, setBackgroundKnowledge] = useState("");
  const [maxTurns, setMaxTurns] = useState(20);

  // Agent configs - default to popular models
  const [affirmativeModel, setAffirmativeModel] = useState("gpt-5.2");
  const [negativeModel, setNegativeModel] = useState("claude-opus-4-5");
  const [judgeModel, setJudgeModel] = useState("gemini-3-pro");

  const handleSubmit = () => {
    if (!title.trim() || !topic.trim()) return;

    onSubmit({
      title: title.trim(),
      topic: topic.trim(),
      affirmativeConfig: { modelId: affirmativeModel },
      negativeConfig: { modelId: negativeModel },
      judgeConfig: { modelId: judgeModel },
      backgroundKnowledge: backgroundKnowledge.trim() || undefined,
      maxTurns,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Create New AI Research Debate
          </DialogTitle>
          <DialogDescription>
            Set up a debate between AI agents on a research topic. You'll configure
            three agents: Affirmative, Negative, and a Judge.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="topic" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="topic">Topic</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
          </TabsList>

          {/* Topic Tab */}
          <TabsContent value="topic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Debate Title</Label>
              <Input
                id="title"
                placeholder="e.g., Quantum Computing vs Classical Computing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic">Debate Proposition</Label>
              <Textarea
                id="topic"
                placeholder="e.g., Quantum computers will outperform classical computers for all practical applications within the next decade."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Write a clear proposition that the Affirmative will defend and the Negative will oppose.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTurns">Maximum Turns</Label>
              <Select value={maxTurns.toString()} onValueChange={(v) => setMaxTurns(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 turns</SelectItem>
                  <SelectItem value="20">20 turns (recommended)</SelectItem>
                  <SelectItem value="30">30 turns</SelectItem>
                  <SelectItem value="50">50 turns</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4 mt-4">
            {/* Affirmative */}
            <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-green-600" />
                <Label className="text-green-800 dark:text-green-200 font-medium">
                  Affirmative Agent (Pro)
                </Label>
              </div>
              <Select value={affirmativeModel} onValueChange={setAffirmativeModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(AI_MODELS_BY_PROVIDER).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {PROVIDER_NAMES[provider as AiModelProvider]}
                      </SelectLabel>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Will argue IN FAVOR of the proposition
              </p>
            </div>

            {/* Negative */}
            <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-5 w-5 text-red-600" />
                <Label className="text-red-800 dark:text-red-200 font-medium">
                  Negative Agent (Con)
                </Label>
              </div>
              <Select value={negativeModel} onValueChange={setNegativeModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(AI_MODELS_BY_PROVIDER).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {PROVIDER_NAMES[provider as AiModelProvider]}
                      </SelectLabel>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Will argue AGAINST the proposition
              </p>
            </div>

            {/* Judge */}
            <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="h-5 w-5 text-purple-600" />
                <Label className="text-purple-800 dark:text-purple-200 font-medium">
                  Judge Agent
                </Label>
              </div>
              <Select value={judgeModel} onValueChange={setJudgeModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(AI_MODELS_BY_PROVIDER).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {PROVIDER_NAMES[provider as AiModelProvider]}
                      </SelectLabel>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Moderates the debate and delivers the final verdict
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              You'll set API keys after creating the debate.
            </p>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="background">Background Knowledge (Optional)</Label>
              <Textarea
                id="background"
                placeholder="Provide any background context, definitions, or constraints for the debate..."
                value={backgroundKnowledge}
                onChange={(e) => setBackgroundKnowledge(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                This information will be provided to all agents as context.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">
                <strong>Coming soon:</strong> Link papers from your library as reference material
                for the debate agents.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !topic.trim() || isLoading}
          >
            {isLoading ? "Creating..." : "Create Debate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
