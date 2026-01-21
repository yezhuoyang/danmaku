import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DebateMessage as DebateMessageType, DebateAgentConfig } from "@shared/types";
import { DebateMessage } from "./DebateMessage";
import { Scale, Settings, Key, CheckCircle2, Trophy, Gavel } from "lucide-react";

interface DebateJudgeColumnProps {
  config: DebateAgentConfig;
  messages: DebateMessageType[];
  totalTokens: number;
  isCurrentSpeaker: boolean;
  isActive: boolean;
  conclusion?: string;
  winner?: 'affirmative' | 'negative' | 'draw';
  onEditConfig?: () => void;
  onSetApiKey?: () => void;
  className?: string;
}

export function DebateJudgeColumn({
  config,
  messages,
  totalTokens,
  isCurrentSpeaker,
  isActive,
  conclusion,
  winner,
  onEditConfig,
  onSetApiKey,
  className,
}: DebateJudgeColumnProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Filter messages for judge
  const judgeMessages = messages.filter(m => m.speaker === 'judge');

  const winnerDisplay = winner === 'affirmative'
    ? { label: 'Affirmative Wins', color: 'text-green-600 dark:text-green-400' }
    : winner === 'negative'
    ? { label: 'Negative Wins', color: 'text-red-600 dark:text-red-400' }
    : winner === 'draw'
    ? { label: 'Draw', color: 'text-yellow-600 dark:text-yellow-400' }
    : null;

  return (
    <Card className={cn("flex flex-col h-full border-purple-200 dark:border-purple-800", className)}>
      {/* Header */}
      <CardHeader className="pb-3 bg-purple-100 dark:bg-purple-900/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-purple-800 dark:text-purple-200">
            <Scale className="h-5 w-5" />
            Judge
          </CardTitle>
          {isCurrentSpeaker && isActive && (
            <Badge className="animate-pulse bg-purple-500">
              Reviewing...
            </Badge>
          )}
        </div>

        {/* Model info */}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {config.modelId || "No model selected"}
          </Badge>
          {config.apiKeySet ? (
            <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              API Key Set
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-400">
              <Key className="h-3 w-3 mr-1" />
              No API Key
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          {onSetApiKey && (
            <Button size="sm" variant="outline" onClick={onSetApiKey} className="text-xs h-7">
              <Key className="h-3 w-3 mr-1" />
              {config.apiKeySet ? "Change Key" : "Set Key"}
            </Button>
          )}
          {onEditConfig && (
            <Button size="sm" variant="outline" onClick={onEditConfig} className="text-xs h-7">
              <Settings className="h-3 w-3 mr-1" />
              Edit Prompt
            </Button>
          )}
        </div>

        {/* Token usage */}
        <div className="text-xs text-muted-foreground mt-2">
          Total tokens: {totalTokens.toLocaleString()}
        </div>
      </CardHeader>

      {/* Messages & Conclusion */}
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Conclusion Card (if concluded) */}
        {conclusion && (
          <Card className="border-2 border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/50 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gavel className="h-4 w-4 text-purple-600" />
                Final Verdict
              </CardTitle>
            </CardHeader>
            <CardContent>
              {winnerDisplay && (
                <div className={cn("flex items-center gap-2 mb-3 font-semibold text-lg", winnerDisplay.color)}>
                  <Trophy className="h-5 w-5" />
                  {winnerDisplay.label}
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap">{conclusion}</p>
            </CardContent>
          </Card>
        )}

        {judgeMessages.length === 0 && !conclusion ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Judge will intervene if needed and deliver final verdict
          </div>
        ) : (
          judgeMessages.map((message) => (
            <DebateMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>
    </Card>
  );
}
