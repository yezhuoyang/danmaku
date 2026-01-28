/**
 * ExecutionLogPanel - Real-time debugging panel for Agent Lego workflows
 *
 * Features:
 * - Top-level agent status display ("Agent [Researcher] is analyzing papers...")
 * - Per-agent expandable logs showing full conversation history
 * - Shared blackboard view for inter-agent communication
 * - Error highlighting and stack traces
 */

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Bot,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
  Clock,
  X,
  Maximize2,
  Minimize2,
  Copy,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

// Agent execution log entry
export interface AgentLogEntry {
  id: string;
  timestamp: number;
  type: 'system' | 'user' | 'assistant' | 'error' | 'info' | 'tool';
  content: string;
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
  };
}

// Per-agent log storage
export interface AgentLog {
  blockId: string;
  blockName: string;
  blockType: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  entries: AgentLogEntry[];
  currentAction?: string; // e.g., "Analyzing papers", "Writing code"
}

// Shared blackboard entry
export interface BlackboardEntry {
  key: string;
  value: unknown;
  setBy: string; // blockId
  timestamp: number;
}

// Top-level execution event
export interface ExecutionEvent {
  id: string;
  timestamp: number;
  type: 'start' | 'block_start' | 'block_complete' | 'block_error' | 'complete' | 'failed' | 'info';
  blockId?: string;
  blockName?: string;
  message: string;
  details?: string;
}

interface ExecutionLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events: ExecutionEvent[];
  agentLogs: Map<string, AgentLog>;
  blackboard: Map<string, BlackboardEntry>;
  currentBlockId: string | null;
  isRunning: boolean;
  onClear: () => void;
  /** If true, uses minimal styling for embedding in a ResizablePanel */
  embedded?: boolean;
}

