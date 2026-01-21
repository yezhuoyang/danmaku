import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import type { ChallengeProblem } from "../../../shared/types";
import {
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Search,
  GitBranch,
  FileText,
  Plus,
  BookOpen,
  Trophy,
  ExternalLink,
  ChevronRight,
  Move,
  RotateCcw,
} from "lucide-react";

// Layout constants
const LAYOUT = {
  NODE_RADIUS: 12,
  NODE_WIDTH: 180,
  NODE_HEIGHT: 50,
  COLUMN_SPACING: 280,
  LANE_SPACING: 80,
  PADDING: 40,
  LABEL_OFFSET: 18,
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  unsolved: "#ef4444",      // red-500
  investigating: "#eab308", // yellow-500
  solved: "#22c55e",        // green-500
};

const STATUS_BG: Record<string, string> = {
  unsolved: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  investigating: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
  solved: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
};

// Types for visualization
interface BranchNode {
  id: string;
  problem: ChallengeProblem;
  x: number;
  y: number;
  lane: number;
  column: number;
}

// Position offset for dragged nodes
interface NodeOffset {
  dx: number;
  dy: number;
}

interface BranchEdge {
  id: string;
  sourceId: string;
  targetId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  // The child problem this edge leads to (contains linked ideas/papers trying to solve it)
  targetProblem: ChallengeProblem;
  path: string;
}

interface LayoutResult {
  nodes: BranchNode[];
  edges: BranchEdge[];
  bounds: { width: number; height: number };
}

