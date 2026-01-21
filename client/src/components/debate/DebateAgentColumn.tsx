import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DebateMessage as DebateMessageType, DebateAgentConfig, DebateSpeaker } from "@shared/types";
import { DebateMessage } from "./DebateMessage";
import { Bot, Settings, Key, CheckCircle2 } from "lucide-react";

interface DebateAgentColumnProps {
  title: string;
  speaker: 'affirmative' | 'negative';
  config: DebateAgentConfig;
  messages: DebateMessageType[];
  totalTokens: number;
  isCurrentSpeaker: boolean;
  isActive: boolean;
  onEditConfig?: () => void;
  onSetApiKey?: () => void;
  className?: string;
}

const columnStyles = {
  affirmative: {
    headerBg: "bg-green-100 dark:bg-green-900/30",
    headerText: "text-green-800 dark:text-green-200",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-500",
  },
  negative: {
    headerBg: "bg-red-100 dark:bg-red-900/30",
    headerText: "text-red-800 dark:text-red-200",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-500",
  },
};

export function DebateAgentColumn({
  title,
  speaker,
  config,
  messages,
  totalTokens,
  isCurrentSpeaker,
  isActive,
  onEditConfig,
  onSetApiKey,
  className,
}: DebateAgentColumnProps) {
  const styles = columnStyles[speaker];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Filter messages for this speaker
  const speakerMessages = messages.filter(m => m.speaker === speaker);

  return (
    <Card className={cn("flex flex-col h-full", styles.border, className)}>
      {/* Header */}
      <CardHeader className={cn("pb-3", styles.headerBg)}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-lg flex items-center gap-2", styles.headerText)}>
            <Bot className="h-5 w-5" />
            {title}
          </CardTitle>
          {isCurrentSpeaker && isActive && (
            <Badge className={cn("animate-pulse", styles.badge)}>
              Speaking...
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

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2">
        {speakerMessages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No messages yet
          </div>
        ) : (
          speakerMessages.map((message) => (
            <DebateMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>
    </Card>
  );
}
