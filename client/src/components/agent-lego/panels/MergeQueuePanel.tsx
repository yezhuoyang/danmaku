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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MergeRequest, MergeRequestStatus, MergeRequestCheck } from "@shared/types";
import {
  GitMerge,
  GitPullRequest,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Bot,
  User,
  FileStack,
} from "lucide-react";

// Change type from MergeRequest.changes array
type ChangeType = MergeRequest['changes'][0]['type'];

// Status icons
const STATUS_ICONS: Record<MergeRequestStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <Check className="h-3.5 w-3.5" />,
  rejected: <X className="h-3.5 w-3.5" />,
  auto_merged: <GitMerge className="h-3.5 w-3.5" />,
};

// Status colors
const STATUS_COLORS: Record<MergeRequestStatus, string> = {
  pending: "text-amber-500 bg-amber-50 border-amber-200",
  approved: "text-green-500 bg-green-50 border-green-200",
  rejected: "text-red-500 bg-red-50 border-red-200",
  auto_merged: "text-blue-500 bg-blue-50 border-blue-200",
};

// Operation type colors
const OPERATION_COLORS: Partial<Record<ChangeType, string>> = {
  add_claim: "text-green-600",
  update_claim: "text-blue-600",
  remove_claim: "text-red-600",
  add_question: "text-amber-600",
  update_question: "text-amber-500",
  remove_question: "text-red-500",
  add_hypothesis: "text-purple-600",
  update_hypothesis: "text-purple-500",
  remove_hypothesis: "text-red-600",
  update_problem: "text-blue-600",
  add_assumption: "text-green-600",
  add_constraint: "text-orange-600",
  add_to_queue: "text-indigo-600",
  update_outline: "text-cyan-600",
  custom: "text-gray-600",
};

// Operation type icons
const OPERATION_ICONS: Partial<Record<ChangeType, React.ReactNode>> = {
  add_claim: <Plus className="h-3 w-3" />,
  update_claim: <Edit className="h-3 w-3" />,
  remove_claim: <Trash2 className="h-3 w-3" />,
  add_question: <Plus className="h-3 w-3" />,
  update_question: <Edit className="h-3 w-3" />,
  remove_question: <Trash2 className="h-3 w-3" />,
  add_hypothesis: <Plus className="h-3 w-3" />,
  update_hypothesis: <Edit className="h-3 w-3" />,
  remove_hypothesis: <Trash2 className="h-3 w-3" />,
  update_problem: <Edit className="h-3 w-3" />,
  add_assumption: <Plus className="h-3 w-3" />,
  add_constraint: <Plus className="h-3 w-3" />,
  add_to_queue: <Plus className="h-3 w-3" />,
  update_outline: <Edit className="h-3 w-3" />,
  custom: <Edit className="h-3 w-3" />,
};

// Default for unknown types
const DEFAULT_OPERATION_ICON = <Edit className="h-3 w-3" />;
const DEFAULT_OPERATION_COLOR = "text-gray-600";

interface MergeQueuePanelProps {
  mergeRequests: MergeRequest[];
  onApprove: (requestId: string, comment?: string) => void;
  onReject: (requestId: string, reason: string) => void;
  onRefresh: () => void;
  onViewDetails?: (request: MergeRequest) => void;
}