// Generate bezier path for edges
function generateBezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  if (y1 === y2) {
    // Straight horizontal line
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // Curved path for branching - smoother S-curve
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

// Layout algorithm
function layoutGitGraph(tree: ChallengeProblem[]): LayoutResult {
  if (!tree || tree.length === 0) {
    return { nodes: [], edges: [], bounds: { width: 0, height: 0 } };
  }

  const nodes: BranchNode[] = [];
  const edges: BranchEdge[] = [];
  const nodeMap = new Map<string, BranchNode>();

  // Track lanes used at each column to avoid collisions
  const columnLanes = new Map<number, Set<number>>();

  // Get next available lane for a column, alternating +/-
  function getNextLane(column: number, preferredLane?: number): number {
    if (!columnLanes.has(column)) {
      columnLanes.set(column, new Set());
    }
    const usedLanes = columnLanes.get(column)!;

    // If preferred lane is available, use it
    if (preferredLane !== undefined && !usedLanes.has(preferredLane)) {
      usedLanes.add(preferredLane);
      return preferredLane;
    }

    // Find next available lane, alternating from 0
    const lanes = [0, 1, -1, 2, -2, 3, -3, 4, -4];
    for (const lane of lanes) {
      if (!usedLanes.has(lane)) {
        usedLanes.add(lane);
        return lane;
      }
    }
    return usedLanes.size; // Fallback
  }

  // Process tree recursively
  function processNode(
    problem: ChallengeProblem,
    column: number,
    parentLane?: number,
    parentId?: string
  ): void {
    // Determine lane
    let lane: number;
    if (column === 0) {
      lane = 0; // Root always at lane 0
    } else if (parentLane !== undefined) {
      // Children branch off from parent
      const siblingIndex = parentId
        ? nodes.filter(n => n.problem.parentId === parentId).length
        : 0;

      // Alternate lanes: first child goes +1, second -1, etc.
      const laneOffsets = [1, -1, 2, -2, 3, -3];
      const preferredLane = parentLane + (laneOffsets[siblingIndex % laneOffsets.length] || siblingIndex);
      lane = getNextLane(column, preferredLane);
    } else {
      lane = getNextLane(column);
    }

    // Calculate position
    const x = LAYOUT.PADDING + column * LAYOUT.COLUMN_SPACING;
    const y = LAYOUT.PADDING + 120 + lane * LAYOUT.LANE_SPACING;

    const node: BranchNode = {
      id: problem.id,
      problem,
      x,
      y,
      lane,
      column,
    };
    nodes.push(node);
    nodeMap.set(problem.id, node);

    // Create edge from parent
    if (parentId) {
      const parentNode = nodeMap.get(parentId);
      if (parentNode) {
        const edgePath = generateBezierPath(
          parentNode.x + LAYOUT.NODE_RADIUS,
          parentNode.y,
          x - LAYOUT.NODE_RADIUS,
          y
        );

        const edge: BranchEdge = {
          id: `${parentId}-${problem.id}`,
          sourceId: parentId,
          targetId: problem.id,
          sourceX: parentNode.x,
          sourceY: parentNode.y,
          targetX: x,
          targetY: y,
          targetProblem: problem,
          path: edgePath,
        };
        edges.push(edge);
      }
    }

    // Process children
    if (problem.children && problem.children.length > 0) {
      problem.children.forEach((child) => {
        processNode(child, column + 1, lane, problem.id);
      });
    }
  }

  // Process all root nodes
  tree.forEach((root, index) => {
    if (index > 0) {
      const usedLanes = columnLanes.get(0) || new Set();
      usedLanes.add(index * 2);
    }
    processNode(root, 0);
  });

  // Calculate bounds
  let maxX = 0;
  let maxY = 0;
  let minY = Infinity;
  nodes.forEach((node) => {
    maxX = Math.max(maxX, node.x + LAYOUT.NODE_WIDTH + LAYOUT.PADDING + 40);
    maxY = Math.max(maxY, node.y + LAYOUT.NODE_HEIGHT / 2 + LAYOUT.PADDING);
    minY = Math.min(minY, node.y - LAYOUT.NODE_HEIGHT / 2);
  });

  // Adjust for negative lanes
  if (minY < LAYOUT.PADDING) {
    const offset = LAYOUT.PADDING - minY + 20;
    nodes.forEach((node) => {
      node.y += offset;
    });
    edges.forEach((edge) => {
      edge.sourceY += offset;
      edge.targetY += offset;
      edge.path = generateBezierPath(
        edge.sourceX + LAYOUT.NODE_RADIUS,
        edge.sourceY,
        edge.targetX - LAYOUT.NODE_RADIUS,
        edge.targetY
      );
    });
    maxY += offset;
  }

  return {
    nodes,
    edges,
    bounds: {
      width: Math.max(maxX, 400),
      height: Math.max(maxY, 180),
    },
  };
}

// Edge component - Clickable, shows papers/ideas trying to solve the target problem
function BranchEdgeComponent({
  edge,
  isHighlighted,
  sourceOffset,
  targetOffset,
}: {
  edge: BranchEdge;
  isHighlighted?: boolean;
  sourceOffset?: NodeOffset;
  targetOffset?: NodeOffset;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const problem = edge.targetProblem;

  // Apply offsets to edge positions
  const sourceX = edge.sourceX + (sourceOffset?.dx || 0);
  const sourceY = edge.sourceY + (sourceOffset?.dy || 0);
  const targetX = edge.targetX + (targetOffset?.dx || 0);
  const targetY = edge.targetY + (targetOffset?.dy || 0);

  // Regenerate path with offsets
  const path = generateBezierPath(
    sourceX + LAYOUT.NODE_RADIUS,
    sourceY,
    targetX - LAYOUT.NODE_RADIUS,
    targetY
  );

  // Check if there are linked ideas or papers
  const hasLinkedIdeas = problem.linkedIdeaCount && problem.linkedIdeaCount > 0;
  const hasLinkedPaper = problem.paperId && problem.paperTitle;
  const hasContent = hasLinkedIdeas || hasLinkedPaper;

  // Calculate midpoint for the clickable area
  const midX = (sourceX + targetX) / 2 + 10;
  const midY = (sourceY + targetY) / 2;

  // Edge color based on content
  const edgeColor = hasContent
    ? "#a855f7" // purple for edges with papers/ideas
    : isHighlighted
      ? "#6366f1"
      : "#94a3b8";

  return (
    <g className="branch-edge">
      {/* Edge path */}
      <path
        d={path}
        fill="none"
        stroke={edgeColor}
        strokeWidth={isHighlighted ? 3 : 2}
        strokeLinecap="round"
        className="transition-colors duration-200"
      />

      {/* Clickable indicator on edge */}
      {hasContent && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <g
              className="cursor-pointer"
              onClick={() => setPopoverOpen(true)}
            >
              {/* Invisible larger hit area */}
              <rect
                x={midX - 30}
                y={midY - 15}
                width={60}
                height={30}
                fill="transparent"
              />
              {/* Visible pill */}
              <rect
                x={midX - 24}
                y={midY - 10}
                width={48}
                height={20}
                rx={10}
                fill="#a855f7"
                className="opacity-90 hover:opacity-100 transition-opacity"
              />
              <foreignObject x={midX - 22} y={midY - 9} width={44} height={18}>
                <div className="flex items-center justify-center gap-0.5 h-full">
                  <FileText className="w-3 h-3 text-white" />
                  <span className="text-[10px] text-white font-bold">
                    {(hasLinkedIdeas ? problem.linkedIdeaCount : 0) + (hasLinkedPaper ? 1 : 0)}
                  </span>
                </div>
              </foreignObject>
            </g>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" side="top">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BookOpen className="w-4 h-4 text-purple-500" />
                Papers & Ideas for this Problem
              </div>

              {/* Source paper (if any) */}
              {hasLinkedPaper && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">Source Paper:</div>
                  <Link href={`/paper/${problem.paperId}`}>
                    <div className="flex items-center gap-2 p-2 rounded-md bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer">
                      <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span className="text-xs font-medium line-clamp-2">{problem.paperTitle}</span>
                      <ExternalLink className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    </div>
                  </Link>
                </div>
              )}

              {/* Linked ideas */}
              {hasLinkedIdeas && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">
                    Research Ideas Attempting to Solve ({problem.linkedIdeaCount}):
                  </div>
                  <Link href={`/challenge/${problem.id}`}>
                    <div className="flex items-center justify-between p-2 rounded-md bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs">View all linked ideas</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-indigo-400" />
                    </div>
                  </Link>
                </div>
              )}

              {!hasLinkedPaper && !hasLinkedIdeas && (
                <p className="text-xs text-muted-foreground">No papers or ideas linked yet.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </g>
  );
}

// Node component - Shows source paper and solution paper indicators
// Now supports dragging and click-to-root
function BranchNodeComponent({
  node,
  isCurrent,
  onAddSubQuestion,
  offset,
  onDragStart,
  onDrag,
  onDragEnd,
  onSetAsRoot,
  isDragging,
}: {
  node: BranchNode;
  isCurrent?: boolean;
  onAddSubQuestion?: (parentId: string) => void;
  offset?: NodeOffset;
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void;
  onDrag?: (nodeId: string, dx: number, dy: number) => void;
  onDragEnd?: (nodeId: string) => void;
  onSetAsRoot?: (nodeId: string) => void;
  isDragging?: boolean;
}) {
  const { problem } = node;
  // Apply offset if the node has been dragged
  const x = node.x + (offset?.dx || 0);
  const y = node.y + (offset?.dy || 0);
  const isQuestion = problem.type === "open_question";
  const isSolved = problem.status === "solved";

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart?.(node.id, e);
  };

  return (
    <g
      className={cn("branch-node group", isDragging && "cursor-grabbing")}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Draggable handle area - the circle */}
      {/* Click = focus subtree, Drag = move node (handled by parent) */}
      <circle
        cx={x}
        cy={y}
        r={LAYOUT.NODE_RADIUS}
        fill={STATUS_COLORS[problem.status]}
        stroke={isCurrent ? "#4f46e5" : "white"}
        strokeWidth={isCurrent ? 3 : 2}
        className={cn(
          "transition-colors duration-200",
          isCurrent && "filter drop-shadow-lg",
          isDragging && "filter drop-shadow-xl"
        )}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
        onMouseDown={handleMouseDown}
      />

      {/* Status icon inside circle */}
      <foreignObject
        x={x - 7}
        y={y - 7}
        width={14}
        height={14}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center justify-center w-full h-full">
          {problem.status === "solved" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          ) : problem.status === "investigating" ? (
            <Search className="w-3.5 h-3.5 text-white" />
          ) : (
            <HelpCircle className="w-3.5 h-3.5 text-white" />
          )}
        </div>
      </foreignObject>

      {/* Node label card */}
      <foreignObject
        x={x + LAYOUT.LABEL_OFFSET}
        y={y - LAYOUT.NODE_HEIGHT / 2}
        width={LAYOUT.NODE_WIDTH}
        height={LAYOUT.NODE_HEIGHT}
      >
        <Link href={`/challenge/${problem.id}`}>
          <div
            className={cn(
              "h-full px-2 py-1.5 rounded-lg border text-left cursor-pointer transition-all hover:shadow-md",
              STATUS_BG[problem.status],
              isCurrent && "ring-2 ring-indigo-500 ring-offset-1"
            )}
          >
            <div className="flex items-start gap-1.5">
              {isQuestion ? (
                <HelpCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium line-clamp-2 leading-tight block">
                  {problem.title}
                </span>
                {/* Paper indicators below title */}
                <div className="flex items-center gap-1 mt-1">
                  {/* Source paper indicator */}
                  {problem.paperId && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-50 dark:bg-purple-900/30 border-purple-200">
                      <BookOpen className="w-2 h-2 mr-0.5 text-purple-500" />
                      Source
                    </Badge>
                  )}
                  {/* Solution indicator for solved problems */}
                  {isSolved && problem.solutionSummary && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 dark:bg-green-900/30 border-green-200">
                      <Trophy className="w-2 h-2 mr-0.5 text-green-500" />
                      Solved
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </foreignObject>

      {/* Add sub-question button (appears on hover) */}
      {isQuestion && onAddSubQuestion && (
        <foreignObject
          x={x + LAYOUT.LABEL_OFFSET + LAYOUT.NODE_WIDTH + 4}
          y={y - 10}
          width={20}
          height={20}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-sm border"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddSubQuestion(problem.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </foreignObject>
      )}
    </g>
  );
}

// Props interface
interface GitBranchTreeProps {
  tree: ChallengeProblem[];
  currentProblemId?: string;
  title?: string;
  onAddSubQuestion?: (parentId: string) => void;
  fullWidth?: boolean; // New prop for full-width mode
}

// Helper function to find a problem in the tree
function findProblemInTree(tree: ChallengeProblem[], id: string): ChallengeProblem | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findProblemInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper function to build a subtree with the selected node as root
function buildSubtreeFromNode(tree: ChallengeProblem[], nodeId: string): ChallengeProblem[] {
  const targetNode = findProblemInTree(tree, nodeId);
  if (!targetNode) return tree;
  return [targetNode];
}

export function GitBranchTree({
  tree,
  currentProblemId,
  title = "Research Progress",
  onAddSubQuestion,
  fullWidth = false,
}: GitBranchTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // State for which node is the current "root" for display
  const [displayRootId, setDisplayRootId] = useState<string | null>(null);

  // Calculate the tree to display (either full tree or subtree from selected root)
  const displayTree = useMemo(() => {
    if (!displayRootId) return tree;
    return buildSubtreeFromNode(tree, displayRootId);
  }, [tree, displayRootId]);

  const { nodes, edges, bounds } = useMemo(() => layoutGitGraph(displayTree), [displayTree]);

  // State for dragging nodes
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodeOffset>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartOffset, setDragStartOffset] = useState<NodeOffset | null>(null);
  const [hasDragged, setHasDragged] = useState(false); // Track if actual dragging occurred

  // Handle setting a new root node (click on node circle)
  const handleSetAsRoot = useCallback((nodeId: string) => {
    // If clicking the same node that's already root, go back to full tree
    if (displayRootId === nodeId) {
      setDisplayRootId(null);
    } else {
      setDisplayRootId(nodeId);
    }
    // Reset offsets when changing root
    setNodeOffsets({});
  }, [displayRootId]);

  // Reset to full tree view
  const handleResetView = useCallback(() => {
    setDisplayRootId(null);
    setNodeOffsets({});
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    setDraggingNodeId(nodeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragStartOffset(nodeOffsets[nodeId] || { dx: 0, dy: 0 });
    setHasDragged(false); // Reset drag detection
  }, [nodeOffsets]);

  // Handle mouse move for dragging
  useEffect(() => {
    if (!draggingNodeId || !dragStartPos || !dragStartOffset) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;

      // Only consider it a drag if moved more than 5 pixels
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        setHasDragged(true);
        setNodeOffsets(prev => ({
          ...prev,
          [draggingNodeId]: {
            dx: dragStartOffset.dx + dx,
            dy: dragStartOffset.dy + dy,
          },
        }));
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      // If we didn't drag, treat as a click to focus subtree
      if (!hasDragged && draggingNodeId) {
        const dx = Math.abs(e.clientX - dragStartPos.x);
        const dy = Math.abs(e.clientY - dragStartPos.y);
        if (dx < 5 && dy < 5) {
          // This was a click, not a drag - set as root
          handleSetAsRoot(draggingNodeId);
        }
      }
      setDraggingNodeId(null);
      setDragStartPos(null);
      setDragStartOffset(null);
      setHasDragged(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingNodeId, dragStartPos, dragStartOffset, hasDragged, handleSetAsRoot]);

  // Auto-scroll to current node
  useEffect(() => {
    if (currentProblemId && containerRef.current) {
      const currentNode = nodes.find((n) => n.id === currentProblemId);
      if (currentNode) {
        const scrollLeft = Math.max(0, currentNode.x - 150);
        containerRef.current.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [currentProblemId, nodes]);

  if (!tree || tree.length === 0) {
    return (
      <Card className={cn("p-4", fullWidth && "w-full")}>
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No research problems yet
        </p>
      </Card>
    );
  }

  // Calculate statistics
  const countNodes = (
    nodeList: ChallengeProblem[]
  ): { total: number; solved: number } => {
    let total = 0;
    let solved = 0;
    for (const node of nodeList) {
      total++;
      if (node.status === "solved") solved++;
      if (node.children) {
        const childCounts = countNodes(node.children);
        total += childCounts.total;
        solved += childCounts.solved;
      }
    }
    return { total, solved };
  };

  const { total, solved } = countNodes(tree);
  const progress = total > 0 ? Math.round((solved / total) * 100) : 0;

  // Find the current root node name for display
  const currentRootName = displayRootId
    ? findProblemInTree(tree, displayRootId)?.title || "Subtree"
    : null;

  return (
    <TooltipProvider>
      <Card className={cn("p-4", fullWidth && "w-full")}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-indigo-500" />
              {title}
            </h3>
            {/* Show current view indicator and reset button */}
            {displayRootId && (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  Viewing: {currentRootName?.slice(0, 30)}
                  {(currentRootName?.length || 0) > 30 ? "..." : ""}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleResetView}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reset to full tree view</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {solved}/{total} solved
            </span>
            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium">{progress}%</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-3 mb-3 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.unsolved }} />
            Unsolved
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.investigating }} />
            Investigating
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.solved }} />
            Solved
          </div>
          <div className="flex items-center gap-1 border-l pl-3 ml-1">
            <div className="w-6 h-0.5 bg-purple-500 rounded" />
            <span>Edge = Papers/Ideas</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-purple-50 dark:bg-purple-900/30 border-purple-200">
              <BookOpen className="w-2 h-2 mr-0.5" />
              Source
            </Badge>
            <span>= Paper that raised</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 dark:bg-green-900/30 border-green-200">
              <Trophy className="w-2 h-2 mr-0.5" />
              Solved
            </Badge>
            <span>= Milestone</span>
          </div>
          <div className="flex items-center gap-1 border-l pl-3 ml-1">
            <Move className="w-3 h-3" />
            <span>Drag to move</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded">Click ●</span>
            <span>= Focus subtree</span>
          </div>
        </div>

        {/* SVG Canvas with horizontal scroll */}
        <div
          ref={containerRef}
          className={cn(
            "overflow-x-auto overflow-y-hidden pb-2 border rounded-lg bg-slate-50/50 dark:bg-slate-900/20",
            draggingNodeId && "cursor-grabbing"
          )}
          style={{ maxHeight: bounds.height + 100 }}
        >
          <svg
            ref={svgRef}
            width={bounds.width}
            height={bounds.height}
            className="min-w-full"
            style={{ minHeight: 180 }}
          >
            {/* Edges (rendered first, behind nodes) */}
            <g className="edges">
              {edges.map((edge) => (
                <BranchEdgeComponent
                  key={edge.id}
                  edge={edge}
                  isHighlighted={
                    edge.sourceId === currentProblemId ||
                    edge.targetId === currentProblemId
                  }
                  sourceOffset={nodeOffsets[edge.sourceId]}
                  targetOffset={nodeOffsets[edge.targetId]}
                />
              ))}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {nodes.map((node) => (
                <BranchNodeComponent
                  key={node.id}
                  node={node}
                  isCurrent={node.id === currentProblemId}
                  onAddSubQuestion={onAddSubQuestion}
                  offset={nodeOffsets[node.id]}
                  onDragStart={handleDragStart}
                  onSetAsRoot={handleSetAsRoot}
                  isDragging={draggingNodeId === node.id}
                />
              ))}
            </g>
          </svg>
        </div>
      </Card>
    </TooltipProvider>
  );
}
