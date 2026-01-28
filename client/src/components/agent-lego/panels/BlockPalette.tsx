import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { BlockType, BlockCategory, AgentRole } from "@shared/types";
import { ROLE_DEFINITIONS, ROLE_CATEGORIES } from "@/lib/agent-lego/politics";
import {
  ChevronDown,
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
  Terminal,
  Crown,
  Target,
  Search,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

// Block definition for the palette
interface PaletteBlock {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ReactNode;
}

// Block categories with their blocks
interface BlockCategoryDef {
  category: BlockCategory;
  name: string;
  description: string;
  blocks: PaletteBlock[];
}

const BLOCK_CATEGORIES: BlockCategoryDef[] = [
  {
    category: "agent",
    name: "Agent Blocks",
    description: "AI-powered blocks that use LLMs",
    blocks: [
      {
        type: "researcher",
        name: "Researcher",
        description: "Reads papers, extracts information",
        icon: <FileSearch className="h-4 w-4" />,
      },
      {
        type: "writer",
        name: "Writer",
        description: "Generates text content",
        icon: <Pen className="h-4 w-4" />,
      },
      {
        type: "reviewer",
        name: "Reviewer",
        description: "Reviews and critiques content",
        icon: <ClipboardCheck className="h-4 w-4" />,
      },
      {
        type: "planner",
        name: "Planner",
        description: "Creates and manages task plans",
        icon: <ListTodo className="h-4 w-4" />,
      },
      {
        type: "supervisor",
        name: "Supervisor",
        description: "Monitors agents, makes decisions",
        icon: <Eye className="h-4 w-4" />,
      },
      {
        type: "summarizer",
        name: "Summarizer",
        description: "Condenses information",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        type: "coder",
        name: "Coder",
        description: "Writes and explains code",
        icon: <Code className="h-4 w-4" />,
      },
    ],
  },
  {
    category: "logic",
    name: "Logic Blocks",
    description: "Control flow and verification",
    blocks: [
      {
        type: "conditional",
        name: "Conditional",
        description: "Routes based on conditions",
        icon: <GitBranch className="h-4 w-4" />,
      },
      {
        type: "loop",
        name: "Loop",
        description: "Repeats a sub-workflow",
        icon: <Repeat className="h-4 w-4" />,
      },
      {
        type: "merge",
        name: "Merge",
        description: "Combines multiple inputs",
        icon: <Merge className="h-4 w-4" />,
      },
      {
        type: "delay",
        name: "Delay",
        description: "Waits for specified time",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        type: "python_verifier",
        name: "Python Verifier",
        description: "Runs Python code to verify",
        icon: <CheckSquare className="h-4 w-4" />,
      },
      {
        type: "human_review",
        name: "Human Review",
        description: "Pauses for human input",
        icon: <UserCheck className="h-4 w-4" />,
      },
      {
        type: "code_executor",
        name: "Code Executor",
        description: "Executes Python code with debugging",
        icon: <Terminal className="h-4 w-4" />,
      },
    ],
  },
  {
    category: "data",
    name: "Data Blocks",
    description: "Data management and I/O",
    blocks: [
      {
        type: "paper_fetcher",
        name: "Paper Fetcher",
        description: "Fetches papers from sources",
        icon: <Database className="h-4 w-4" />,
      },
      {
        type: "memory_store",
        name: "Memory Store",
        description: "Persistent key-value storage",
        icon: <Database className="h-4 w-4" />,
      },
      {
        type: "history_logger",
        name: "History Logger",
        description: "Logs all activities",
        icon: <History className="h-4 w-4" />,
      },
      {
        type: "progress_tracker",
        name: "Progress Tracker",
        description: "Tracks overall progress",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      {
        type: "file_writer",
        name: "File Writer",
        description: "Writes output to files",
        icon: <FileOutput className="h-4 w-4" />,
      },
      {
        type: "notification",
        name: "Notification",
        description: "Sends alerts to user",
        icon: <Bell className="h-4 w-4" />,
      },
    ],
  },
];

// Get color for category
function getCategoryColor(category: BlockCategory): string {
  switch (category) {
    case "agent":
      return "text-green-500 bg-green-500/10 border-green-500/20";
    case "logic":
      return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    case "data":
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    default:
      return "text-gray-500 bg-gray-500/10 border-gray-500/20";
  }
}

interface BlockItemProps {
  block: PaletteBlock;
  category: BlockCategory;
}

function BlockItem({ block, category }: BlockItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/agent-lego-block", block.type);
    e.dataTransfer.effectAllowed = "move";
  };

  const colorClass = getCategoryColor(category);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md border cursor-grab active:cursor-grabbing",
        "hover:bg-muted/50 transition-colors",
        colorClass
      )}
    >
      <div className="flex-shrink-0">{block.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{block.name}</p>
        <p className="text-xs text-muted-foreground truncate">{block.description}</p>
      </div>
    </div>
  );
}

