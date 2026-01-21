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
import { DebateSpeaker } from "@shared/types";
import { Key, Bot, Scale, AlertCircle } from "lucide-react";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: 'affirmative' | 'negative' | 'judge';
  modelId: string;
  onSubmit: (apiKey: string) => void;
  isLoading?: boolean;
}

const agentConfig = {
  affirmative: {
    label: "Affirmative",
    icon: Bot,
    color: "text-green-600",
  },
  negative: {
    label: "Negative",
    icon: Bot,
    color: "text-red-600",
  },
  judge: {
    label: "Judge",
    icon: Scale,
    color: "text-purple-600",
  },
};

function getProviderFromModel(modelId: string): string {
  if (modelId.startsWith("gpt")) return "OpenAI";
  if (modelId.startsWith("claude")) return "Anthropic";
  if (modelId.startsWith("gemini")) return "Google";
  return "Unknown Provider";
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  agent,
  modelId,
  onSubmit,
  isLoading,
}: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const config = agentConfig[agent];
  const Icon = config.icon;
  const provider = getProviderFromModel(modelId);

  const handleSubmit = () => {
    if (!apiKey.trim()) return;
    onSubmit(apiKey.trim());
    setApiKey("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Set API Key for {config.label} Agent
          </DialogTitle>
          <DialogDescription>
            Enter the {provider} API key for this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Icon className={`h-6 w-6 ${config.color}`} />
            <div>
              <div className="font-medium">{config.label} Agent</div>
              <div className="text-sm text-muted-foreground">{modelId}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">{provider} API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={`sk-... or ${provider.toLowerCase()} key`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Security note:</strong> Your API key is encrypted before storage
              and only used for this debate session.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!apiKey.trim() || isLoading}>
            {isLoading ? "Saving..." : "Save API Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
