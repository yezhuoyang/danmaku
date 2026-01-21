import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DebateSession } from "@shared/types";
import { DebateMessage } from "./DebateMessage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Scale, Settings, Key, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DebateLayoutProps {
  debate: DebateSession;
  onEditAffirmativeConfig?: () => void;
  onEditNegativeConfig?: () => void;
  onEditJudgeConfig?: () => void;
  onSetAffirmativeApiKey?: () => void;
  onSetNegativeApiKey?: () => void;
  onSetJudgeApiKey?: () => void;
  className?: string;
}

export function DebateLayout({
  debate,
  onEditAffirmativeConfig,
  onEditNegativeConfig,
  onEditJudgeConfig,
  onSetAffirmativeApiKey,
  onSetNegativeApiKey,
  onSetJudgeApiKey,
  className,
}: DebateLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isActive = debate.status === "active";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debate.messages.length]);

  // Get current speaker info
  const currentSpeakerLabel =
    debate.currentSpeaker === 'affirmative' ? 'Affirmative' :
    debate.currentSpeaker === 'negative' ? 'Negative' :
    debate.currentSpeaker === 'judge' ? 'Judge' : 'Waiting';

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Agent Status Bar */}
      <Card className="p-3 mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Affirmative Agent */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-700 dark:text-green-400">
                  Affirmative
                </div>
                <div className="text-xs text-muted-foreground">
                  {debate.affirmativeConfig.modelId}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onSetAffirmativeApiKey}
                title="Set API Key"
              >
                <Key className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onEditAffirmativeConfig}
                title="Edit Config"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
            {debate.totalTokensAffirmative > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Coins className="h-3 w-3 mr-1" />
                {debate.totalTokensAffirmative.toLocaleString()}
              </Badge>
            )}
          </div>

          {/* Judge Agent */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400">
                  Judge
                </div>
                <div className="text-xs text-muted-foreground">
                  {debate.judgeConfig.modelId}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onSetJudgeApiKey}
                title="Set API Key"
              >
                <Key className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onEditJudgeConfig}
                title="Edit Config"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
            {debate.totalTokensJudge > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Coins className="h-3 w-3 mr-1" />
                {debate.totalTokensJudge.toLocaleString()}
              </Badge>
            )}
          </div>

          {/* Negative Agent */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-red-700 dark:text-red-400">
                  Negative
                </div>
                <div className="text-xs text-muted-foreground">
                  {debate.negativeConfig.modelId}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onSetNegativeApiKey}
                title="Set API Key"
              >
                <Key className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onEditNegativeConfig}
                title="Edit Config"
              >
                <Settings className="h-3 w-3" />
              </Button>
            </div>
            {debate.totalTokensNegative > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Coins className="h-3 w-3 mr-1" />
                {debate.totalTokensNegative.toLocaleString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Current speaker indicator */}
        {isActive && (
          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">
              <span className="font-medium">{currentSpeakerLabel}</span> is speaking...
            </span>
          </div>
        )}
      </Card>

      {/* Conclusion Card (if debate is complete) */}
      {debate.status === 'completed' && debate.conclusion && (
        <Card className="p-4 mb-4 flex-shrink-0 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-800 dark:text-purple-200">
              Final Verdict
            </h3>
            {debate.winner && (
              <Badge
                className={cn(
                  "ml-auto",
                  debate.winner === 'affirmative'
                    ? "bg-green-500"
                    : debate.winner === 'negative'
                    ? "bg-red-500"
                    : "bg-gray-500"
                )}
              >
                Winner: {debate.winner === 'affirmative' ? 'Affirmative' : debate.winner === 'negative' ? 'Negative' : 'Tie'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-purple-900 dark:text-purple-100 leading-relaxed">
            {debate.conclusion}
          </p>
        </Card>
      )}

      {/* Messages - Single Scrollable Area */}
      <Card className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto p-6"
        >
          {debate.messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No messages yet. Start the debate to begin.</p>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {debate.messages.map((message) => (
                <DebateMessage key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
