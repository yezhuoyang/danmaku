import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "wouter";
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  FileText,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Search,
  Link2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import type { ChallengeProblem, ChallengeProblemLink, CrossPaperRelationship } from "../../../shared/types";

interface ResearchGitTreeProps {
  problems: ChallengeProblem[];
  crossPaperLinks?: ChallengeProblemLink[];
  currentProblemId?: string;
  onSelectProblem?: (id: string) => void;
  showCrossPaperLinks?: boolean;
  title?: string;
}

const STATUS_COLORS: Record<string, string> = {
  unsolved: 'bg-red-500',
  investigating: 'bg-yellow-500',
  solved: 'bg-green-500',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  open_question: <HelpCircle className="h-3 w-3" />,
  research_idea: <Lightbulb className="h-3 w-3" />,
};

const RELATIONSHIP_COLORS: Record<CrossPaperRelationship, string> = {
  extends: '#3b82f6', // blue
  contradicts: '#ef4444', // red
  builds_on: '#22c55e', // green
  supersedes: '#a855f7', // purple
  related: '#6b7280', // gray
};

const RELATIONSHIP_LABELS: Record<CrossPaperRelationship, string> = {
  extends: 'Extends',
  contradicts: 'Contradicts',
  builds_on: 'Builds on',
  supersedes: 'Supersedes',
  related: 'Related',
};

interface TreeNode {
  problem: ChallengeProblem;
  children: TreeNode[];
  depth: number;
  x: number;
  y: number;
}

