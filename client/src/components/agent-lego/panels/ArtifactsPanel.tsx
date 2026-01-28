import { useState, useEffect, useMemo } from "react";
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
import type { Artifact, ArtifactType, ArtifactStatus } from "@shared/types";
import {
  FileText,
  FileSearch,
  Lightbulb,
  FlaskConical,
  Play,
  FilePen,
  Scale,
  Code,
  Database,
  Quote,
  AlertTriangle,
  FileStack,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Eye,
  Link,
  RefreshCw,
} from "lucide-react";

// Artifact type icons
const TYPE_ICONS: Record<ArtifactType, React.ReactNode> = {
  source: <FileSearch className="h-4 w-4" />,
  note: <FileText className="h-4 w-4" />,
  hypothesis: <Lightbulb className="h-4 w-4" />,
  experiment_spec: <FlaskConical className="h-4 w-4" />,
  run: <Play className="h-4 w-4" />,
  draft: <FilePen className="h-4 w-4" />,
  decision: <Scale className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  data: <Database className="h-4 w-4" />,
  citation: <Quote className="h-4 w-4" />,
  constraint: <AlertTriangle className="h-4 w-4" />,
  summary: <FileStack className="h-4 w-4" />,
};

// Artifact type colors
const TYPE_COLORS: Record<ArtifactType, string> = {
  source: "text-blue-500",
  note: "text-green-500",
  hypothesis: "text-amber-500",
  experiment_spec: "text-purple-500",
  run: "text-indigo-500",
  draft: "text-pink-500",
  decision: "text-red-500",
  code: "text-cyan-500",
  data: "text-orange-500",
  citation: "text-gray-500",
  constraint: "text-rose-500",
  summary: "text-teal-500",
};

// Status badge colors
const STATUS_COLORS: Record<ArtifactStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  proposed: "bg-amber-100 text-amber-700",
  verified: "bg-green-100 text-green-700",
  merged: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-slate-100 text-slate-700",
};

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  selectedArtifactId?: string;
  onSelectArtifact: (artifact: Artifact) => void;
  onDeleteArtifact: (artifactId: string) => void;
  onViewArtifact: (artifact: Artifact) => void;
  onRefresh: () => void;
}

export function ArtifactsPanel({
  artifacts,
  selectedArtifactId,
  onSelectArtifact,
  onDeleteArtifact,
  onViewArtifact,
  onRefresh,
}: ArtifactsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ArtifactType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ArtifactStatus | "all">("all");
  const [expandedTypes, setExpandedTypes] = useState<Set<ArtifactType>>(new Set());

  // Group artifacts by type
  const groupedArtifacts = useMemo(() => {
    const groups: Partial<Record<ArtifactType, Artifact[]>> = {};

    for (const artifact of artifacts) {
      // Apply filters
      if (filterType !== "all" && artifact.type !== filterType) continue;
      if (filterStatus !== "all" && artifact.status !== filterStatus) continue;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = artifact.title.toLowerCase().includes(query);
        const matchesTags = artifact.metadata.tags.some(t => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesTags) continue;
      }

      if (!groups[artifact.type]) {
        groups[artifact.type] = [];
      }
      groups[artifact.type]!.push(artifact);
    }

    // Sort within each group by updated time
    for (const type of Object.keys(groups) as ArtifactType[]) {
      groups[type]!.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
    }

    return groups;
  }, [artifacts, filterType, filterStatus, searchQuery]);

  // Count artifacts by type
  const typeCounts = useMemo(() => {
    const counts: Partial<Record<ArtifactType, number>> = {};
    for (const artifact of artifacts) {
      counts[artifact.type] = (counts[artifact.type] || 0) + 1;
    }
    return counts;
  }, [artifacts]);

  const toggleType = (type: ArtifactType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const orderedTypes: ArtifactType[] = [
    "source",
    "note",
    "hypothesis",
    "experiment_spec",
    "run",
    "draft",
    "decision",
    "code",
    "data",
    "citation",
    "constraint",
    "summary",
  ];

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileStack className="h-4 w-4" />
            Artifacts
          </h2>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRefresh}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search artifacts..."
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
                {filterType === "all" ? "Type" : filterType}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterType("all")}>
                All Types
              </DropdownMenuItem>
              <Separator className="my-1" />
              {orderedTypes.map((type) => (
                <DropdownMenuItem key={type} onClick={() => setFilterType(type)}>
                  <span className={cn("mr-2", TYPE_COLORS[type])}>
                    {TYPE_ICONS[type]}
                  </span>
                  {type.replace(/_/g, " ")}
                  {typeCounts[type] && (
                    <span className="ml-auto text-muted-foreground">
                      {typeCounts[type]}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs flex-1">
                {filterStatus === "all" ? "Status" : filterStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                All Statuses
              </DropdownMenuItem>
              <Separator className="my-1" />
              {(["draft", "proposed", "verified", "merged", "rejected", "archived"] as ArtifactStatus[]).map(
                (status) => (
                  <DropdownMenuItem key={status} onClick={() => setFilterStatus(status)}>
                    <Badge className={cn("mr-2 text-[10px]", STATUS_COLORS[status])}>
                      {status}
                    </Badge>
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Artifact Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.keys(groupedArtifacts).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No artifacts found
            </p>
          ) : (
            orderedTypes.map((type) => {
              const typeArtifacts = groupedArtifacts[type];
              if (!typeArtifacts || typeArtifacts.length === 0) return null;

              const isExpanded = expandedTypes.has(type);

              return (
                <Collapsible
                  key={type}
                  open={isExpanded}
                  onOpenChange={() => toggleType(type)}
                  className="mb-1"
                >
                  <CollapsibleTrigger className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-muted rounded text-sm">
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <span className={TYPE_COLORS[type]}>{TYPE_ICONS[type]}</span>
                    <span className="capitalize flex-1 text-left text-xs">
                      {type.replace(/_/g, " ")}
                    </span>
                    <Badge variant="secondary" className="h-4 text-[10px] px-1">
                      {typeArtifacts.length}
                    </Badge>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="pl-4">
                    {typeArtifacts.map((artifact) => (
                      <div
                        key={artifact.id}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer group",
                          "hover:bg-muted transition-colors",
                          selectedArtifactId === artifact.id && "bg-muted"
                        )}
                        onClick={() => onSelectArtifact(artifact)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{artifact.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(artifact.metadata.updatedAt)}
                          </p>
                        </div>

                        <Badge
                          className={cn(
                            "text-[9px] px-1 h-4 opacity-70",
                            STATUS_COLORS[artifact.status]
                          )}
                        >
                          {artifact.status}
                        </Badge>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewArtifact(artifact)}>
                              <Eye className="h-3.5 w-3.5 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {artifact.links.length > 0 && (
                              <DropdownMenuItem>
                                <Link className="h-3.5 w-3.5 mr-2" />
                                View Links ({artifact.links.length})
                              </DropdownMenuItem>
                            )}
                            <Separator className="my-1" />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => onDeleteArtifact(artifact.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      <div className="p-2 border-t text-[10px] text-muted-foreground">
        {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} total
        {filterType !== "all" || filterStatus !== "all" || searchQuery ? (
          <span>
            {" "}
            ({Object.values(groupedArtifacts).flat().length} shown)
          </span>
        ) : null}
      </div>
    </div>
  );
}
