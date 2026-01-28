import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { WorkflowEvent, WorkflowEventType } from "@shared/types";

// Alias for convenience
type EventType = WorkflowEventType;
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  FileStack,
  GitMerge,
  MessageSquare,
  AlertTriangle,
  Lightbulb,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  User,
  Bot,
} from "lucide-react";

// Event type icons - using Partial to allow additional types
const EVENT_ICONS: Partial<Record<EventType, React.ReactNode>> = {
  artifact_created: <FileStack className="h-3.5 w-3.5" />,
  artifact_updated: <FileStack className="h-3.5 w-3.5" />,
  artifact_deleted: <FileStack className="h-3.5 w-3.5" />,
  artifact_linked: <FileStack className="h-3.5 w-3.5" />,
  task_created: <Clock className="h-3.5 w-3.5" />,
  task_started: <Play className="h-3.5 w-3.5" />,
  task_completed: <CheckCircle className="h-3.5 w-3.5" />,
  task_failed: <XCircle className="h-3.5 w-3.5" />,
  merge_request_created: <GitMerge className="h-3.5 w-3.5" />,
  merge_request_approved: <GitMerge className="h-3.5 w-3.5" />,
  merge_request_rejected: <GitMerge className="h-3.5 w-3.5" />,
  blackboard_updated: <MessageSquare className="h-3.5 w-3.5" />,
  agent_invoked: <Play className="h-3.5 w-3.5" />,
  agent_completed: <CheckCircle className="h-3.5 w-3.5" />,
  agent_error: <AlertTriangle className="h-3.5 w-3.5" />,
  verification_started: <Clock className="h-3.5 w-3.5" />,
  verification_passed: <CheckCircle className="h-3.5 w-3.5" />,
  verification_failed: <XCircle className="h-3.5 w-3.5" />,
  context_assembled: <Lightbulb className="h-3.5 w-3.5" />,
  user_action: <User className="h-3.5 w-3.5" />,
};

// Default icon for unknown types
const DEFAULT_EVENT_ICON = <Clock className="h-3.5 w-3.5" />;

// Event type colors - using Partial to allow additional types
const EVENT_COLORS: Partial<Record<EventType, string>> = {
  artifact_created: "text-purple-500 bg-purple-50",
  artifact_updated: "text-purple-600 bg-purple-50",
  artifact_deleted: "text-red-500 bg-red-50",
  artifact_linked: "text-blue-500 bg-blue-50",
  task_created: "text-orange-500 bg-orange-50",
  task_started: "text-blue-500 bg-blue-50",
  task_completed: "text-green-500 bg-green-50",
  task_failed: "text-red-500 bg-red-50",
  merge_request_created: "text-indigo-500 bg-indigo-50",
  merge_request_approved: "text-green-500 bg-green-50",
  merge_request_rejected: "text-red-500 bg-red-50",
  blackboard_updated: "text-cyan-500 bg-cyan-50",
  agent_invoked: "text-blue-500 bg-blue-50",
  agent_completed: "text-green-600 bg-green-50",
  agent_error: "text-red-600 bg-red-50",
  verification_started: "text-amber-500 bg-amber-50",
  verification_passed: "text-green-500 bg-green-50",
  verification_failed: "text-red-500 bg-red-50",
  context_assembled: "text-cyan-500 bg-cyan-50",
  user_action: "text-gray-500 bg-gray-50",
};

// Default color for unknown types
const DEFAULT_EVENT_COLOR = "text-gray-500 bg-gray-50";

// Event category groupings
const EVENT_CATEGORIES = {
  artifact: ["artifact_created", "artifact_updated", "artifact_deleted", "artifact_linked"],
  task: ["task_created", "task_started", "task_completed", "task_failed"],
  merge: ["merge_request_created", "merge_request_approved", "merge_request_rejected"],
  agent: ["agent_invoked", "agent_completed", "agent_error"],
  verification: ["verification_started", "verification_passed", "verification_failed"],
  other: ["blackboard_updated", "context_assembled", "user_action"],
} as const;

interface TimelinePanelProps {
  events: WorkflowEvent[];
  onRefresh: () => void;
  onEventClick?: (event: WorkflowEvent) => void;
}