export function ExecutionLogPanel({
  isOpen,
  onClose,
  events,
  agentLogs,
  blackboard,
  currentBlockId,
  isRunning,
  onClear,
  embedded = false,
}: ExecutionLogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest event
  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  // Auto-expand currently running agent
  useEffect(() => {
    if (currentBlockId) {
      setExpandedAgents(prev => new Set([...Array.from(prev), currentBlockId]));
    }
  }, [currentBlockId]);

  const toggleAgent = (blockId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString();
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const getEventIcon = (type: ExecutionEvent['type']) => {
    switch (type) {
      case 'start':
      case 'block_start':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case 'block_complete':
      case 'complete':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'block_error':
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getLogEntryIcon = (type: AgentLogEntry['type']) => {
    switch (type) {
      case 'system':
        return <Bot className="h-3 w-3 text-purple-500" />;
      case 'user':
        return <User className="h-3 w-3 text-blue-500" />;
      case 'assistant':
        return <Bot className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'tool':
        return <Database className="h-3 w-3 text-amber-500" />;
      default:
        return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (!isOpen) return null;

  const panelHeight = isExpanded ? "h-[80vh]" : "h-80";

  // Embedded mode: simplified for use inside ResizablePanel
  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Compact status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
          <div className="flex items-center gap-2 min-w-0">
            {isRunning && (
              <Badge variant="default" className="bg-blue-500 text-xs">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Running
              </Badge>
            )}
            {currentBlockId && agentLogs.get(currentBlockId) && (
              <span className="text-xs text-muted-foreground truncate">
                {agentLogs.get(currentBlockId)!.blockName}: {agentLogs.get(currentBlockId)!.currentAction || 'processing'}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onClear}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="timeline" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b px-2 h-8 flex-shrink-0">
            <TabsTrigger value="timeline" className="text-xs h-6">Timeline</TabsTrigger>
            <TabsTrigger value="agents" className="text-xs h-6">
              Agents ({agentLogs.size})
            </TabsTrigger>
            <TabsTrigger value="blackboard" className="text-xs h-6">
              Data ({blackboard.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No events yet
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "flex items-start gap-2 p-1.5 rounded text-xs",
                        event.type === 'block_error' || event.type === 'failed'
                          ? "bg-red-50 dark:bg-red-950"
                          : event.type === 'complete'
                          ? "bg-green-50 dark:bg-green-950"
                          : "bg-muted/50"
                      )}
                    >
                      {getEventIcon(event.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(event.timestamp)}
                          </span>
                          {event.blockName && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {event.blockName}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 break-words">{event.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={eventsEndRef} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="agents" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {Array.from(agentLogs.values()).map((agentLog) => (
                  <Collapsible
                    key={agentLog.blockId}
                    open={expandedAgents.has(agentLog.blockId)}
                    onOpenChange={() => toggleAgent(agentLog.blockId)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={cn(
                        "flex items-center justify-between p-2 rounded border text-xs",
                        agentLog.status === 'running' && "border-blue-500 bg-blue-50 dark:bg-blue-950",
                        agentLog.status === 'completed' && "border-green-500 bg-green-50 dark:bg-green-950",
                        agentLog.status === 'failed' && "border-red-500 bg-red-50 dark:bg-red-950"
                      )}>
                        <div className="flex items-center gap-2">
                          {expandedAgents.has(agentLog.blockId) ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <span className="font-medium truncate">{agentLog.blockName}</span>
                        </div>
                        <Badge variant={
                          agentLog.status === 'completed' ? 'default' :
                          agentLog.status === 'failed' ? 'destructive' :
                          agentLog.status === 'running' ? 'secondary' : 'outline'
                        } className="text-[10px] h-4">
                          {agentLog.status}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 ml-4 space-y-1 border-l-2 pl-2">
                        {agentLog.entries.slice(-5).map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "p-1.5 rounded text-[10px]",
                              entry.type === 'error' && "bg-red-50 dark:bg-red-950"
                            )}
                          >
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {getLogEntryIcon(entry.type)}
                              <span className="font-medium capitalize">{entry.type}</span>
                            </div>
                            <pre className="whitespace-pre-wrap font-mono max-h-20 overflow-y-auto">
                              {entry.content.length > 200 ? entry.content.slice(0, 200) + '...' : entry.content}
                            </pre>
                          </div>
                        ))}
                        {agentLog.entries.length > 5 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{agentLog.entries.length - 5} more entries
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="blackboard" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {Array.from(blackboard.values()).map((entry) => (
                  <div key={entry.key} className="p-2 rounded bg-muted/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium">{entry.key}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <pre className="mt-1 text-[10px] font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                      {typeof entry.value === 'object'
                        ? JSON.stringify(entry.value, null, 2)
                        : String(entry.value)
                      }
                    </pre>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Standard fixed bottom panel mode
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 transition-all",
      panelHeight
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm">Execution Log</h3>
          {isRunning && (
            <Badge variant="default" className="bg-blue-500">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Running
            </Badge>
          )}
          {currentBlockId && agentLogs.get(currentBlockId) && (
            <span className="text-sm text-muted-foreground">
              Agent [{agentLogs.get(currentBlockId)!.blockName}] is {agentLogs.get(currentBlockId)!.currentAction || 'processing'}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="timeline" className="h-[calc(100%-44px)]">
        <TabsList className="w-full justify-start rounded-none border-b px-4">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="agents">
            Agents ({agentLogs.size})
          </TabsTrigger>
          <TabsTrigger value="blackboard">
            Blackboard ({blackboard.size})
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab - High-level events */}
        <TabsContent value="timeline" className="h-[calc(100%-40px)] m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No execution events yet. Click "Run" to start the workflow.
                </p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-start gap-3 p-2 rounded text-sm",
                      event.type === 'block_error' || event.type === 'failed'
                        ? "bg-red-50 dark:bg-red-950"
                        : event.type === 'complete'
                        ? "bg-green-50 dark:bg-green-950"
                        : "bg-muted/50"
                    )}
                  >
                    {getEventIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </span>
                        {event.blockName && (
                          <Badge variant="outline" className="text-xs">
                            {event.blockName}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5">{event.message}</p>
                      {event.details && (
                        <pre className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                          {event.details}
                        </pre>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={eventsEndRef} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Agents Tab - Per-agent logs with conversation history */}
        <TabsContent value="agents" className="h-[calc(100%-40px)] m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {Array.from(agentLogs.values()).map((agentLog) => (
                <Collapsible
                  key={agentLog.blockId}
                  open={expandedAgents.has(agentLog.blockId)}
                  onOpenChange={() => toggleAgent(agentLog.blockId)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      agentLog.status === 'running' && "border-blue-500 bg-blue-50 dark:bg-blue-950",
                      agentLog.status === 'completed' && "border-green-500 bg-green-50 dark:bg-green-950",
                      agentLog.status === 'failed' && "border-red-500 bg-red-50 dark:bg-red-950"
                    )}>
                      <div className="flex items-center gap-3">
                        {expandedAgents.has(agentLog.blockId) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{agentLog.blockName}</span>
                            <Badge variant="outline" className="text-xs">
                              {agentLog.blockType}
                            </Badge>
                          </div>
                          {agentLog.currentAction && agentLog.status === 'running' && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {agentLog.currentAction}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agentLog.startTime && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(agentLog.startTime, agentLog.endTime)}
                          </span>
                        )}
                        <Badge variant={
                          agentLog.status === 'completed' ? 'default' :
                          agentLog.status === 'failed' ? 'destructive' :
                          agentLog.status === 'running' ? 'secondary' : 'outline'
                        }>
                          {agentLog.status}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-6 space-y-2 border-l-2 pl-4">
                      {agentLog.entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No conversation history yet.
                        </p>
                      ) : (
                        agentLog.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "p-2 rounded text-sm",
                              entry.type === 'system' && "bg-purple-50 dark:bg-purple-950",
                              entry.type === 'user' && "bg-blue-50 dark:bg-blue-950",
                              entry.type === 'assistant' && "bg-green-50 dark:bg-green-950",
                              entry.type === 'error' && "bg-red-50 dark:bg-red-950",
                              entry.type === 'tool' && "bg-amber-50 dark:bg-amber-950",
                              entry.type === 'info' && "bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {getLogEntryIcon(entry.type)}
                                <span className="text-xs font-medium capitalize">
                                  {entry.type}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatTimestamp(entry.timestamp)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {entry.metadata?.tokens && (
                                  <span className="text-xs text-muted-foreground">
                                    {entry.metadata.tokens} tokens
                                  </span>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(entry.content);
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <pre className="text-xs whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                              {entry.content}
                            </pre>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
              {agentLogs.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No agent logs yet. Start the workflow to see agent activity.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Blackboard Tab - Shared memory */}
        <TabsContent value="blackboard" className="h-[calc(100%-40px)] m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {blackboard.size === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Blackboard is empty. Agents will store shared data here during execution.
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from(blackboard.entries()).map(([key, entry]) => (
                    <div key={key} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-blue-500" />
                          <span className="font-mono font-medium text-sm">{key}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Set by: {entry.setBy}</span>
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {typeof entry.value === 'string'
                          ? entry.value
                          : JSON.stringify(entry.value, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export utility function to create log entries
export function createLogEntry(
  type: AgentLogEntry['type'],
  content: string,
  metadata?: AgentLogEntry['metadata']
): AgentLogEntry {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    type,
    content,
    metadata,
  };
}

export function createExecutionEvent(
  type: ExecutionEvent['type'],
  message: string,
  blockId?: string,
  blockName?: string,
  details?: string
): ExecutionEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    type,
    blockId,
    blockName,
    message,
    details,
  };
}
