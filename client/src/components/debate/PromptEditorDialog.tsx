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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bot, Scale, RotateCcw } from "lucide-react";

interface PromptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: 'affirmative' | 'negative' | 'judge';
  currentPrompt: string;
  defaultPrompt: string;
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

const agentConfig = {
  affirmative: {
    label: "Affirmative",
    icon: Bot,
    color: "text-green-600",
    description: "Argues IN FAVOR of the proposition",
  },
  negative: {
    label: "Negative",
    icon: Bot,
    color: "text-red-600",
    description: "Argues AGAINST the proposition",
  },
  judge: {
    label: "Judge",
    icon: Scale,
    color: "text-purple-600",
    description: "Moderates and delivers the verdict",
  },
};

export function PromptEditorDialog({
  open,
  onOpenChange,
  agent,
  currentPrompt,
  defaultPrompt,
  onSubmit,
  isLoading,
}: PromptEditorDialogProps) {
  const [prompt, setPrompt] = useState(currentPrompt);
  const config = agentConfig[agent];
  const Icon = config.icon;

  useEffect(() => {
    setPrompt(currentPrompt);
  }, [currentPrompt, open]);

  const handleSubmit = () => {
    onSubmit(prompt.trim());
  };

  const handleReset = () => {
    setPrompt(defaultPrompt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            Edit {config.label} Agent Prompt
          </DialogTitle>
          <DialogDescription>
            {config.description}. Customize the system prompt to change the agent's behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt">System Prompt</Label>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Default
              </Button>
            </div>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={20}
              className="font-mono text-sm"
            />
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Available placeholders:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><code className="bg-muted px-1 rounded">{"{topic}"}</code> - The debate proposition</li>
              <li><code className="bg-muted px-1 rounded">{"{backgroundKnowledge}"}</code> - User-provided context</li>
              <li><code className="bg-muted px-1 rounded">{"{paperContext}"}</code> - Linked paper information</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!prompt.trim() || isLoading}>
            {isLoading ? "Saving..." : "Save Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
