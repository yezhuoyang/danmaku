import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { WorkflowBlock, BlockType, BlockStatus, AgentRole, PoliticalAgentBlock } from "@shared/types";
import { ROLE_DEFINITIONS, ROLE_CATEGORIES } from "@/lib/agent-lego/politics";
import {
  Settings,
  Trash2,
  ChevronDown,
  Bot,
  Database,
  GitBranch,
  Activity,
  History,
  Zap,
  Crown,
  Shield,
} from "lucide-react";

// Get status badge color
function getStatusColor(status: BlockStatus): string {
  switch (status) {
    case "running":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "waiting":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

// Check if block is an agent block
function isAgentBlock(type: BlockType): boolean {
  return ["researcher", "writer", "reviewer", "planner", "supervisor", "summarizer", "coder"].includes(type);
}

// Check if block is a logic block
function isLogicBlock(type: BlockType): boolean {
  return ["conditional", "loop", "merge", "delay", "python_verifier", "human_review", "code_executor"].includes(type);
}

// Simple list of AI models for selection
const AI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "claude-haiku-4", name: "Claude Haiku 4" },
  { id: "gemini-2-pro", name: "Gemini 2.0 Pro" },
  { id: "gemini-2-flash", name: "Gemini 2.0 Flash" },
];

interface PropertiesPanelProps {
  block: WorkflowBlock | PoliticalAgentBlock;
  onUpdate: (updates: Partial<WorkflowBlock | PoliticalAgentBlock>) => void;
  onDelete: () => void;
  isPoliticalMode?: boolean;
}

// Check if block is a political block
function isPoliticalBlock(block: WorkflowBlock | PoliticalAgentBlock): block is PoliticalAgentBlock {
  return 'role' in block && 'authorityLevel' in block;
}

// Get role icon component
function getRoleIcon(role: AgentRole): string {
  return ROLE_DEFINITIONS[role]?.icon || 'Bot';
}

// Get role color
function getRoleColor(role: AgentRole): string {
  const colors: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    zinc: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200',
  };
  const roleColor = ROLE_DEFINITIONS[role]?.color || 'gray';
  return colors[roleColor] || colors.gray;
}