export function ResearchGitTree({
  problems,
  crossPaperLinks = [],
  currentProblemId,
  onSelectProblem,
  showCrossPaperLinks = true,
  title = "Research Problem Tree",
}: ResearchGitTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // Build tree structure
  const { tree, nodeMap } = useMemo(() => {
    const map = new Map<string, ChallengeProblem>();
    const childMap = new Map<string, ChallengeProblem[]>();

    problems.forEach(p => {
      map.set(p.id, p);
      const parentId = p.parentId || 'root';
      if (!childMap.has(parentId)) {
        childMap.set(parentId, []);
      }
      childMap.get(parentId)!.push(p);
    });

    function buildTree(parentId: string | null, depth: number): TreeNode[] {
      const children = childMap.get(parentId || 'root') || [];
      return children.map((problem, idx) => ({
        problem,
        children: buildTree(problem.id, depth + 1),
        depth,
        x: 0, // Will be calculated for SVG view
        y: depth * 80,
      }));
    }

    return {
      tree: buildTree(null, 0),
      nodeMap: map,
    };
  }, [problems]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = problems.map(p => p.id);
    setExpandedNodes(new Set(allIds));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Render a tree node
  const renderTreeNode = (node: TreeNode, isLast: boolean, prefix: string = '') => {
    const { problem, children } = node;
    const isExpanded = expandedNodes.has(problem.id);
    const hasChildren = children.length > 0;
    const isCurrent = problem.id === currentProblemId;

    const linksFrom = crossPaperLinks.filter(l => l.sourceId === problem.id);
    const linksTo = crossPaperLinks.filter(l => l.targetId === problem.id);

    return (
      <div key={problem.id} className="font-mono text-sm">
        <div
          className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer ${
            isCurrent ? 'bg-primary/10 border-l-2 border-primary' : ''
          }`}
          onClick={() => onSelectProblem?.(problem.id)}
        >
          {/* Tree structure prefix */}
          <span className="text-muted-foreground whitespace-pre">{prefix}</span>

          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(problem.id);
              }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Status indicator */}
          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[problem.status]}`} />

          {/* Type icon */}
          <span className="text-muted-foreground">
            {TYPE_ICONS[problem.type]}
          </span>

          {/* Title */}
          <span className={`flex-1 truncate ${isCurrent ? 'font-semibold' : ''}`}>
            {problem.title}
          </span>

          {/* Cross-paper links indicator */}
          {showCrossPaperLinks && (linksFrom.length > 0 || linksTo.length > 0) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    <span className="text-xs">{linksFrom.length + linksTo.length}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    {linksFrom.map(l => (
                      <div key={l.id} className="flex items-center gap-1">
                        <span style={{ color: RELATIONSHIP_COLORS[l.relationship] }}>
                          {RELATIONSHIP_LABELS[l.relationship]}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span>{nodeMap.get(l.targetId)?.title || l.targetId}</span>
                      </div>
                    ))}
                    {linksTo.map(l => (
                      <div key={l.id} className="flex items-center gap-1">
                        <span>{nodeMap.get(l.sourceId)?.title || l.sourceId}</span>
                        <span className="text-muted-foreground">→</span>
                        <span style={{ color: RELATIONSHIP_COLORS[l.relationship] }}>
                          {RELATIONSHIP_LABELS[l.relationship]}
                        </span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Paper link */}
          {problem.paperTitle && (
            <Link href={`/paper/${problem.paperId}`} onClick={(e) => e.stopPropagation()}>
              <Badge variant="outline" className="text-xs h-5 gap-1">
                <FileText className="h-2.5 w-2.5" />
                <span className="max-w-[100px] truncate">{problem.paperTitle}</span>
              </Badge>
            </Link>
          )}

          {/* External link */}
          <Link href={`/challenge/${problem.id}`} onClick={(e) => e.stopPropagation()}>
            <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
          </Link>
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && (
          <div className="ml-4">
            {children.map((child, idx) =>
              renderTreeNode(
                child,
                idx === children.length - 1,
                prefix + (isLast ? '   ' : '│  ')
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    return (
      <div className="space-y-2">
        {problems.map(problem => {
          const linksFrom = crossPaperLinks.filter(l => l.sourceId === problem.id);
          const linksTo = crossPaperLinks.filter(l => l.targetId === problem.id);
          const isCurrent = problem.id === currentProblemId;

          return (
            <div
              key={problem.id}
              className={`p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors ${
                isCurrent ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelectProblem?.(problem.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[problem.status]}`} />
                {TYPE_ICONS[problem.type]}
                <span className="font-medium flex-1 truncate">{problem.title}</span>
                <Link href={`/challenge/${problem.id}`} onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Link>
              </div>

              {problem.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {problem.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {problem.paperTitle && (
                  <Link href={`/paper/${problem.paperId}`} onClick={(e) => e.stopPropagation()}>
                    <Badge variant="outline" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      {problem.paperTitle}
                    </Badge>
                  </Link>
                )}

                {showCrossPaperLinks && linksFrom.map(l => (
                  <Badge
                    key={l.id}
                    variant="secondary"
                    className="text-xs"
                    style={{ borderColor: RELATIONSHIP_COLORS[l.relationship] }}
                  >
                    {RELATIONSHIP_LABELS[l.relationship]} → {nodeMap.get(l.targetId)?.title || 'Unknown'}
                  </Badge>
                ))}

                {showCrossPaperLinks && linksTo.map(l => (
                  <Badge
                    key={l.id}
                    variant="secondary"
                    className="text-xs"
                    style={{ borderColor: RELATIONSHIP_COLORS[l.relationship] }}
                  >
                    ← {RELATIONSHIP_LABELS[l.relationship]} from {nodeMap.get(l.sourceId)?.title || 'Unknown'}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (problems.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No research problems found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            {title}
            <Badge variant="secondary" className="ml-2">{problems.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
            >
              {viewMode === 'tree' ? 'List' : 'Tree'}
            </Button>
            {viewMode === 'tree' && (
              <>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={expandAll}>
                  <Maximize2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={collapseAll}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Unsolved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Investigating</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Solved</span>
          </div>
          {showCrossPaperLinks && (
            <>
              <span className="text-muted-foreground">|</span>
              {Object.entries(RELATIONSHIP_LABELS).slice(0, 3).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                  <div
                    className="w-3 h-0.5"
                    style={{ backgroundColor: RELATIONSHIP_COLORS[key as CrossPaperRelationship] }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Tree or List view */}
        <div className="max-h-[500px] overflow-auto">
          {viewMode === 'tree' ? (
            <div className="min-w-max">
              {tree.map((node, idx) =>
                renderTreeNode(node, idx === tree.length - 1)
              )}
            </div>
          ) : (
            renderListView()
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ResearchGitTree;
