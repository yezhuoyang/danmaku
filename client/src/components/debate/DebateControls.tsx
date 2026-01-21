import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DebateStatus, DebateSpeaker } from "@shared/types";
import {
  Play,
  Pause,
  SkipForward,
  MessageSquare,
  Gavel,
  Send,
  StopCircle,
} from "lucide-react";

interface DebateControlsProps {
  status: DebateStatus;
  turnCount: number;
  maxTurns: number;
  autoPlay: boolean;
  onAutoPlayChange: (enabled: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onContinue: () => void;
  onConclude: () => void;
  onIntervene: (message: string, targetAgent?: DebateSpeaker) => void;
  isLoading?: boolean;
}

export function DebateControls({
  status,
  turnCount,
  maxTurns,
  autoPlay,
  onAutoPlayChange,
  onStart,
  onPause,
  onResume,
  onContinue,
  onConclude,
  onIntervene,
  isLoading,
}: DebateControlsProps) {
  const [interventionMessage, setInterventionMessage] = useState("");
  const [targetAgent, setTargetAgent] = useState<DebateSpeaker | "all">("all");

  const handleIntervene = () => {
    if (!interventionMessage.trim()) return;
    onIntervene(interventionMessage, targetAgent === "all" ? undefined : targetAgent);
    setInterventionMessage("");
  };

  const isSetup = status === "setup";
  const isActive = status === "active";
  const isPaused = status === "paused";
  const isConcluded = status === "concluded";

  return (
    <div className="border-t bg-muted/30 p-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Turn Progress</span>
            <span className="font-medium">
              {turnCount} / {maxTurns}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(turnCount / maxTurns) * 100}%` }}
            />
          </div>
        </div>

        <Badge variant={isActive ? "default" : isPaused ? "secondary" : isConcluded ? "outline" : "outline"}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>

      {/* Main controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isSetup && (
          <Button onClick={onStart} disabled={isLoading}>
            <Play className="h-4 w-4 mr-2" />
            Start Debate
          </Button>
        )}

        {isActive && (
          <>
            <Button variant="outline" onClick={onPause} disabled={isLoading}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
            {!autoPlay && (
              <Button onClick={onContinue} disabled={isLoading}>
                <SkipForward className="h-4 w-4 mr-2" />
                Next Turn
              </Button>
            )}
          </>
        )}

        {isPaused && (
          <>
            <Button onClick={onResume} disabled={isLoading}>
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
            <Button variant="outline" onClick={onContinue} disabled={isLoading}>
              <SkipForward className="h-4 w-4 mr-2" />
              Step
            </Button>
          </>
        )}

        {(isActive || isPaused) && (
          <Button variant="destructive" onClick={onConclude} disabled={isLoading}>
            <Gavel className="h-4 w-4 mr-2" />
            End & Conclude
          </Button>
        )}

        {isConcluded && (
          <Badge variant="outline" className="text-base py-2 px-4">
            <StopCircle className="h-4 w-4 mr-2" />
            Debate Concluded
          </Badge>
        )}

        {/* Auto-play toggle */}
        {!isConcluded && !isSetup && (
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Auto-continue:</label>
            <Button
              variant={autoPlay ? "default" : "outline"}
              size="sm"
              onClick={() => onAutoPlayChange(!autoPlay)}
            >
              {autoPlay ? "On" : "Off"}
            </Button>
          </div>
        )}
      </div>

      {/* Intervention input */}
      {(isActive || isPaused) && (
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <Select
            value={targetAgent}
            onValueChange={(v) => setTargetAgent(v as DebateSpeaker | "all")}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Target" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="affirmative">Affirmative</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="judge">Judge</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Add instruction to agents..."
            value={interventionMessage}
            onChange={(e) => setInterventionMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleIntervene()}
            className="flex-1"
          />
          <Button onClick={handleIntervene} disabled={!interventionMessage.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