export function PropertiesPanel({ block, onUpdate, onDelete, isPoliticalMode = true }: PropertiesPanelProps) {
  const [openSections, setOpenSections] = useState<string[]>(["basic", "config", "political"]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const updateConfig = (key: string, value: unknown) => {
    onUpdate({
      config: {
        ...block.config,
        [key]: value,
      },
    });
  };

  const isAgent = isAgentBlock(block.type);
  const isLogic = isLogicBlock(block.type);

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Properties
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{block.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", getStatusColor(block.status))}>
              {block.status}
            </Badge>
            {block.executionCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Run {block.executionCount}x
              </span>
            )}
            {block.totalTokensUsed > 0 && (
              <span className="text-xs text-muted-foreground">
                {block.totalTokensUsed.toLocaleString()} tokens
              </span>
            )}
          </div>

          <Separator />

          {/* Basic Settings */}
          <Collapsible
            open={openSections.includes("basic")}
            onOpenChange={() => toggleSection("basic")}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Basic Settings
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes("basic") && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Block Name</Label>
                <Input
                  value={block.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Block Type</Label>
                <Input
                  value={block.type}
                  disabled
                  className="h-8 text-sm bg-muted"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Political Settings (always shown) */}
          <Collapsible
            open={openSections.includes("political")}
            onOpenChange={() => toggleSection("political")}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-500" />
                Role &amp; Permissions
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes("political") && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Role Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Agent Role</Label>
                <Select
                  value={isPoliticalBlock(block) ? block.role : 'researcher'}
                  onValueChange={(value) => {
                    const roleDef = ROLE_DEFINITIONS[value as AgentRole];
                    onUpdate({
                      role: value as AgentRole,
                      authorityLevel: roleDef.authorityLevel,
                    } as Partial<PoliticalAgentBlock>);
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_CATEGORIES.map((category) => (
                      <div key={category.name}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {category.name}
                        </div>
                        {category.roles.map((role) => {
                          const def = ROLE_DEFINITIONS[role];
                          return (
                            <SelectItem key={role} value={role}>
                              <span className="flex items-center gap-2">
                                <span className="font-medium">{def.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  (Level {def.authorityLevel})
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Role Info */}
              {isPoliticalBlock(block) && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-xs", getRoleColor(block.role))}>
                      Level {block.authorityLevel}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_DEFINITIONS[block.role]?.name}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {ROLE_DEFINITIONS[block.role]?.description}
                  </p>

                  {/* Permissions */}
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Permissions
                    </Label>
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {ROLE_DEFINITIONS[block.role]?.permissions.resources.map((resource) => (
                          <Badge key={resource} variant="secondary" className="text-[10px]">
                            {resource.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Can Command */}
                  {ROLE_DEFINITIONS[block.role]?.permissions.canCommand.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Can Command</Label>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_DEFINITIONS[block.role]?.permissions.canCommand.map((role) => (
                          <Badge key={role} variant="outline" className="text-[10px]">
                            {ROLE_DEFINITIONS[role]?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reports To */}
                  {ROLE_DEFINITIONS[block.role]?.permissions.reportTo.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Reports To</Label>
                      <div className="flex flex-wrap gap-1">
                        {ROLE_DEFINITIONS[block.role]?.permissions.reportTo.map((role) => (
                          <Badge key={role} variant="outline" className="text-[10px]">
                            {ROLE_DEFINITIONS[role]?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Political Status */}
                  {block.politicalStatus && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Badge variant="secondary" className="text-xs">
                        {block.politicalStatus.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Agent Config (for agent blocks) */}
          {isAgent && (
            <>
              <Collapsible
                open={openSections.includes("config")}
                onOpenChange={() => toggleSection("config")}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    AI Configuration
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSections.includes("config") && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">AI Model</Label>
                    <Select
                      value={(block.config.modelId as string) || "gpt-4o"}
                      onValueChange={(value) => updateConfig("modelId", value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Temperature: {(block.config.temperature as number) || 0.7}
                    </Label>
                    <Slider
                      value={[(block.config.temperature as number) || 0.7]}
                      min={0}
                      max={2}
                      step={0.1}
                      onValueChange={([value]) => updateConfig("temperature", value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Tokens</Label>
                    <Input
                      type="number"
                      value={(block.config.maxTokens as number) || 4096}
                      onChange={(e) => updateConfig("maxTokens", parseInt(e.target.value))}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">System Prompt</Label>
                    <Textarea
                      value={(block.config.systemPrompt as string) || ""}
                      onChange={(e) => updateConfig("systemPrompt", e.target.value)}
                      placeholder="Enter system prompt for this agent..."
                      className="text-sm min-h-[80px]"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Logic Block Config */}
          {isLogic && (
            <>
              <Collapsible
                open={openSections.includes("config")}
                onOpenChange={() => toggleSection("config")}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
                  <span className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Logic Configuration
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSections.includes("config") && "rotate-180"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {block.type === "conditional" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Condition Expression</Label>
                      <Textarea
                        value={(block.config.condition as string) || ""}
                        onChange={(e) => updateConfig("condition", e.target.value)}
                        placeholder="Enter condition (e.g., output.score > 0.8)"
                        className="text-sm min-h-[60px] font-mono"
                      />
                    </div>
                  )}

                  {block.type === "loop" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max Iterations</Label>
                        <Input
                          type="number"
                          value={(block.config.maxIterations as number) || 10}
                          onChange={(e) => updateConfig("maxIterations", parseInt(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Stop Condition</Label>
                        <Input
                          value={(block.config.stopCondition as string) || ""}
                          onChange={(e) => updateConfig("stopCondition", e.target.value)}
                          placeholder="e.g., output.done === true"
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </>
                  )}

                  {block.type === "delay" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Delay (seconds)</Label>
                      <Input
                        type="number"
                        value={(block.config.delaySeconds as number) || 60}
                        onChange={(e) => updateConfig("delaySeconds", parseInt(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {block.type === "python_verifier" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Python Code</Label>
                      <Textarea
                        value={(block.config.code as string) || ""}
                        onChange={(e) => updateConfig("code", e.target.value)}
                        placeholder="# Python verification code\n# Use 'input' variable for block input\n# Return True/False"
                        className="text-sm min-h-[120px] font-mono"
                      />
                    </div>
                  )}

                  {block.type === "human_review" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Review Prompt</Label>
                      <Textarea
                        value={(block.config.prompt as string) || ""}
                        onChange={(e) => updateConfig("prompt", e.target.value)}
                        placeholder="What should the human reviewer consider?"
                        className="text-sm min-h-[80px]"
                      />
                    </div>
                  )}

                  {block.type === "code_executor" && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Timeout (ms)</Label>
                        <Input
                          type="number"
                          value={(block.config.timeout as number) || 60000}
                          onChange={(e) => updateConfig("timeout", parseInt(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max Debug Attempts</Label>
                        <Input
                          type="number"
                          value={(block.config.maxDebugAttempts as number) || 3}
                          onChange={(e) => updateConfig("maxDebugAttempts", parseInt(e.target.value))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Executes Python code from input. Automatically debugs errors up to the max attempts.
                      </p>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />
            </>
          )}

          {/* Memory (read-only) */}
          <Collapsible
            open={openSections.includes("memory")}
            onOpenChange={() => toggleSection("memory")}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Memory
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes("memory") && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {Object.keys(block.memory).length === 0 ? (
                <p className="text-xs text-muted-foreground">No memory stored yet.</p>
              ) : (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(block.memory, null, 2)}
                </pre>
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Execution History */}
          <Collapsible
            open={openSections.includes("history")}
            onOpenChange={() => toggleSection("history")}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Last Execution
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  openSections.includes("history") && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {block.lastInput !== undefined && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Input:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                    {String(JSON.stringify(block.lastInput, null, 2))}
                  </pre>
                </div>
              )}
              {block.lastOutput !== undefined && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Output:</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                    {String(JSON.stringify(block.lastOutput, null, 2))}
                  </pre>
                </div>
              )}
              {block.lastError && (
                <div>
                  <p className="text-xs font-medium text-destructive">Error:</p>
                  <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-auto max-h-20">
                    {block.lastError}
                  </pre>
                </div>
              )}
              {!block.lastInput && !block.lastOutput && !block.lastError && (
                <p className="text-xs text-muted-foreground">No execution history yet.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
