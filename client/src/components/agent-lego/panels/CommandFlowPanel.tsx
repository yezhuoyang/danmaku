/**
 * Command Flow Panel
 *
 * Visualizes the command and report flow in political mode.
 * Shows:
 * - Active command chain
 * - Commands issued
 * - Reports received
 * - Violations (if any)
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  Command,
  Report,
  PeerMessage,
  PermissionViolation,
  PoliticalAgentBlock,
} from "@shared/types";
import { ROLE_DEFINITIONS } from "@/lib/agent-lego/politics";
import {
  ChevronDown,
  ArrowRight,
  ArrowUp,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

interface CommandFlowPanelProps {
  commands: Command[];
  reports: Report[];
  messages: PeerMessage[];
  violations: PermissionViolation[];
  blocksById: Map<string, PoliticalAgentBlock>;
  currentCommandId?: string;
}

// Format timestamp
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Get command status icon
function CommandStatusIcon({ status }: { status: Command['status'] }) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3 text-gray-500" />;
    case 'acknowledged':
      return <CheckCircle className="h-3 w-3 text-blue-500" />;
    case 'in_progress':
      return <Loader2 className="h-3 w-3 text-yellow-500 animate-spin" />;
    case 'completed':
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case 'failed':
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return null;
  }
}

// Get report status color
function getReportStatusColor(status: Report['status']): string {
  switch (status) {
    case 'success':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'needs_escalation':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Get priority badge color
function getPriorityColor(priority: Command['priority']): string {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'low':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Command Item Component
function CommandItem({
  command,
  blocksById,
  isActive,
}: {
  command: Command;
  blocksById: Map<string, PoliticalAgentBlock>;
  isActive: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(isActive);
  const fromBlock = blocksById.get(command.fromAgentId);
  const toBlock = blocksById.get(command.toAgentId);

  return (
    <div
      className={cn(
        "border rounded-lg p-2 text-xs",
        isActive && "border-primary bg-primary/5"
      )}
    >
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CommandStatusIcon status={command.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {command.fromAgentId === 'user' ? 'User' : fromBlock?.name || command.fromRole}
            </Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">
              {toBlock?.name || command.toRole}
            </Badge>
          </div>
        </div>
        <Badge className={cn("text-[10px]", getPriorityColor(command.priority))}>
          {command.priority}
        </Badge>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      {isExpanded && (
        <div className="mt-2 pl-5 space-y-1">
          <p className="text-muted-foreground">{command.instruction}</p>
          {command.context && (
            <p className="text-muted-foreground italic">Context: {command.context}</p>
          )}
          {command.constraints && command.constraints.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {command.constraints.map((c, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            Issued: {formatTime(command.issuedAt)}
            {command.completedAt && ` | Completed: ${formatTime(command.completedAt)}`}
          </p>
        </div>
      )}
    </div>
  );
}

// Report Item Component
function ReportItem({
  report,
  blocksById,
}: {
  report: Report;
  blocksById: Map<string, PoliticalAgentBlock>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const fromBlock = blocksById.get(report.fromAgentId);
  const toBlock = blocksById.get(report.toAgentId);

  return (
    <div className="border rounded-lg p-2 text-xs">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ArrowUp className="h-3 w-3 text-green-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[10px]">
              {fromBlock?.name || report.fromRole}
            </Badge>
            <ArrowUp className="h-3 w-3 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">
              {toBlock?.name || report.toRole}
            </Badge>
          </div>
        </div>
        <Badge className={cn("text-[10px]", getReportStatusColor(report.status))}>
          {report.status}
        </Badge>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      {isExpanded && (
        <div className="mt-2 pl-5 space-y-1">
          <p className="text-muted-foreground">{report.summary}</p>
          {report.tokensUsed && (
            <p className="text-[10px] text-muted-foreground">
              Tokens: {report.tokensUsed.toLocaleString()}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Submitted: {formatTime(report.submittedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// Violation Item Component
function ViolationItem({ violation }: { violation: PermissionViolation }) {
  return (
    <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-2 text-xs">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3 w-3 text-destructive" />
        <Badge
          variant={violation.severity === 'critical' ? 'destructive' : 'secondary'}
          className="text-[10px]"
        >
          {violation.severity}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {violation.type}
        </Badge>
      </div>
      <p className="mt-1 text-destructive">{violation.message}</p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {formatTime(violation.timestamp)}
      </p>
    </div>
  );
}

// Message Item Component
function MessageItem({
  message,
  blocksById,
}: {
  message: PeerMessage;
  blocksById: Map<string, PoliticalAgentBlock>;
}) {
  const fromBlock = blocksById.get(message.fromAgentId);
  const toBlock = blocksById.get(message.toAgentId);

  return (
    <div className="border rounded-lg p-2 text-xs">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3 w-3 text-blue-500" />
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px]">
            {fromBlock?.name || message.fromRole}
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="text-[10px]">
            {toBlock?.name || message.toRole}
          </Badge>
        </div>
        {message.acknowledged && (
          <CheckCircle className="h-3 w-3 text-green-500" />
        )}
      </div>
      <p className="mt-1 text-muted-foreground">{message.content}</p>
      <p className="text-[10px] text-muted-foreground mt-1">
        {formatTime(message.timestamp)}
      </p>
    </div>
  );
}

export function CommandFlowPanel({
  commands,
  reports,
  messages,
  violations,
  blocksById,
  currentCommandId,
}: CommandFlowPanelProps) {
  const [openSections, setOpenSections] = useState<string[]>([
    'commands',
    'reports',
    'violations',
  ]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  // Sort by timestamp
  const sortedCommands = [...commands].sort((a, b) => b.issuedAt - a.issuedAt);
  const sortedReports = [...reports].sort((a, b) => b.submittedAt - a.submittedAt);
  const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp);
  const sortedViolations = [...violations].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Command Flow
        </h2>
        <div className="flex gap-2 mt-1">
          <Badge variant="secondary" className="text-[10px]">
            {commands.length} commands
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {reports.length} reports
          </Badge>
          {violations.length > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {violations.length} violations
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Violations (always show if any) */}
          {violations.length > 0 && (
            <>
              <Collapsible
                open={openSections.includes('violations')}
                onOpenChange={() => toggleSection('violations')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
                  <span className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Violations ({violations.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSections.includes('violations') && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {sortedViolations.map((violation) => (
                    <ViolationItem key={violation.id} violation={violation} />
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Commands */}
          <Collapsible
            open={openSections.includes('commands')}
            onOpenChange={() => toggleSection('commands')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Commands ({commands.length})
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes('commands') && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {sortedCommands.length === 0 ? (
                <p className="text-xs text-muted-foreground">No commands issued yet.</p>
              ) : (
                sortedCommands.map((command) => (
                  <CommandItem
                    key={command.id}
                    command={command}
                    blocksById={blocksById}
                    isActive={command.id === currentCommandId}
                  />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Reports */}
          <Collapsible
            open={openSections.includes('reports')}
            onOpenChange={() => toggleSection('reports')}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4" />
                Reports ({reports.length})
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes('reports') && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {sortedReports.length === 0 ? (
                <p className="text-xs text-muted-foreground">No reports received yet.</p>
              ) : (
                sortedReports.map((report) => (
                  <ReportItem
                    key={report.id}
                    report={report}
                    blocksById={blocksById}
                  />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Peer Messages (if any) */}
          {messages.length > 0 && (
            <>
              <Separator />

              <Collapsible
                open={openSections.includes('messages')}
                onOpenChange={() => toggleSection('messages')}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Peer Messages ({messages.length})
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSections.includes('messages') && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {sortedMessages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      blocksById={blocksById}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