export function TimelinePanel({
  events,
  onRefresh,
  onEventClick,
}: TimelinePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<EventType | "all">("all");
  const [filterAgent, setFilterAgent] = useState<string | "all">("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Get unique agent IDs from events
  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of events) {
      if (event.agentId) {
        ids.add(event.agentId);
      }
    }
    return Array.from(ids);
  }, [events]);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter((e) => e.eventType === filterType);
    }

    // Apply agent filter
    if (filterAgent !== "all") {
      filtered = filtered.filter((e) => e.agentId === filterAgent);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const matchesType = e.eventType.toLowerCase().includes(query);
        const matchesAgent = e.agentId?.toLowerCase().includes(query);
        const matchesData = JSON.stringify(e.data).toLowerCase().includes(query);
        return matchesType || matchesAgent || matchesData;
      });
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    return filtered;
  }, [events, filterType, filterAgent, searchQuery]);

  // Group events by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, WorkflowEvent[]> = {};

    for (const event of filteredEvents) {
      const date = new Date(event.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(event);
    }

    return groups;
  }, [filteredEvents]);

  const toggleEvent = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatEventType = (type: EventType) => {
    return type.replace(/_/g, " ");
  };

  const renderEventData = (event: WorkflowEvent) => {
    const data = event.data;
    if (!data || Object.keys(data).length === 0) {
      return <p className="text-xs text-muted-foreground italic">No additional data</p>;
    }

    return (
      <div className="space-y-1 text-xs">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-muted-foreground font-medium min-w-[80px]">
              {key}:
            </span>
            <span className="text-foreground break-all">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const allEventTypes: EventType[] = [
    "artifact_created",
    "artifact_updated",
    "artifact_deleted",
    "artifact_linked",
    "task_created",
    "task_started",
    "task_completed",
    "task_failed",
    "merge_request_created",
    "merge_request_approved",
    "merge_request_rejected",
    "blackboard_updated",
    "agent_invoked",
    "agent_completed",
    "agent_error",
    "verification_started",
    "verification_passed",
    "verification_failed",
    "context_assembled",
    "user_action",
  ];

  return (
    <div className="flex flex-col h-full border-l bg-muted/30">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Event Timeline
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 mt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs flex-1">
                <Filter className="h-3 w-3 mr-1" />
                {filterType === "all" ? "Type" : formatEventType(filterType)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setFilterType("all")}>
                All Types
              </DropdownMenuItem>
              <Separator className="my-1" />
              {allEventTypes.map((type) => (
                <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                  <span className={cn("mr-2 p-1 rounded", EVENT_COLORS[type])}>
                    {EVENT_ICONS[type]}
                  </span>
                  {formatEventType(type)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs flex-1">
                <Bot className="h-3 w-3 mr-1" />
                {filterAgent === "all" ? "Agent" : filterAgent}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterAgent("all")}>
                All Agents
              </DropdownMenuItem>
              <Separator className="my-1" />
              {agentIds.map((agentId) => (
                <DropdownMenuItem key={agentId} onClick={() => setFilterAgent(agentId)}>
                  <Bot className="h-3 w-3 mr-2" />
                  {agentId}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.keys(groupedByDate).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No events found
            </p>
          ) : (
            Object.entries(groupedByDate).map(([date, dateEvents]) => (
              <div key={date} className="mb-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-muted/30 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] text-muted-foreground font-medium px-2">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Events */}
                <div className="space-y-1 relative">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  {dateEvents.map((event) => {
                    const isExpanded = expandedEvents.has(event.id);

                    return (
                      <Collapsible
                        key={event.id}
                        open={isExpanded}
                        onOpenChange={() => toggleEvent(event.id)}
                      >
                        <div
                          className={cn(
                            "relative pl-7 pr-2 py-1.5 rounded cursor-pointer",
                            "hover:bg-muted transition-colors",
                            isExpanded && "bg-muted"
                          )}
                          onClick={() => onEventClick?.(event)}
                        >
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              "absolute left-1 top-2 w-5 h-5 rounded-full flex items-center justify-center z-10",
                              EVENT_COLORS[event.eventType] || DEFAULT_EVENT_COLOR
                            )}
                          >
                            {EVENT_ICONS[event.eventType] || DEFAULT_EVENT_ICON}
                          </div>

                          <CollapsibleTrigger className="w-full text-left" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {isExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  <span className="text-xs font-medium capitalize">
                                    {formatEventType(event.eventType)}
                                  </span>
                                </div>
                                {event.agentId && (
                                  <div className="flex items-center gap-1 mt-0.5 ml-4">
                                    <Bot className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground">
                                      {event.agentId}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {formatRelativeTime(event.timestamp)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">
                                    <p className="text-xs">{formatTime(event.timestamp)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent className="ml-4 mt-2">
                            <div className="p-2 bg-background rounded border text-xs">
                              {/* Event metadata */}
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b">
                                <Badge variant="outline" className="text-[10px]">
                                  ID: {event.id.slice(0, 8)}
                                </Badge>
                                {event.blockId && (
                                  <Badge variant="outline" className="text-[10px]">
                                    Block: {event.blockId}
                                  </Badge>
                                )}
                              </div>

                              {/* Event data */}
                              {renderEventData(event)}

                              {/* Artifact references */}
                              {(event.inputs.length > 0 || event.outputs.length > 0) && (
                                <div className="mt-2 pt-2 border-t">
                                  {event.inputs.length > 0 && (
                                    <>
                                      <p className="text-[10px] text-muted-foreground mb-1">
                                        Input Artifacts:
                                      </p>
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {event.inputs.map((id: string) => (
                                          <Badge
                                            key={id}
                                            variant="outline"
                                            className="text-[10px]"
                                          >
                                            <FileStack className="h-2.5 w-2.5 mr-1" />
                                            {id.slice(0, 8)}
                                          </Badge>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                  {event.outputs.length > 0 && (
                                    <>
                                      <p className="text-[10px] text-muted-foreground mb-1">
                                        Output Artifacts:
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {event.outputs.map((id: string) => (
                                          <Badge
                                            key={id}
                                            variant="secondary"
                                            className="text-[10px]"
                                          >
                                            <FileStack className="h-2.5 w-2.5 mr-1" />
                                            {id.slice(0, 8)}
                                          </Badge>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="p-2 border-t text-[10px] text-muted-foreground">
        {events.length} event{events.length !== 1 ? "s" : ""} total
        {filterType !== "all" || filterAgent !== "all" || searchQuery ? (
          <span> ({filteredEvents.length} shown)</span>
        ) : null}
      </div>
    </div>
  );
}
