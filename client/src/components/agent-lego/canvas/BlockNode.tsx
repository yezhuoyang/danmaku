import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import type { WorkflowBlock, BlockType, BlockStatus, BlockCategory } from "@shared/types";
import {
  Bot,
  FileSearch,
  Pen,
  ClipboardCheck,
  ListTodo,
  Eye,
  FileText,
  Code,
  GitBranch,
  Repeat,
  Merge,
  Clock,
  CheckSquare,
  UserCheck,
  Database,
  FileOutput,
  History,
  TrendingUp,
  Bell,
  Loader2,
  CheckCircle2,
  XCircle,
  Pause,
} from "lucide-react";

// Get icon for block type
function getBlockIcon(type: BlockType): React.ReactNode {
  const iconProps = { className: "h-4 w-4" };

  switch (type) {
    // Agent blocks
    case "researcher":
      return <FileSearch {...iconProps} />;
    case "writer":
      return <Pen {...iconProps} />;
    case "reviewer":
      return <ClipboardCheck {...iconProps} />;
    case "planner":
      return <ListTodo {...iconProps} />;
    case "supervisor":
      return <Eye {...iconProps} />;
    case "summarizer":
      return <FileText {...iconProps} />;
    case "coder":
      return <Code {...iconProps} />;

    // Logic blocks
    case "conditional":
      return <GitBranch {...iconProps} />;
    case "loop":
      return <Repeat {...iconProps} />;
    case "merge":
      return <Merge {...iconProps} />;
    case "delay":
      return <Clock {...iconProps} />;
    case "python_verifier":
      return <CheckSquare {...iconProps} />;
    case "human_review":
      return <UserCheck {...iconProps} />;

    // Data blocks
    case "paper_fetcher":
      return <Database {...iconProps} />;
    case "memory_store":
      return <Database {...iconProps} />;
    case "history_logger":
      return <History {...iconProps} />;
    case "progress_tracker":
      return <TrendingUp {...iconProps} />;
    case "file_writer":
      return <FileOutput {...iconProps} />;
    case "notification":
      return <Bell {...iconProps} />;

    default:
      return <Bot {...iconProps} />;
  }
}

// Get category for block type
function getBlockCategory(type: BlockType): BlockCategory {
  if (["researcher", "writer", "reviewer", "planner", "supervisor", "summarizer", "coder"].includes(type)) {
    return "agent";
  }
  if (["conditional", "loop", "merge", "delay", "python_verifier", "human_review"].includes(type)) {
    return "logic";
  }
  return "data";
}

// Get color classes for block category
function getCategoryColors(category: BlockCategory): { bg: string; border: string; text: string } {
  switch (category) {
    case "agent":
      return {
        bg: "bg-green-50 dark:bg-green-950/30",
        border: "border-green-200 dark:border-green-800",
        text: "text-green-600 dark:text-green-400",
      };
    case "logic":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        text: "text-amber-600 dark:text-amber-400",
      };
    case "data":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        text: "text-blue-600 dark:text-blue-400",
      };
    default:
      return {
        bg: "bg-gray-50 dark:bg-gray-950/30",
        border: "border-gray-200 dark:border-gray-800",
        text: "text-gray-600 dark:text-gray-400",
      };
  }
}

// Get status indicator
function getStatusIndicator(status: BlockStatus): React.ReactNode {
  switch (status) {
    case "running":
      return <Loader2 className="h-3 w-3 animate-spin text-green-500" />;
    case "completed":
      return <CheckCircle2 className="h-3 w-3 text-blue-500" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "waiting":
      return <Pause className="h-3 w-3 text-amber-500" />;
    default:
      return null;
  }
}

// Get handle positions based on block type
function getHandleConfig(type: BlockType): { inputs: number; outputs: number } {
  switch (type) {
    case "conditional":
      return { inputs: 1, outputs: 2 }; // true/false outputs
    case "merge":
      return { inputs: 2, outputs: 1 }; // multiple inputs
    case "loop":
      return { inputs: 1, outputs: 2 }; // continue/done outputs
    default:
      return { inputs: 1, outputs: 1 };
  }
}

interface BlockNodeData {
  block: WorkflowBlock;
}

function BlockNodeComponent({ data, selected }: NodeProps<BlockNodeData>) {
  const { block } = data;
  const category = getBlockCategory(block.type);
  const colors = getCategoryColors(category);
  const handleConfig = getHandleConfig(block.type);

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 shadow-sm min-w-[180px] max-w-[220px]",
        colors.bg,
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : colors.border,
        "transition-all duration-150"
      )}
    >
      {/* Input handle(s) */}
      {handleConfig.inputs === 1 && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        />
      )}
      {handleConfig.inputs === 2 && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="input-a"
            style={{ top: "33%" }}
            className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="input-b"
            style={{ top: "66%" }}
            className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
          />
        </>
      )}

      {/* Block header */}
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("flex-shrink-0", colors.text)}>{getBlockIcon(block.type)}</div>
        <span className="font-medium text-sm truncate flex-1">{block.name}</span>
        {getStatusIndicator(block.status)}
      </div>

      {/* Block type label */}
      <div className="text-xs text-muted-foreground capitalize">
        {block.type.replace(/_/g, " ")}
      </div>

      {/* Token usage if any */}
      {block.totalTokensUsed > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          {block.totalTokensUsed.toLocaleString()} tokens
        </div>
      )}

      {/* Output handle(s) */}
      {handleConfig.outputs === 1 && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        />
      )}
      {handleConfig.outputs === 2 && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="output-true"
            style={{ top: "33%" }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="output-false"
            style={{ top: "66%" }}
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
          />
        </>
      )}
    </div>
  );
}

// Memo for performance
export const BlockNode = memo(BlockNodeComponent);
