import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import type { ChallengeProblem } from "../../../shared/types";
import {
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Search,
  Plus,
  GitBranch,
  Link as LinkIcon,
} from "lucide-react";

interface ProgressTreeNodeProps {
  problem: ChallengeProblem;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  currentProblemId?: string;
  onAddSubQuestion?: (parentId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  unsolved: 'border-l-red-500',
  investigating: 'border-l-yellow-500',
  solved: 'border-l-green-500',
};

const STATUS_BG: Record<string, string> = {
  unsolved: 'bg-red-50 dark:bg-red-900/10',
  investigating: 'bg-yellow-50 dark:bg-yellow-900/10',
  solved: 'bg-green-50 dark:bg-green-900/10',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  unsolved: <HelpCircle className="h-3 w-3 text-red-500" />,
  investigating: <Search className="h-3 w-3 text-yellow-500" />,
  solved: <CheckCircle2 className="h-3 w-3 text-green-500" />,
};

function ProgressTreeNode({
  problem,
  depth,
  isExpanded,
  onToggle,
  currentProblemId,
  onAddSubQuestion,
}: ProgressTreeNodeProps) {
  const hasChildren = problem.children && problem.children.length > 0;
  const isCurrentNode = problem.id === currentProblemId;
  const isQuestion = problem.type === 'open_question';

  return (
    <div className="relative">
      {/* Connection line to parent */}
      {depth > 0 && (
        <div
          className="absolute -left-4 top-0 bottom-1/2 w-4 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 rounded-bl-lg"
          style={{ left: -16 }}
        />
      )}

      <div
        className={cn(
          "relative flex items-center gap-2 py-1.5 px-2 rounded-lg border-l-4 transition-colors cursor-pointer",
          STATUS_COLORS[problem.status],
          isCurrentNode
            ? "bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500"
            : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
        )}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-5" />
        )}

        {/* Status icon */}
        {STATUS_ICONS[problem.status]}

        {/* Type icon */}
        {isQuestion ? (
          <HelpCircle className="h-3 w-3 text-blue-500 flex-shrink-0" />
        ) : (
          <Lightbulb className="h-3 w-3 text-purple-500 flex-shrink-0" />
        )}

        {/* Title - clickable link */}
        <Link
          href={`/challenge/${problem.id}`}
          className="flex-1 min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              "text-sm truncate block hover:text-indigo-600 dark:hover:text-indigo-400",
              isCurrentNode && "font-semibold"
            )}
          >
            {problem.title}
          </span>
        </Link>

        {/* Child count and linked ideas */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isQuestion && problem.childCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              <GitBranch className="h-2 w-2 mr-0.5" />
              {problem.childCount}
            </Badge>
          )}
          {isQuestion && problem.linkedIdeaCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              <LinkIcon className="h-2 w-2 mr-0.5" />
              {problem.linkedIdeaCount}
            </Badge>
          )}
        </div>

        {/* Add sub-question button (only for questions) */}
        {isQuestion && onAddSubQuestion && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddSubQuestion(problem.id);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="ml-4 mt-1 relative">
          {/* Vertical line connecting children */}
          <div
            className="absolute left-0 top-0 bottom-4 border-l-2 border-slate-200 dark:border-slate-700"
            style={{ left: -16 }}
          />
          {problem.children!.map((child) => (
            <ProgressTreeNodeWrapper
              key={child.id}
              problem={child}
              depth={depth + 1}
              currentProblemId={currentProblemId}
              onAddSubQuestion={onAddSubQuestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Wrapper to manage expand state per node
function ProgressTreeNodeWrapper({
  problem,
  depth,
  currentProblemId,
  onAddSubQuestion,
}: {
  problem: ChallengeProblem;
  depth: number;
  currentProblemId?: string;
  onAddSubQuestion?: (parentId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  return (
    <ProgressTreeNode
      problem={problem}
      depth={depth}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      currentProblemId={currentProblemId}
      onAddSubQuestion={onAddSubQuestion}
    />
  );
}

interface ProgressTreeProps {
  tree: ChallengeProblem[];
  currentProblemId?: string;
  title?: string;
  onAddSubQuestion?: (parentId: string) => void;
}

export function ProgressTree({
  tree,
  currentProblemId,
  title = "Progress Tree",
  onAddSubQuestion,
}: ProgressTreeProps) {
  if (!tree || tree.length === 0) {
    return null;
  }

  // Calculate statistics
  const countNodes = (nodes: ChallengeProblem[]): { total: number; solved: number } => {
    let total = 0;
    let solved = 0;
    for (const node of nodes) {
      total++;
      if (node.status === 'solved') solved++;
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

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-indigo-500" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {solved}/{total} solved
          </span>
          <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Unsolved
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          Investigating
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          Solved
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-1">
        {tree.map((rootNode) => (
          <ProgressTreeNodeWrapper
            key={rootNode.id}
            problem={rootNode}
            depth={0}
            currentProblemId={currentProblemId}
            onAddSubQuestion={onAddSubQuestion}
          />
        ))}
      </div>
    </Card>
  );
}
