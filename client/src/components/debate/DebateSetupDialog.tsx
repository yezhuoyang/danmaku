import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { CreateDebateRequest, DEFAULT_AI_MODELS, AiModelProvider, PaperWithStats } from "@shared/types";
import { Bot, Scale, Sparkles, Search, FileText, X, BookOpen, Loader2 } from "lucide-react";
import * as api from "../../lib/api";

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

  // Paper selection
  const [selectedPapers, setSelectedPapers] = useState<PaperWithStats[]>([]);
  const [paperSearchQuery, setPaperSearchQuery] = useState("");
  const [paperSearchResults, setPaperSearchResults] = useState<PaperWithStats[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [readPapersFirst, setReadPapersFirst] = useState(true);

  // Debounced paper search
  useEffect(() => {
    if (!paperSearchQuery.trim()) {
      setPaperSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await api.listPapers({ q: paperSearchQuery.trim(), limit: 10 });
        // Filter out already selected papers
        const filtered = result.papers.filter(
          (p) => !selectedPapers.some((sp) => sp.id === p.id)
        );
        setPaperSearchResults(filtered);
      } catch (error) {
        console.error("Failed to search papers:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [paperSearchQuery, selectedPapers]);

  const handleAddPaper = (paper: PaperWithStats) => {
    setSelectedPapers([...selectedPapers, paper]);
    setPaperSearchQuery("");
    setPaperSearchResults([]);
  };

  const handleRemovePaper = (paperId: string) => {
    setSelectedPapers(selectedPapers.filter((p) => p.id !== paperId));
  };

  const handleSubmit = () => {
    if (!title.trim() || !topic.trim()) return;

    onSubmit({
      title: title.trim(),
      topic: topic.trim(),
      affirmativeConfig: { modelId: affirmativeModel },
      negativeConfig: { modelId: negativeModel },
      judgeConfig: { modelId: judgeModel },
      backgroundKnowledge: backgroundKnowledge.trim() || undefined,
      paperIds: selectedPapers.length > 0 ? selectedPapers.map((p) => p.id) : undefined,
      readPapersFirst: selectedPapers.length > 0 ? readPapersFirst : undefined,
      maxTurns,
    });
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setTopic("");
      setBackgroundKnowledge("");
      setMaxTurns(20);
      setSelectedPapers([]);
      setPaperSearchQuery("");
      setPaperSearchResults([]);
      setReadPapersFirst(true);
    }
  }, [open]);

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
            <TabsTrigger value="context">
              Context
              {selectedPapers.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                  {selectedPapers.length}
                </Badge>
              )}
            </TabsTrigger>
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
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This information will be provided to all agents as context.
              </p>
            </div>

            {/* Paper Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reference Papers (Optional)
              </Label>

              {/* Paper Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search papers to add as references..."
                  value={paperSearchQuery}
                  onChange={(e) => setPaperSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results */}
              {paperSearchResults.length > 0 && (
                <ScrollArea className="h-40 border rounded-md">
                  <div className="p-2 space-y-1">
                    {paperSearchResults.map((paper) => (
                      <button
                        key={paper.id}
                        onClick={() => handleAddPaper(paper)}
                        className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <p className="text-sm font-medium line-clamp-1">{paper.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {paper.authors?.slice(0, 3).join(", ")}
                          {paper.authors && paper.authors.length > 3 && " et al."}
                        </p>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Selected Papers */}
              {selectedPapers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Selected Papers ({selectedPapers.length})</Label>
                  <div className="space-y-2">
                    {selectedPapers.map((paper) => (
                      <div
                        key={paper.id}
                        className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{paper.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {paper.authors?.slice(0, 2).join(", ")}
                            {paper.authors && paper.authors.length > 2 && " et al."}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleRemovePaper(paper.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Read Papers First Option */}
                  <div className="flex items-center space-x-2 p-3 rounded-md border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <Checkbox
                      id="readPapersFirst"
                      checked={readPapersFirst}
                      onCheckedChange={(checked) => setReadPapersFirst(checked === true)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="readPapersFirst"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                      >
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        Agents read papers before debating
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Both agents will analyze the papers before the debate starts. This adds context but increases API usage.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedPapers.length === 0 && !paperSearchQuery && (
                <p className="text-xs text-muted-foreground">
                  Add papers from your library as reference material for the debate agents.
                </p>
              )}
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
