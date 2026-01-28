/**
 * Memory Log Panel
 *
 * Displays Private Memory (per agent) and Public Memory (shared) logs.
 * Allows viewing and editing agent identities and shared goals.
 */

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  Globe,
  User,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronDown,
  RefreshCw,
  Lightbulb,
  Shield,
  X,
} from "lucide-react";
import { storage } from "@/lib/agent-lego/storage";
import type {
  PrivateMemoryLog,
  PublicMemoryLog,
  PoliticalAgentBlock,
  AgentRole,
} from "@shared/types";
import { ROLE_DEFINITIONS } from "@/lib/agent-lego/politics";

interface MemoryLogPanelProps {
  workflowId: string;
  agents: PoliticalAgentBlock[];
  isOpen: boolean;
  onClose: () => void;
}

// Status badge colors
function getStatusColor(status: string): string {
  switch (status) {
    case 'idle':
      return 'bg-gray-100 text-gray-700';
    case 'working':
      return 'bg-blue-100 text-blue-700';
    case 'blocked':
      return 'bg-red-100 text-red-700';
    case 'waiting':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

// Entry type badge colors
function getEntryTypeColor(type: string): string {
  switch (type) {
    case 'progress':
      return 'bg-green-100 text-green-700';
    case 'problem':
      return 'bg-red-100 text-red-700';
    case 'help_request':
      return 'bg-orange-100 text-orange-700';
    case 'reflection':
      return 'bg-purple-100 text-purple-700';
    case 'decision':
      return 'bg-blue-100 text-blue-700';
    case 'milestone':
      return 'bg-emerald-100 text-emerald-700';
    case 'announcement':
      return 'bg-indigo-100 text-indigo-700';
    case 'role_reminder':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

// Severity badge colors
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-500 text-black';
    case 'low':
      return 'bg-gray-300 text-gray-700';
    default:
      return 'bg-gray-300 text-gray-700';
  }
}

// Milestone status colors
function getMilestoneStatusColor(status: string): string {
  switch (status) {
    case 'achieved':
      return 'text-green-600';
    case 'in_progress':
      return 'text-blue-600';
    case 'blocked':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function MemoryLogPanel({
  workflowId,
  agents,
  isOpen,
  onClose,
}: MemoryLogPanelProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    agents.length > 0 ? agents[0].id : null
  );
  const [publicLog, setPublicLog] = useState<PublicMemoryLog | null>(null);
  const [privateLogs, setPrivateLogs] = useState<Map<string, PrivateMemoryLog>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'goals', 'milestones', 'problems', 'identity', 'entries'
  ]);

  // Load memory logs
  const loadLogs = async () => {
    setIsLoading(true);
    try {
      // Load public log
      const pubLog = await storage.getPublicMemoryLog(workflowId);
      setPublicLog(pubLog || null);

      // Load private logs for all agents
      const privLogs = new Map<string, PrivateMemoryLog>();
      for (const agent of agents) {
        const log = await storage.getPrivateMemoryLog(workflowId, agent.id);
        if (log) {
          privLogs.set(agent.id, log);
        }
      }
      setPrivateLogs(privLogs);
    } catch (error) {
      console.error('Error loading memory logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load on mount and when workflowId changes
  useEffect(() => {
    if (isOpen && workflowId) {
      loadLogs();
    }
  }, [isOpen, workflowId, agents]);

  // Auto-refresh every 5 seconds while open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [isOpen, workflowId]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  if (!isOpen) return null;

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const selectedPrivateLog = selectedAgentId ? privateLogs.get(selectedAgentId) : null;

  return (
    <div className="w-96 border-l bg-background flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          Memory Logs
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={loadLogs}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'public' | 'private')}>
        <TabsList className="w-full justify-start px-3 pt-2">
          <TabsTrigger value="public" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Public
          </TabsTrigger>
          <TabsTrigger value="private" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Private
          </TabsTrigger>
        </TabsList>

        {/* Public Memory Tab */}
        <TabsContent value="public" className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-3 space-y-3">
              {publicLog ? (
                <>
                  {/* Main Goal */}
                  <Collapsible
                    open={expandedSections.includes('goals')}
                    onOpenChange={() => toggleSection('goals')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4 text-blue-500" />
                        Main Goal
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('goals') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      <p className="text-sm px-2">{publicLog.mainGoal || 'No goal set'}</p>
                      {publicLog.subGoals.length > 0 && (
                        <div className="px-2">
                          <p className="text-xs text-muted-foreground mb-1">Sub-goals:</p>
                          <ul className="text-sm list-disc list-inside">
                            {publicLog.subGoals.map((g, i) => (
                              <li key={i}>{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Milestones */}
                  <Collapsible
                    open={expandedSections.includes('milestones')}
                    onOpenChange={() => toggleSection('milestones')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Milestones
                        <Badge variant="secondary" className="text-[10px]">
                          {publicLog.milestones.length}
                        </Badge>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('milestones') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {publicLog.milestones.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2">No milestones yet</p>
                      ) : (
                        publicLog.milestones.map((m) => (
                          <div key={m.id} className="px-2 py-1.5 border rounded-md">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-medium", getMilestoneStatusColor(m.status))}>
                                {m.status === 'achieved' ? '✓' : m.status === 'blocked' ? '✗' : '○'}
                              </span>
                              <span className="text-sm font-medium">{m.title}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                          </div>
                        ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Active Problems */}
                  <Collapsible
                    open={expandedSections.includes('problems')}
                    onOpenChange={() => toggleSection('problems')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Problems
                        <Badge variant="secondary" className="text-[10px]">
                          {publicLog.activeProblems.filter(p => !p.resolvedAt).length}
                        </Badge>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('problems') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {publicLog.activeProblems.filter(p => !p.resolvedAt).length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2">No active problems</p>
                      ) : (
                        publicLog.activeProblems
                          .filter(p => !p.resolvedAt)
                          .map((p) => (
                            <div key={p.id} className="px-2 py-1.5 border rounded-md border-orange-200 bg-orange-50/50">
                              <div className="flex items-center gap-2">
                                <Badge className={cn("text-[10px]", getSeverityColor(p.severity))}>
                                  {p.severity}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  by {p.reportedBy}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{p.description}</p>
                            </div>
                          ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Role Reminders */}
                  <Collapsible
                    open={expandedSections.includes('roles')}
                    onOpenChange={() => toggleSection('roles')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Shield className="h-4 w-4 text-indigo-500" />
                        Team Roles
                        <Badge variant="secondary" className="text-[10px]">
                          {publicLog.roleReminders.length}
                        </Badge>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('roles') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {publicLog.roleReminders.map((r) => (
                        <div key={r.role} className="px-2 py-1.5 border rounded-md">
                          <span className="text-sm font-medium capitalize">{r.role}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.reminder}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Recent Entries */}
                  <Collapsible
                    open={expandedSections.includes('entries')}
                    onOpenChange={() => toggleSection('entries')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-slate-500" />
                        Recent Activity
                        <Badge variant="secondary" className="text-[10px]">
                          {publicLog.entries.length}
                        </Badge>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('entries') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {publicLog.entries.slice(-10).reverse().map((e) => (
                        <div key={e.id} className="px-2 py-1.5 border rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-[10px]", getEntryTypeColor(e.type))}>
                              {e.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mt-1">{e.title}</p>
                          <p className="text-xs text-muted-foreground">{e.content}</p>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No public memory log yet</p>
                  <p className="text-xs mt-1">Run the workflow to initialize</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Private Memory Tab */}
        <TabsContent value="private" className="flex-1 m-0">
          {/* Agent Selector */}
          <div className="p-3 border-b">
            <div className="flex flex-wrap gap-1.5">
              {agents.map((agent) => {
                const privateLog = privateLogs.get(agent.id);
                return (
                  <Button
                    key={agent.id}
                    variant={selectedAgentId === agent.id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    {agent.name}
                    {privateLog && (
                      <Badge
                        variant="secondary"
                        className={cn("ml-1 text-[9px]", getStatusColor(privateLog.currentStatus))}
                      >
                        {privateLog.currentStatus}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-240px)]">
            <div className="p-3 space-y-3">
              {selectedPrivateLog ? (
                <>
                  {/* Agent Header */}
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <User className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">{selectedAgent?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedAgent?.role}</p>
                    </div>
                    <Badge className={cn("ml-auto text-xs", getStatusColor(selectedPrivateLog.currentStatus))}>
                      {selectedPrivateLog.currentStatus}
                    </Badge>
                  </div>

                  {selectedPrivateLog.currentTask && (
                    <div className="px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-xs text-blue-600 font-medium">Current Task:</p>
                      <p className="text-sm">{selectedPrivateLog.currentTask}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Identity */}
                  <Collapsible
                    open={expandedSections.includes('identity')}
                    onOpenChange={() => toggleSection('identity')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Identity
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('identity') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2 px-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Skills</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPrivateLog.identity.skills.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Values</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedPrivateLog.identity.values.map((v, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{v}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Goals</p>
                        <ul className="text-xs list-disc list-inside mt-1">
                          {selectedPrivateLog.identity.goals.map((g, i) => (
                            <li key={i}>{g}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Constraints</p>
                        <ul className="text-xs list-disc list-inside mt-1">
                          {selectedPrivateLog.identity.constraints.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  {/* Progress Log */}
                  <Collapsible
                    open={expandedSections.includes('progress')}
                    onOpenChange={() => toggleSection('progress')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="h-4 w-4 text-slate-500" />
                        Progress Log
                        <Badge variant="secondary" className="text-[10px]">
                          {selectedPrivateLog.entries.length}
                        </Badge>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          expandedSections.includes('progress') && "rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {selectedPrivateLog.entries.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2">No progress entries yet</p>
                      ) : (
                        selectedPrivateLog.entries.slice(-15).reverse().map((e) => (
                          <div key={e.id} className="px-2 py-1.5 border rounded-md">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[10px]", getEntryTypeColor(e.type))}>
                                {e.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(e.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-1">{e.purpose}</p>
                            <p className="text-xs text-muted-foreground">{e.action}</p>
                            {e.result && (
                              <p className="text-xs mt-1">
                                <span className="font-medium">Result:</span> {e.result}
                              </p>
                            )}
                            {e.currentProblem && (
                              <p className="text-xs text-red-600 mt-1">
                                <span className="font-medium">Problem:</span> {e.currentProblem}
                              </p>
                            )}
                            {e.needsHelp && (
                              <p className="text-xs text-orange-600 mt-1">
                                <span className="font-medium">Needs help from {e.needsHelp.fromRole}:</span> {e.needsHelp.reason}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No private memory log yet</p>
                  <p className="text-xs mt-1">Select an agent or run the workflow</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