export function MergeQueuePanel({
  mergeRequests,
  onApprove,
  onReject,
  onRefresh,
  onViewDetails,
}: MergeQueuePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<MergeRequestStatus | "all">("all");
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    requestId: string | null;
  }>({ open: false, requestId: null });
  const [rejectReason, setRejectReason] = useState("");

  // Filter merge requests
  const filteredRequests = useMemo(() => {
    let filtered = [...mergeRequests];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const matchesDescription = (r.description || r.title || "").toLowerCase().includes(query);
        const matchesAgent = r.proposedBy.toLowerCase().includes(query);
        return matchesDescription || matchesAgent;
      });
    }

    // Sort by created time (newest first)
    filtered.sort((a, b) => b.proposedAt - a.proposedAt);

    return filtered;
  }, [mergeRequests, filterStatus, searchQuery]);

  // Group by status
  const groupedByStatus = useMemo(() => {
    const groups: Record<MergeRequestStatus, MergeRequest[]> = {
      pending: [],
      approved: [],
      rejected: [],
      auto_merged: [],
    };

    for (const request of filteredRequests) {
      groups[request.status].push(request);
    }

    return groups;
  }, [filteredRequests]);

  // Count pending requests
  const pendingCount = groupedByStatus.pending.length;

  const toggleRequest = (requestId: string) => {
    setExpandedRequests((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatOperationType = (type: ChangeType) => {
    return type.replace(/_/g, " ");
  };

  const handleApprove = (requestId: string) => {
    onApprove(requestId);
  };

  const handleRejectClick = (requestId: string) => {
    setRejectDialog({ open: true, requestId });
    setRejectReason("");
  };

  const handleRejectConfirm = () => {
    if (rejectDialog.requestId && rejectReason.trim()) {
      onReject(rejectDialog.requestId, rejectReason);
      setRejectDialog({ open: false, requestId: null });
      setRejectReason("");
    }
  };

  const renderChanges = (changes: MergeRequest['changes']) => {
    return (
      <div className="space-y-1">
        {changes.map((change, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded"
          >
            <span className={cn("p-0.5 rounded", OPERATION_COLORS[change.type] || DEFAULT_OPERATION_COLOR)}>
              {OPERATION_ICONS[change.type] || DEFAULT_OPERATION_ICON}
            </span>
            <span className="font-medium capitalize">
              {formatOperationType(change.type)}
            </span>
            {change.target && (
              <Badge variant="outline" className="text-[10px] ml-auto">
                {change.target.slice(0, 8)}
              </Badge>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderChecks = (request: MergeRequest) => {
    if (!request.checks || request.checks.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 space-y-1">
        <p className="text-[10px] text-muted-foreground font-medium">
          Validation Checks:
        </p>
        {request.checks.map((check: MergeRequestCheck, index: number) => (
          <div
            key={index}
            className={cn(
              "flex items-start gap-2 text-xs p-1.5 rounded",
              check.status === 'passed'
                ? "bg-green-50 text-green-700"
                : check.status === 'failed'
                ? "bg-red-50 text-red-700"
                : "bg-gray-50 text-gray-700"
            )}
          >
            {check.status === 'passed' ? (
              <Check className="h-3 w-3 mt-0.5" />
            ) : check.status === 'failed' ? (
              <X className="h-3 w-3 mt-0.5" />
            ) : (
              <Clock className="h-3 w-3 mt-0.5" />
            )}
            <div>
              <span className="font-medium">{check.name}</span>
              {check.message && (
                <p className="text-[10px] opacity-80">{check.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full border-l bg-muted/30">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <GitPullRequest className="h-4 w-4" />
            Merge Queue
            {pendingCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* Status filter buttons */}
        <div className="flex gap-1 mt-2 flex-wrap">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setFilterStatus("all")}
          >
            All
          </Button>
          {(["pending", "approved", "rejected", "auto_merged"] as MergeRequestStatus[]).map(
            (status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-6 text-[10px] px-2",
                  filterStatus !== status && STATUS_COLORS[status]
                )}
                onClick={() => setFilterStatus(status)}
              >
                {STATUS_ICONS[status]}
                <span className="ml-1 capitalize">{status}</span>
                {groupedByStatus[status].length > 0 && (
                  <span className="ml-1">({groupedByStatus[status].length})</span>
                )}
              </Button>
            )
          )}
        </div>
      </div>

      {/* Merge Request List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No merge requests found
            </p>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((request) => {
                const isExpanded = expandedRequests.has(request.id);
                const isPending = request.status === "pending";

                return (
                  <Collapsible
                    key={request.id}
                    open={isExpanded}
                    onOpenChange={() => toggleRequest(request.id)}
                    className={cn(
                      "border rounded-lg overflow-hidden",
                      STATUS_COLORS[request.status]
                    )}
                  >
                    <CollapsibleTrigger className="w-full p-2 text-left hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            "p-1 rounded mt-0.5",
                            STATUS_COLORS[request.status]
                          )}
                        >
                          {STATUS_ICONS[request.status]}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                            <p className="text-xs font-medium truncate">
                              {request.title || request.description || "Untitled merge request"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 mt-1 ml-4">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1">
                                  <Bot className="h-2.5 w-2.5 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {request.proposedBy}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="text-xs">Proposed by agent</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <span className="text-[10px] text-muted-foreground">
                              •
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(request.proposedAt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              •
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {request.changes.length} change
                              {request.changes.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3">
                        <Separator />

                        {/* Changes */}
                        <div>
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">
                            Changes:
                          </p>
                          {renderChanges(request.changes)}
                        </div>

                        {/* Validation Checks */}
                        {renderChecks(request)}

                        {/* Review Comment (for rejections) */}
                        {request.status === "rejected" && request.reviewComment && (
                          <div className="p-2 bg-red-50 rounded border border-red-200">
                            <p className="text-[10px] text-red-600 font-medium mb-1">
                              Review Comment:
                            </p>
                            <p className="text-xs text-red-700">
                              {request.reviewComment}
                            </p>
                          </div>
                        )}

                        {/* Reviewed By */}
                        {request.reviewedBy && (
                          <div className="flex items-center gap-2 text-xs text-green-600">
                            <User className="h-3 w-3" />
                            Reviewed by: {request.reviewedBy}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {isPending && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(request.id);
                              }}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectClick(request.id);
                              }}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {/* View Details Button */}
                        {onViewDetails && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(request);
                            }}
                          >
                            View Full Details
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="p-2 border-t text-[10px] text-muted-foreground">
        {mergeRequests.length} request{mergeRequests.length !== 1 ? "s" : ""} total
        {filterStatus !== "all" || searchQuery ? (
          <span> ({filteredRequests.length} shown)</span>
        ) : null}
      </div>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) =>
          setRejectDialog({ open, requestId: open ? rejectDialog.requestId : null })
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Merge Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this merge request. This will
              be visible to the requesting agent.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, requestId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