// Political role palette item
interface PoliticalRoleItem {
  role: AgentRole;
  name: string;
  description: string;
  level: number;
  icon: React.ReactNode;
}

// Get icon for role
function getRoleIcon(iconName: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    Crown: <Crown className="h-4 w-4" />,
    Target: <Target className="h-4 w-4" />,
    Eye: <Eye className="h-4 w-4" />,
    CheckCircle: <ClipboardCheck className="h-4 w-4" />,
    Search: <Search className="h-4 w-4" />,
    Code: <Code className="h-4 w-4" />,
    Pen: <Pen className="h-4 w-4" />,
    ShieldCheck: <ShieldCheck className="h-4 w-4" />,
    History: <History className="h-4 w-4" />,
    MessageSquare: <MessageSquare className="h-4 w-4" />,
  };
  return icons[iconName] || <Bot className="h-4 w-4" />;
}

// Get color for political category
function getPoliticalCategoryColor(categoryName: string): string {
  switch (categoryName) {
    case 'Leadership':
      return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
    case 'Quality':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'Workers':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'Support':
      return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    default:
      return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  }
}

// Political role item component
interface PoliticalRoleItemProps {
  role: AgentRole;
  categoryColor: string;
}

function PoliticalRoleItem({ role, categoryColor }: PoliticalRoleItemProps) {
  const roleDef = ROLE_DEFINITIONS[role];

  const handleDragStart = (e: React.DragEvent) => {
    // Send role info for political block creation
    e.dataTransfer.setData("application/agent-lego-political-role", role);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md border cursor-grab active:cursor-grabbing",
        "hover:bg-muted/50 transition-colors",
        categoryColor
      )}
    >
      <div className="flex-shrink-0">{getRoleIcon(roleDef.icon)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{roleDef.name}</p>
          <Badge variant="secondary" className="text-[10px]">
            L{roleDef.authorityLevel}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{roleDef.description}</p>
      </div>
    </div>
  );
}

interface BlockPaletteProps {
  isPoliticalMode?: boolean;
  /** If true, uses minimal styling (for use inside ResizablePanel) */
  embedded?: boolean;
}

export function BlockPalette({ isPoliticalMode = true, embedded = false }: BlockPaletteProps) {
  const [openCategories, setOpenCategories] = useState<string[]>(
    ['Leadership', 'Workers', 'Quality', 'Support']
  );

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // Embedded mode: no fixed width, no border (parent handles that)
  if (embedded) {
    return (
      <div className="h-full flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {ROLE_CATEGORIES.map((category) => (
              <Collapsible
                key={category.name}
                open={openCategories.includes(category.name)}
                onOpenChange={() => toggleCategory(category.name)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    {category.name}
                    <Badge variant="secondary" className="text-[10px]">
                      {category.roles.length}
                    </Badge>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openCategories.includes(category.name) && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 pt-1">
                  <p className="text-xs text-muted-foreground px-2 pb-1">
                    {category.description}
                  </p>
                  {category.roles.map((role) => (
                    <PoliticalRoleItem
                      key={role}
                      role={role}
                      categoryColor={getPoliticalCategoryColor(category.name)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t text-xs text-muted-foreground">
          Drag agents onto canvas
        </div>
      </div>
    );
  }

  // Standard mode with full styling
  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col">
      <div className="p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Crown className="h-4 w-4 text-purple-500" />
          Agent Roles
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Drag agents with roles onto the canvas
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Political mode: Show role categories */}
          {ROLE_CATEGORIES.map((category) => (
            <Collapsible
              key={category.name}
              open={openCategories.includes(category.name)}
              onOpenChange={() => toggleCategory(category.name)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 text-sm font-medium">
                <span className="flex items-center gap-2">
                  {category.name}
                  <Badge variant="secondary" className="text-[10px]">
                    {category.roles.length}
                  </Badge>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openCategories.includes(category.name) && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <p className="text-xs text-muted-foreground px-2 pb-1">
                  {category.description}
                </p>
                {category.roles.map((role) => (
                  <PoliticalRoleItem
                    key={role}
                    role={role}
                    categoryColor={getPoliticalCategoryColor(category.name)}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
