import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { storage } from "@/lib/agent-lego/storage";
import { BlockPalette } from "@/components/agent-lego/panels/BlockPalette";
import { PropertiesPanel } from "@/components/agent-lego/panels/PropertiesPanel";
import { BlockNode } from "@/components/agent-lego/canvas/BlockNode";
import { ResizablePanel } from "@/components/agent-lego/ResizablePanel";
import {
  ExecutionLogPanel,
  type AgentLog,
  type AgentLogEntry,
  type BlackboardEntry,
  type ExecutionEvent,
  createLogEntry,
  createExecutionEvent,
} from "@/components/agent-lego/panels/ExecutionLogPanel";
import type { Workflow, WorkflowBlock, WorkflowConnection, BlockType, WorkflowStatus, AgentRole, PoliticalAgentBlock } from "@shared/types";
import { CommandFlowPanel } from "@/components/agent-lego/panels/CommandFlowPanel";
import { MemoryLogPanel } from "@/components/agent-lego/panels/MemoryLogPanel";
import { FinalOutputDialog } from "@/components/agent-lego/panels/FinalOutputDialog";
import { ROLE_DEFINITIONS } from "@/lib/agent-lego/politics";
import {
  Plus,
  Save,
  FolderOpen,
  Play,
  Pause,
  Square,
  Download,
  Upload,
  Trash2,
  Blocks,
  FileSearch,
  Terminal,
  LayoutTemplate,
  Key,
  ChevronDown,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
  Crown,
  Brain,
  Users,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WORKFLOW_TEMPLATES, createWorkflowFromTemplate, type WorkflowTemplateInfo } from "@/lib/agent-lego/workflow-templates";
import { WorkflowExecutor, type ExecutionState } from "@/lib/agent-lego/execution";
import { PoliticalWorkflowExecutor } from "@/lib/agent-lego/politics/executor";
import type { PoliticalWorkflow, PoliticalExecutionOptions } from "@shared/types";
import { Textarea } from "@/components/ui/textarea";

// Custom node types for React Flow
const nodeTypes = {
  blockNode: BlockNode,
};

// Convert WorkflowBlock to React Flow Node
function blockToNode(block: WorkflowBlock): Node {
  return {
    id: block.id,
    type: "blockNode",
    position: block.position,
    data: {
      block,
    },
  };
}

// Convert React Flow Node back to WorkflowBlock
function nodeToBlock(node: Node): WorkflowBlock {
  const block = node.data.block as WorkflowBlock;
  return {
    ...block,
    position: node.position,
  };
}

// Convert WorkflowConnection to React Flow Edge
function connectionToEdge(conn: WorkflowConnection): Edge {
  return {
    id: conn.id,
    source: conn.sourceBlockId,
    sourceHandle: conn.sourcePort,
    target: conn.targetBlockId,
    targetHandle: conn.targetPort,
    animated: conn.condition?.type !== "always",
    style: { stroke: "#6366f1", strokeWidth: 2 },
  };
}

// Convert React Flow Edge back to WorkflowConnection
function edgeToConnection(edge: Edge): WorkflowConnection {
  return {
    id: edge.id,
    sourceBlockId: edge.source,
    sourcePort: edge.sourceHandle || "output",
    targetBlockId: edge.target,
    targetPort: edge.targetHandle || "input",
  };
}

function AgentLegoContent() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Workflow state
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Dialog state
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDesc, setNewWorkflowDesc] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ openai: '', anthropic: '', google: '' });

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executorRef, setExecutorRef] = useState<WorkflowExecutor | null>(null);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);

  // Political executor ref (for pause/stop)
  const politicalExecutorRef = useRef<PoliticalWorkflowExecutor | null>(null);

  // Execution log panel state
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [agentLogs, setAgentLogs] = useState<Map<string, AgentLog>>(new Map());
  const [blackboard, setBlackboard] = useState<Map<string, BlackboardEntry>>(new Map());

  // Political command flow state (always active - political mode only)
  const [showCommandFlowPanel, setShowCommandFlowPanel] = useState(true);
  const [politicalCommands, setPoliticalCommands] = useState<import("@shared/types").Command[]>([]);
  const [politicalReports, setPoliticalReports] = useState<import("@shared/types").Report[]>([]);
  const [politicalMessages, setPoliticalMessages] = useState<import("@shared/types").PeerMessage[]>([]);
  const [politicalViolations, setPoliticalViolations] = useState<import("@shared/types").PermissionViolation[]>([]);

  // Memory log panel state
  const [showMemoryLogPanel, setShowMemoryLogPanel] = useState(false);

  // User instruction dialog state
  const [showInstructionDialog, setShowInstructionDialog] = useState(false);
  const [userInstruction, setUserInstruction] = useState("");

  // Final output dialog state
  const [showFinalOutputDialog, setShowFinalOutputDialog] = useState(false);
  const [finalResult, setFinalResult] = useState<string>("");
  const [executionStartTime, setExecutionStartTime] = useState<number>(0);
  const [generatedCode, setGeneratedCode] = useState<Array<{
    blockId: string;
    blockName?: string;
    code: string;
    language: string;
    executionResult?: { success: boolean; stdout: string; stderr: string };
  }>>([]);

  // User interrupt state (for sending messages to Commander during execution)
  const [showInterruptInput, setShowInterruptInput] = useState(false);
  const [interruptMessage, setInterruptMessage] = useState("");
  const pendingUserMessageRef = useRef<string | null>(null);

  // Panel visibility state (for resizable panels)
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize storage and load workflows
  useEffect(() => {
    async function initStorage() {
      try {
        await storage.init();
        const savedWorkflows = await storage.listWorkflows();
        setWorkflows(savedWorkflows);
        // Load API keys
        const keys = await storage.getApiKeys();
        setApiKeys({
          openai: keys.openai || '',
          anthropic: keys.anthropic || '',
          google: keys.google || '',
        });
      } catch (error) {
        console.error("Failed to initialize storage:", error);
        toast.error("Failed to initialize local storage");
      } finally {
        setIsLoading(false);
      }
    }
    initStorage();
  }, []);

  // Save API key when changed
  const handleApiKeyChange = useCallback(async (provider: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }));
    try {
      const keys = await storage.getApiKeys();
      keys[provider] = key;
      await storage.saveApiKeys(keys);
    } catch (e) {
      console.error('Failed to save API key:', e);
    }
  }, []);

  // Check if any API keys are configured
  const hasAnyApiKey = useMemo(() => {
    return Object.values(apiKeys).some(key => key?.trim());
  }, [apiKeys]);

  // Get required providers based on blocks in workflow
  const getRequiredProviders = useCallback(() => {
    if (!currentWorkflow) return [];
    const providers = new Set<string>();
    const modelToProvider: Record<string, string> = {
      'gpt-4o': 'openai', 'gpt-4o-mini': 'openai',
      'claude-sonnet-4': 'anthropic', 'claude-haiku-4': 'anthropic',
      'gemini-2-pro': 'google', 'gemini-2-flash': 'google',
    };
    for (const block of currentWorkflow.blocks) {
      const modelId = block.config.modelId as string;
      if (modelId && modelToProvider[modelId]) {
        providers.add(modelToProvider[modelId]);
      }
    }
    return Array.from(providers);
  }, [currentWorkflow]);

  // Sync nodes/edges when workflow changes
  useEffect(() => {
    if (currentWorkflow) {
      setNodes(currentWorkflow.blocks.map(blockToNode));
      setEdges(currentWorkflow.connections.map(connectionToEdge));
    } else {
      setNodes([]);
      setEdges([]);
    }
    setSelectedNode(null);
  }, [currentWorkflow, setNodes, setEdges]);

  // Create new workflow
  const handleCreateWorkflow = useCallback(async () => {
    if (!user) return;

    let workflow: Workflow;

    // Check if creating from template
    if (selectedTemplate) {
      const templateWorkflow = createWorkflowFromTemplate(selectedTemplate, user.id);
      if (!templateWorkflow) {
        toast.error("Failed to create workflow from template");
        return;
      }
      // Override name and description if provided
      workflow = {
        ...templateWorkflow,
        name: newWorkflowName.trim() || templateWorkflow.name,
        description: newWorkflowDesc.trim() || templateWorkflow.description,
      };
    } else {
      // Create empty workflow
      if (!newWorkflowName.trim()) {
        toast.error("Please enter a workflow name");
        return;
      }
      workflow = {
        id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: user.id,
        name: newWorkflowName.trim(),
        description: newWorkflowDesc.trim(),
        blocks: [],
        connections: [],
        status: "draft",
        globalMemory: {},
        runHistory: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    try {
      await storage.saveWorkflow(workflow);
      setWorkflows((prev) => [workflow, ...prev]);
      setCurrentWorkflow(workflow);
      setShowNewDialog(false);
      setNewWorkflowName("");
      setNewWorkflowDesc("");
      setSelectedTemplate(null);
      toast.success(selectedTemplate ? "Workflow created from template" : "Workflow created");
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error("Failed to create workflow");
    }
  }, [user, newWorkflowName, newWorkflowDesc, selectedTemplate]);

  // Load workflow
  const handleLoadWorkflow = useCallback(async (workflow: Workflow) => {
    setCurrentWorkflow(workflow);
    setShowLoadDialog(false);
    toast.success(`Loaded "${workflow.name}"`);
  }, []);

  // Save current workflow
  const handleSaveWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;

    setIsSaving(true);
    try {
      const updatedWorkflow: Workflow = {
        ...currentWorkflow,
        blocks: nodes.map(nodeToBlock),
        connections: edges.map(edgeToConnection),
        updatedAt: Date.now(),
      };

      await storage.saveWorkflow(updatedWorkflow);
      setCurrentWorkflow(updatedWorkflow);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === updatedWorkflow.id ? updatedWorkflow : w))
      );
      toast.success("Workflow saved");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  }, [currentWorkflow, nodes, edges]);

  // Delete workflow
  const handleDeleteWorkflow = useCallback(async (workflowId: string) => {
    try {
      await storage.deleteWorkflow(workflowId);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
      if (currentWorkflow?.id === workflowId) {
        setCurrentWorkflow(null);
      }
      toast.success("Workflow deleted");
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      toast.error("Failed to delete workflow");
    }
  }, [currentWorkflow]);

  // Export workflow
  const handleExportWorkflow = useCallback(async () => {
    if (!currentWorkflow) return;

    try {
      const blob = await storage.exportWorkflow(currentWorkflow.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentWorkflow.name.replace(/[^a-z0-9]/gi, "_")}_workflow.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Workflow exported");
    } catch (error) {
      console.error("Failed to export workflow:", error);
      toast.error("Failed to export workflow");
    }
  }, [currentWorkflow]);

  // Import workflow
  const handleImportWorkflow = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const workflow = await storage.importWorkflow(file);
      setWorkflows((prev) => [workflow, ...prev]);
      setCurrentWorkflow(workflow);
      toast.success(`Imported "${workflow.name}"`);
    } catch (error) {
      console.error("Failed to import workflow:", error);
      toast.error("Failed to import workflow");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Handle drag-drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!currentWorkflow) {
        toast.error("Please create or load a workflow first");
        return;
      }

      // Get drop position in flow coordinates
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 25,
      };

      // Check if dropping a political role block (always active)
      const politicalRole = event.dataTransfer.getData("application/agent-lego-political-role") as AgentRole;
      if (politicalRole) {
        const roleDef = ROLE_DEFINITIONS[politicalRole];

        // Create political agent block
        const newBlock: PoliticalAgentBlock = {
          id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          type: "supervisor", // Use supervisor as base type for political blocks
          name: roleDef.name,
          position,
          config: {
            modelId: "gpt-4o",
            temperature: 0.7,
            maxTokens: 4096,
            systemPrompt: roleDef.systemPromptTemplate,
          },
          status: "idle",
          memory: {},
          executionCount: 0,
          totalTokensUsed: 0,
          // Political properties
          role: politicalRole,
          authorityLevel: roleDef.authorityLevel,
          pendingCommands: [],
          commandHistory: [],
          reportHistory: [],
          subordinateIds: [],
          peerIds: [],
          politicalStatus: "idle",
          inbox: [],
          outbox: [],
        };

        setNodes((nds) => [...nds, blockToNode(newBlock as WorkflowBlock)]);
        toast.success(`Added ${roleDef.name} agent (Level ${roleDef.authorityLevel})`);
        return;
      }

      // Standard block drop
      const blockType = event.dataTransfer.getData("application/agent-lego-block") as BlockType;
      if (!blockType) return;

      // Create new block
      const newBlock: WorkflowBlock = {
        id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: blockType,
        name: blockType.charAt(0).toUpperCase() + blockType.slice(1).replace(/_/g, " "),
        position,
        config: {},
        status: "idle",
        memory: {},
        executionCount: 0,
        totalTokensUsed: 0,
      };

      // Add to nodes
      setNodes((nds) => [...nds, blockToNode(newBlock)]);
      toast.success(`Added ${newBlock.name} block`);
    },
    [currentWorkflow, setNodes]
  );

  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        source: params.source!,
        sourceHandle: params.sourceHandle,
        target: params.target!,
        targetHandle: params.targetHandle,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Handle node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Update block config
  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<WorkflowBlock>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === blockId) {
            return {
              ...node,
              data: {
                ...node.data,
                block: {
                  ...node.data.block,
                  ...updates,
                },
              },
            };
          }
          return node;
        })
      );

      // Update selected node if it's the one being modified
      if (selectedNode?.id === blockId) {
        setSelectedNode((prev) =>
          prev
            ? {
                ...prev,
                data: {
                  ...prev.data,
                  block: {
                    ...prev.data.block,
                    ...updates,
                  },
                },
              }
            : null
        );
      }
    },
    [selectedNode, setNodes]
  );

  // Delete selected block
  const handleDeleteBlock = useCallback(() => {
    if (!selectedNode) return;

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
    );
    setSelectedNode(null);
    toast.success("Block deleted");
  }, [selectedNode, setNodes, setEdges]);

  // Clear execution logs
  const handleClearLogs = useCallback(() => {
    setExecutionEvents([]);
    setAgentLogs(new Map());
    setBlackboard(new Map());
  }, []);

  // Add event to timeline
  const addEvent = useCallback((event: ExecutionEvent) => {
    setExecutionEvents(prev => [...prev, event]);
  }, []);

  // Update agent log
  const updateAgentLog = useCallback((blockId: string, updates: Partial<AgentLog>) => {
    setAgentLogs(prev => {
      const newLogs = new Map(prev);
      const existing = newLogs.get(blockId);
      if (existing) {
        newLogs.set(blockId, { ...existing, ...updates });
      }
      return newLogs;
    });
  }, []);

  // Add entry to agent log
  const addAgentLogEntry = useCallback((blockId: string, entry: AgentLogEntry) => {
    setAgentLogs(prev => {
      const newLogs = new Map(prev);
      const existing = newLogs.get(blockId);
      if (existing) {
        newLogs.set(blockId, {
          ...existing,
          entries: [...existing.entries, entry],
        });
      }
      return newLogs;
    });
  }, []);

  // Update blackboard
  const updateBlackboard = useCallback((key: string, value: unknown, setBy: string) => {
    setBlackboard(prev => {
      const newBoard = new Map(prev);
      newBoard.set(key, { key, value, setBy, timestamp: Date.now() });
      return newBoard;
    });
  }, []);

  // Check if current workflow is a political workflow (has blocks with roles)
  const isPoliticalWorkflow = useMemo(() => {
    if (!currentWorkflow) return false;
    // Check if any block has a 'role' property (political agent block)
    return currentWorkflow.blocks.some(block => 'role' in block);
  }, [currentWorkflow]);

  // Handle clicking the Run button - show instruction dialog for political workflows
  const handleRunClick = useCallback(() => {
    if (!currentWorkflow || !user) return;

    // Check if we have required API keys
    const requiredProviders = getRequiredProviders();
    const missingProviders = requiredProviders.filter(p => !apiKeys[p]?.trim());
    if (missingProviders.length > 0) {
      toast.error(`Missing API keys for: ${missingProviders.join(', ')}. Click the Key button to configure.`);
      setShowApiKeyDialog(true);
      return;
    }

    if (currentWorkflow.blocks.length === 0) {
      toast.error("Workflow has no blocks to execute");
      return;
    }

    // For political workflows, show the instruction dialog
    if (isPoliticalWorkflow) {
      setShowInstructionDialog(true);
    } else {
      // For standard workflows, run directly
      handleRunWorkflow();
    }
  }, [currentWorkflow, user, apiKeys, getRequiredProviders, isPoliticalWorkflow]);

  // Execute political workflow with the user instruction
  const handleExecutePoliticalWorkflow = useCallback(async () => {
    if (!currentWorkflow || !user || !userInstruction.trim()) return;

    setShowInstructionDialog(false);

    // Save workflow first with current node positions
    const blocks = nodes.map(nodeToBlock);
    const connections = edges.map(edgeToConnection);

    // Create a map for quick block lookup
    const blocksById = new Map(blocks.map(b => [b.id, b as PoliticalAgentBlock]));

    // Create political workflow structure
    const politicalWorkflow: PoliticalWorkflow = {
      ...currentWorkflow,
      blocks,
      connections,
      updatedAt: Date.now(),
      isPoliticalMode: true,
      politicalBlocks: blocks as PoliticalAgentBlock[],
      powerRelations: connections.map(c => {
        const superior = blocksById.get(c.sourceBlockId);
        const subordinate = blocksById.get(c.targetBlockId);
        return {
          id: c.id,
          superiorAgentId: c.sourceBlockId,
          superiorRole: superior?.role || 'commander',
          subordinateAgentId: c.targetBlockId,
          subordinateRole: subordinate?.role || 'researcher',
          type: 'command' as const,
        };
      }),
      commandHistory: [],
      reportHistory: [],
      messageHistory: [],
      violations: [],
      rootCommanderId: blocks.find(b => (b as PoliticalAgentBlock).role === 'commander')?.id || blocks[0]?.id || '',
      currentChainOfCommand: [],
    };

    await storage.saveWorkflow(politicalWorkflow);
    setCurrentWorkflow(politicalWorkflow);

    // Reset state
    setIsRunning(true);
    setIsPaused(false);
    setExecutionProgress(0);
    setCurrentBlockId(null);
    setShowLogPanel(true);
    setExecutionStartTime(Date.now());
    setFinalResult("");
    setGeneratedCode([]); // Clear generated code
    setShowInterruptInput(false);
    setInterruptMessage("");
    pendingUserMessageRef.current = null;

    // Clear political flow state
    setPoliticalCommands([]);
    setPoliticalReports([]);
    setPoliticalMessages([]);
    setPoliticalViolations([]);

    // Initialize agent logs
    const initialAgentLogs = new Map<string, AgentLog>();
    for (const block of blocks) {
      initialAgentLogs.set(block.id, {
        blockId: block.id,
        blockName: block.name,
        blockType: block.type,
        status: 'idle',
        entries: [],
        currentAction: undefined,
      });
    }
    setAgentLogs(initialAgentLogs);
    setBlackboard(new Map());

    // Add start event
    const startEvent = createExecutionEvent(
      'start',
      `Starting political workflow "${politicalWorkflow.name}" with instruction: "${userInstruction.substring(0, 50)}..."`
    );
    setExecutionEvents([startEvent]);

    // Reset all block statuses
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          block: {
            ...node.data.block,
            status: 'idle',
            lastError: undefined,
          },
        },
      }))
    );

    // Create political executor
    const executorOptions: PoliticalExecutionOptions = {
      apiKeys,
      userInstruction: userInstruction.trim(),
      haltOnViolation: true,
      onStatusChange: (status) => {
        addEvent(createExecutionEvent(
          status === 'completed' ? 'complete' : status === 'failed' ? 'failed' : 'info',
          `Workflow ${status}`
        ));

        if (status === 'completed') {
          toast.success('Political workflow completed!');
          setIsRunning(false);
          setCurrentBlockId(null);
        } else if (status === 'failed' || status === 'violation_halt') {
          toast.error(`Workflow ${status === 'violation_halt' ? 'halted due to violation' : 'failed'}`);
          setIsRunning(false);
          setCurrentBlockId(null);
        }
      },
      onAgentMessage: (blockId, role, content, metadata) => {
        const logType = role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : 'system';
        addAgentLogEntry(blockId, createLogEntry(logType, content, metadata));
      },
      onAgentAction: (blockId, action) => {
        updateAgentLog(blockId, { currentAction: action });
      },
      onAgentStatusChange: (blockId, status) => {
        const block = politicalWorkflow.politicalBlocks.find(b => b.id === blockId);
        const blockName = block?.name || blockId;

        addEvent(createExecutionEvent(
          status === 'executing' ? 'block_start' : status === 'idle' ? 'block_complete' : 'info',
          `${blockName}: ${status}`,
          blockId,
          blockName
        ));

        updateAgentLog(blockId, {
          status: status === 'executing' ? 'running' : status === 'idle' ? 'completed' : 'idle',
          currentAction: status === 'executing' ? 'Processing command...' : undefined,
        });

        setCurrentBlockId(status === 'executing' ? blockId : null);

        // Update node status in React Flow
        setNodes((nds) =>
          nds.map((node) =>
            node.id === blockId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    block: {
                      ...node.data.block,
                      status: status === 'executing' ? 'running' : status === 'idle' ? 'completed' : 'idle',
                    },
                  },
                }
              : node
          )
        );
      },
      onCommandIssued: (command) => {
        setPoliticalCommands(prev => [...prev, command]);
        addEvent(createExecutionEvent(
          'info',
          `Command issued: ${command.fromRole} → ${command.toRole}: ${command.instruction.substring(0, 50)}...`,
          command.fromAgentId
        ));
      },
      onReportReceived: (report) => {
        setPoliticalReports(prev => [...prev, report]);
        addEvent(createExecutionEvent(
          'info',
          `Report received: ${report.fromRole} → ${report.toRole}: ${report.status}`,
          report.fromAgentId
        ));
      },
      onViolation: (violation) => {
        setPoliticalViolations(prev => [...prev, violation]);
        addEvent(createExecutionEvent(
          'failed',
          `VIOLATION: ${violation.message}`,
          violation.violatingAgentId
        ));
        addAgentLogEntry(violation.violatingAgentId, createLogEntry('error', `Permission violation: ${violation.message}`));
      },
      onFinalResult: (result) => {
        setFinalResult(result);
        setShowFinalOutputDialog(true);
        addEvent(createExecutionEvent(
          'complete',
          `Final result ready (${result.length} chars)`
        ));
      },
      onCodeExecuted: (blockId, code, result) => {
        const block = politicalWorkflow.politicalBlocks.find(b => b.id === blockId);
        const blockName = block?.name || blockId;
        addEvent(createExecutionEvent(
          result.success ? 'info' : 'block_error',
          `${blockName}: Code executed ${result.success ? 'successfully' : 'with errors'} (${result.executionTime}ms)`,
          blockId,
          blockName
        ));
        addAgentLogEntry(blockId, createLogEntry(
          result.success ? 'info' : 'error',
          result.success
            ? `Code executed successfully:\n${result.stdout || '(no output)'}`
            : `Code execution failed:\n${result.stderr}`,
          { duration: result.executionTime }
        ));
        // Track generated code for FinalOutputDialog
        setGeneratedCode(prev => [...prev, {
          blockId,
          blockName,
          code,
          language: 'python',
          executionResult: {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
          },
        }]);
      },
      // User interrupt callback - returns and clears pending message
      getUserMessage: () => {
        const msg = pendingUserMessageRef.current;
        pendingUserMessageRef.current = null;
        return msg;
      },
    };

    const executor = new PoliticalWorkflowExecutor(politicalWorkflow, executorOptions);

    // Store executor ref for pause/stop control
    politicalExecutorRef.current = executor;

    try {
      await executor.execute();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Don't show error toast if it was a user-initiated stop
      if (!errorMessage.includes('aborted') && !errorMessage.includes('stopped')) {
        toast.error(`Execution error: ${errorMessage}`);
      }
    } finally {
      // Clear the executor ref when done
      politicalExecutorRef.current = null;
      setIsRunning(false);
    }
  }, [currentWorkflow, user, userInstruction, nodes, edges, apiKeys, setNodes, addEvent, updateAgentLog, addAgentLogEntry]);

  // Run standard workflow
  const handleRunWorkflow = useCallback(async () => {
    if (!currentWorkflow || !user) return;

    // Check if we have required API keys
    const requiredProviders = getRequiredProviders();
    const missingProviders = requiredProviders.filter(p => !apiKeys[p]?.trim());
    if (missingProviders.length > 0) {
      toast.error(`Missing API keys for: ${missingProviders.join(', ')}. Click the Key button to configure.`);
      setShowApiKeyDialog(true);
      return;
    }

    if (currentWorkflow.blocks.length === 0) {
      toast.error("Workflow has no blocks to execute");
      return;
    }

    // Save workflow first with current node positions
    const updatedWorkflow: Workflow = {
      ...currentWorkflow,
      blocks: nodes.map(nodeToBlock),
      connections: edges.map(edgeToConnection),
      updatedAt: Date.now(),
    };
    await storage.saveWorkflow(updatedWorkflow);
    setCurrentWorkflow(updatedWorkflow);

    // Reset state
    setIsRunning(true);
    setIsPaused(false);
    setExecutionProgress(0);
    setCurrentBlockId(null);
    setShowLogPanel(true); // Auto-open log panel

    // Clear previous logs and initialize agent logs for each block
    const initialAgentLogs = new Map<string, AgentLog>();
    for (const block of updatedWorkflow.blocks) {
      initialAgentLogs.set(block.id, {
        blockId: block.id,
        blockName: block.name,
        blockType: block.type,
        status: 'idle',
        entries: [],
        currentAction: undefined,
      });
    }
    setAgentLogs(initialAgentLogs);
    setBlackboard(new Map());

    // Add start event
    const startEvent = createExecutionEvent(
      'start',
      `Starting workflow "${updatedWorkflow.name}" with ${updatedWorkflow.blocks.length} blocks`
    );
    setExecutionEvents([startEvent]);

    // Reset all block statuses
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          block: {
            ...node.data.block,
            status: 'idle',
            lastError: undefined,
          },
        },
      }))
    );

    // Create executor with detailed logging
    const executor = new WorkflowExecutor(updatedWorkflow, {
      apiKeys,
      onBlockStart: (blockId) => {
        const block = updatedWorkflow.blocks.find(b => b.id === blockId);
        const blockName = block?.name || blockId;

        // Add event to timeline
        addEvent(createExecutionEvent(
          'block_start',
          `Starting ${blockName}`,
          blockId,
          blockName
        ));

        // Update agent log status
        updateAgentLog(blockId, {
          status: 'running',
          startTime: Date.now(),
          currentAction: 'Initializing...',
        });

        // Add info entry to agent log
        addAgentLogEntry(blockId, createLogEntry('info', `Block execution started`));

        // Set current block for UI highlighting
        setCurrentBlockId(blockId);

        // Update node status in React Flow
        setNodes((nds) =>
          nds.map((node) =>
            node.id === blockId
              ? { ...node, data: { ...node.data, block: { ...node.data.block, status: 'running' } } }
              : node
          )
        );
      },
      onBlockComplete: (blockId, result) => {
        const block = updatedWorkflow.blocks.find(b => b.id === blockId);
        const blockName = block?.name || blockId;

        // Add event to timeline
        addEvent(createExecutionEvent(
          'block_complete',
          `Completed ${blockName}`,
          blockId,
          blockName,
          result.output ? `Output: ${JSON.stringify(result.output).substring(0, 200)}...` : undefined
        ));

        // Update agent log status
        updateAgentLog(blockId, {
          status: 'completed',
          endTime: Date.now(),
          currentAction: undefined,
        });

        // Add completion entry to agent log
        addAgentLogEntry(blockId, createLogEntry(
          'info',
          `Block completed successfully`,
          { tokens: result.tokensUsed }
        ));

        // If there was output, log it
        if (result.output) {
          addAgentLogEntry(blockId, createLogEntry(
            'assistant',
            typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)
          ));
        }

        // Update blackboard with block output
        if (result.output) {
          updateBlackboard(`${blockId}_output`, result.output, blockName);
        }

        // Update node in React Flow
        setNodes((nds) =>
          nds.map((node) =>
            node.id === blockId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    block: {
                      ...node.data.block,
                      status: 'completed',
                      lastOutput: result.output,
                      executionCount: (node.data.block.executionCount || 0) + 1,
                      totalTokensUsed: (node.data.block.totalTokensUsed || 0) + (result.tokensUsed || 0),
                    },
                  },
                }
              : node
          )
        );
      },
      onBlockError: (blockId, error) => {
        const block = updatedWorkflow.blocks.find(b => b.id === blockId);
        const blockName = block?.name || blockId;

        // Add event to timeline
        addEvent(createExecutionEvent(
          'block_error',
          `Error in ${blockName}: ${error}`,
          blockId,
          blockName,
          error
        ));

        // Update agent log status
        updateAgentLog(blockId, {
          status: 'failed',
          endTime: Date.now(),
          currentAction: undefined,
        });

        // Add error entry to agent log
        addAgentLogEntry(blockId, createLogEntry('error', error));

        // Update blackboard with error
        updateBlackboard(`${blockId}_error`, error, blockName);

        // Update node in React Flow
        setNodes((nds) =>
          nds.map((node) =>
            node.id === blockId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    block: { ...node.data.block, status: 'failed', lastError: error },
                  },
                }
              : node
          )
        );
      },
      onStatusChange: (status) => {
        // Add event to timeline
        addEvent(createExecutionEvent(
          status === 'completed' ? 'complete' : status === 'failed' ? 'failed' : 'info',
          `Workflow ${status}`
        ));

        if (status === 'completed') {
          toast.success('Workflow completed successfully!');
          setIsRunning(false);
          setCurrentBlockId(null);
        } else if (status === 'failed') {
          toast.error('Workflow execution failed');
          setIsRunning(false);
          setCurrentBlockId(null);
        } else if (status === 'paused') {
          setIsPaused(true);
        }
      },
      onProgress: (completed, total) => {
        setExecutionProgress(total > 0 ? Math.round((completed / total) * 100) : 0);
      },
      // Callback for agent prompt/response logging
      onAgentMessage: (blockId, role, content, metadata) => {
        const logType = role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : 'system';
        addAgentLogEntry(blockId, createLogEntry(logType, content, metadata));
      },
      // Callback for action status updates
      onAgentAction: (blockId, action) => {
        updateAgentLog(blockId, { currentAction: action });
      },
    });

    setExecutorRef(executor);

    try {
      await executor.execute();
    } catch (error) {
      toast.error(`Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunning(false);
    }
  }, [currentWorkflow, user, apiKeys, nodes, edges, getRequiredProviders, setNodes]);

  // Pause workflow
  const handlePauseWorkflow = useCallback(() => {
    // Try standard executor first
    if (executorRef) {
      executorRef.pause();
      setIsPaused(true);
      toast.info('Workflow paused');
      return;
    }
    // Try political executor
    if (politicalExecutorRef.current) {
      politicalExecutorRef.current.pause();
      setIsPaused(true);
      toast.info('Workflow paused');
    }
  }, [executorRef]);

  // Resume workflow
  const handleResumeWorkflow = useCallback(async () => {
    if (executorRef) {
      setIsPaused(false);
      try {
        await executorRef.resume();
      } catch (error) {
        toast.error(`Resume error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    // Note: Political executor doesn't support resume - would need to re-run
    if (politicalExecutorRef.current) {
      toast.info('Political workflows cannot be resumed. Please restart.');
    }
  }, [executorRef]);

  // Stop workflow
  const handleStopWorkflow = useCallback(() => {
    // Try standard executor first
    if (executorRef) {
      executorRef.stop();
      setIsRunning(false);
      setIsPaused(false);
      toast.info('Workflow stopped');
      return;
    }
    // Try political executor
    if (politicalExecutorRef.current) {
      politicalExecutorRef.current.stop();
      setIsRunning(false);
      setIsPaused(false);
      toast.info('Workflow stopped');
    }
  }, [executorRef]);

  // Send interrupt message to Commander
  const handleSendInterrupt = useCallback(() => {
    if (!interruptMessage.trim()) return;

    // Store the message in the ref - executor will pick it up
    pendingUserMessageRef.current = interruptMessage.trim();
    toast.success('Message sent to Commander');
    addEvent(createExecutionEvent('info', `User interrupt: "${interruptMessage.trim().substring(0, 50)}..."`));
    setInterruptMessage('');
    setShowInterruptInput(false);
  }, [interruptMessage, addEvent]);

  // Show login required if not authenticated
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in Required</CardTitle>
            <CardDescription>
              Please sign in to use the Agent Lego workflow builder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/login")}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header toolbar */}
      <div className="border-b bg-background px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Blocks className="h-6 w-6 text-indigo-500" />
          <h1 className="text-lg font-semibold">Agent Lego</h1>
          {currentWorkflow && (
            <span className="text-sm text-muted-foreground">
              / {currentWorkflow.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowLoadDialog(true)}>
            <FolderOpen className="h-4 w-4 mr-1" />
            Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveWorkflow}
            disabled={!currentWorkflow || isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWorkflow}
            disabled={!currentWorkflow}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportWorkflow}
            accept=".json"
            className="hidden"
          />
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant={showCommandFlowPanel ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCommandFlowPanel(!showCommandFlowPanel)}
            className={showCommandFlowPanel ? "bg-purple-600 hover:bg-purple-700" : ""}
          >
            <Crown className="h-4 w-4 mr-1" />
            Command Flow
          </Button>
          <Button
            variant={showMemoryLogPanel ? "default" : "outline"}
            size="sm"
            onClick={() => setShowMemoryLogPanel(!showMemoryLogPanel)}
            className={showMemoryLogPanel ? "bg-teal-600 hover:bg-teal-700" : ""}
          >
            <Brain className="h-4 w-4 mr-1" />
            Memory Logs
          </Button>
          <Button
            variant={(showLogPanel && showRightPanel) ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowLogPanel(!showLogPanel);
              if (!showLogPanel) setShowRightPanel(true);
            }}
            className={(showLogPanel && showRightPanel) ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <ScrollText className="h-4 w-4 mr-1" />
            Exec Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApiKeyDialog(true)}
            className={hasAnyApiKey ? "" : "border-amber-500 text-amber-600"}
          >
            <Key className="h-4 w-4 mr-1" />
            API Keys
            {!hasAnyApiKey && <AlertCircle className="h-3 w-3 ml-1" />}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          {!isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunClick}
              disabled={!currentWorkflow || currentWorkflow.blocks.length === 0}
            >
              <Play className="h-4 w-4 mr-1" />
              Run
            </Button>
          ) : isPaused ? (
            <Button variant="outline" size="sm" onClick={handleResumeWorkflow}>
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handlePauseWorkflow}>
              <Pause className="h-4 w-4 mr-1" />
              Pause
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleStopWorkflow}
            disabled={!isRunning}
          >
            <Square className="h-4 w-4 mr-1" />
            Stop
          </Button>
          <Button
            variant={showLogPanel ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLogPanel(!showLogPanel)}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Logs
            {executionEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {executionEvents.length}
              </Badge>
            )}
          </Button>
          {isRunning && (
            <div className="flex items-center gap-2 ml-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-muted-foreground">{executionProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Block Palette (Political Mode) - Resizable */}
        <ResizablePanel
          side="left"
          defaultWidth={240}
          minWidth={180}
          maxWidth={400}
          isOpen={showLeftPanel}
          onToggle={() => setShowLeftPanel(!showLeftPanel)}
          title="Agent Roles"
          icon={<Users className="h-4 w-4 text-purple-500" />}
        >
          <BlockPalette isPoliticalMode={true} embedded />
        </ResizablePanel>

        {/* Center - React Flow Canvas */}
        <div className="flex-1 relative">
          {!currentWorkflow ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <Card className="max-w-sm text-center">
                <CardContent className="pt-6">
                  <Blocks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Workflow Open</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a new workflow or load an existing one to get started.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={() => setShowNewDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      New Workflow
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowLoadDialog(true)}>
                      <FolderOpen className="h-4 w-4 mr-1" />
                      Load
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              snapToGrid
              snapGrid={[15, 15]}
            >
              <Controls />
              <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
              <MiniMap
                nodeColor={(node) => {
                  const block = node.data.block as WorkflowBlock;
                  switch (block.status) {
                    case "running":
                      return "#22c55e";
                    case "completed":
                      return "#3b82f6";
                    case "failed":
                      return "#ef4444";
                    default:
                      return "#6366f1";
                  }
                }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Right sidebar - Properties Panel (Political Mode) */}
        {selectedNode && (
          <PropertiesPanel
            block={selectedNode.data.block as WorkflowBlock}
            onUpdate={(updates) => handleUpdateBlock(selectedNode.id, updates)}
            onDelete={handleDeleteBlock}
            isPoliticalMode={true}
          />
        )}

        {/* Command Flow Panel (always available) */}
        {showCommandFlowPanel && (
          <CommandFlowPanel
            commands={politicalCommands}
            reports={politicalReports}
            messages={politicalMessages}
            violations={politicalViolations}
            blocksById={new Map(nodes.map(n => [n.id, n.data.block as PoliticalAgentBlock]))}
          />
        )}

        {/* Memory Log Panel */}
        {currentWorkflow && (
          <MemoryLogPanel
            workflowId={currentWorkflow.id}
            agents={nodes.map(n => n.data.block as PoliticalAgentBlock)}
            isOpen={showMemoryLogPanel}
            onClose={() => setShowMemoryLogPanel(false)}
          />
        )}

        {/* Right sidebar - Execution Log (Resizable) */}
        <ResizablePanel
          side="right"
          defaultWidth={320}
          minWidth={200}
          maxWidth={600}
          isOpen={showRightPanel && showLogPanel}
          onToggle={() => {
            if (showLogPanel) {
              setShowRightPanel(!showRightPanel);
            } else {
              setShowLogPanel(true);
              setShowRightPanel(true);
            }
          }}
          title="Execution Log"
          icon={<ScrollText className="h-4 w-4 text-blue-500" />}
        >
          <ExecutionLogPanel
            isOpen={true}
            onClose={() => setShowLogPanel(false)}
            events={executionEvents}
            agentLogs={agentLogs}
            blackboard={blackboard}
            currentBlockId={currentBlockId}
            isRunning={isRunning}
            onClear={handleClearLogs}
            embedded
          />
        </ResizablePanel>
      </div>

      {/* New Workflow Dialog */}
      <Dialog open={showNewDialog} onOpenChange={(open) => {
        setShowNewDialog(open);
        if (!open) {
          setSelectedTemplate(null);
          setNewWorkflowName("");
          setNewWorkflowDesc("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Start from scratch or choose a template. All data is stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4" />
                Start from Template (Optional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {WORKFLOW_TEMPLATES.map((template) => {
                  const isSelected = selectedTemplate === template.id;
                  const IconComponent = template.icon === 'Crown' ? Crown
                    : template.icon === 'FileSearch' ? FileSearch
                    : template.icon === 'Terminal' ? Terminal
                    : Blocks;
                  return (
                    <div
                      key={template.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500"
                          : "border-border hover:border-indigo-300 hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTemplate(null);
                        } else {
                          setSelectedTemplate(template.id);
                          if (!newWorkflowName.trim()) {
                            setNewWorkflowName(template.name);
                          }
                          if (!newWorkflowDesc.trim()) {
                            setNewWorkflowDesc(template.description);
                          }
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? "bg-indigo-100" : "bg-muted"}`}>
                          <IconComponent className={`h-5 w-5 ${isSelected ? "text-indigo-600" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isSelected ? "text-indigo-700" : ""}`}>
                            {template.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Click to select a template, or leave unselected to start with an empty canvas.
              </p>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Name</label>
                <Input
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="My Research Workflow"
                />
              </div>
              <div className="space-y-2 mt-3">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newWorkflowDesc}
                  onChange={(e) => setNewWorkflowDesc(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkflow}
              disabled={!selectedTemplate && !newWorkflowName.trim()}
            >
              {selectedTemplate ? "Create from Template" : "Create Empty Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Workflow Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load Workflow</DialogTitle>
            <DialogDescription>
              Select a workflow to open. All workflows are stored locally in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto py-4">
            {workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No workflows found. Create a new one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleLoadWorkflow(workflow)}
                  >
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {workflow.blocks.length} blocks &middot;{" "}
                        {new Date(workflow.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkflow(workflow.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys Configuration Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys Configuration
            </DialogTitle>
            <DialogDescription>
              Configure API keys for AI providers. Keys are stored locally in your browser and used by agent blocks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* OpenAI */}
            <div className="space-y-2">
              <Label htmlFor="api-openai" className="flex items-center gap-2">
                OpenAI
                {apiKeys.openai?.trim() ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </Label>
              <Input
                id="api-openai"
                type="password"
                value={apiKeys.openai || ''}
                onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For GPT-4o, GPT-4o Mini models
              </p>
            </div>

            {/* Anthropic */}
            <div className="space-y-2">
              <Label htmlFor="api-anthropic" className="flex items-center gap-2">
                Anthropic
                {apiKeys.anthropic?.trim() ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </Label>
              <Input
                id="api-anthropic"
                type="password"
                value={apiKeys.anthropic || ''}
                onChange={(e) => handleApiKeyChange('anthropic', e.target.value)}
                placeholder="sk-ant-..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For Claude Sonnet 4, Claude Haiku 4 models
              </p>
            </div>

            {/* Google */}
            <div className="space-y-2">
              <Label htmlFor="api-google" className="flex items-center gap-2">
                Google AI
                {apiKeys.google?.trim() ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </Label>
              <Input
                id="api-google"
                type="password"
                value={apiKeys.google || ''}
                onChange={(e) => handleApiKeyChange('google', e.target.value)}
                placeholder="AI..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                For Gemini 2.0 Pro, Gemini 2.0 Flash models
              </p>
            </div>

            {currentWorkflow && getRequiredProviders().length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-muted">
                <p className="text-sm font-medium mb-2">Required for current workflow:</p>
                <div className="flex flex-wrap gap-2">
                  {getRequiredProviders().map(provider => (
                    <Badge
                      key={provider}
                      variant={apiKeys[provider]?.trim() ? "default" : "destructive"}
                    >
                      {provider}
                      {apiKeys[provider]?.trim() ? (
                        <CheckCircle className="h-3 w-3 ml-1" />
                      ) : (
                        <XCircle className="h-3 w-3 ml-1" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowApiKeyDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Instruction Dialog (for Political Workflow) */}
      <Dialog open={showInstructionDialog} onOpenChange={setShowInstructionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Give Instructions to Commander
            </DialogTitle>
            <DialogDescription>
              Enter your instructions for the workflow. The Commander will analyze and delegate tasks to the appropriate subordinates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-instruction">Your Instruction</Label>
              <Textarea
                id="user-instruction"
                value={userInstruction}
                onChange={(e) => setUserInstruction(e.target.value)}
                placeholder="e.g., Research the latest advances in attention mechanisms and write a summary report..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what you want to achieve. The Commander will break this down and delegate to Researcher, Writer, Coder, etc.
              </p>
            </div>

            {/* Quick examples */}
            <div className="space-y-2">
              <Label className="text-xs">Quick Examples</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserInstruction("Research the latest papers on transformer attention mechanisms and summarize the key findings.")}
                >
                  Research Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserInstruction("Write a Python function that implements a simple attention mechanism with comments explaining each step.")}
                >
                  Coding Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserInstruction("Review and improve the following concept: self-attention allows models to weigh the importance of different parts of the input.")}
                >
                  Review Task
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstructionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecutePoliticalWorkflow}
              disabled={!userInstruction.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Play className="h-4 w-4 mr-1" />
              Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Output Dialog */}
      <FinalOutputDialog
        isOpen={showFinalOutputDialog}
        onClose={() => setShowFinalOutputDialog(false)}
        result={finalResult}
        executionTime={executionStartTime > 0 ? Date.now() - executionStartTime : undefined}
        totalTokens={agentLogs.size > 0 ? Array.from(agentLogs.values()).reduce((sum, log) =>
          sum + (log.entries?.reduce((s, e) => s + (e.metadata?.tokens || 0), 0) || 0), 0) : undefined}
        workflowName={currentWorkflow?.name}
        generatedCode={generatedCode}
      />

      {/* Floating Interrupt Input - appears when running */}
      {isRunning && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
          {showInterruptInput ? (
            <Card className="p-3 shadow-lg border-purple-300 bg-background/95 backdrop-blur-sm w-[500px]">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <Input
                  value={interruptMessage}
                  onChange={(e) => setInterruptMessage(e.target.value)}
                  placeholder="Type a message to the Commander..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendInterrupt();
                    }
                    if (e.key === 'Escape') {
                      setShowInterruptInput(false);
                      setInterruptMessage('');
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSendInterrupt}
                  disabled={!interruptMessage.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Send
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowInterruptInput(false);
                    setInterruptMessage('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send, Escape to cancel. The Commander will see your message in the next iteration.
              </p>
            </Card>
          ) : (
            <Button
              onClick={() => setShowInterruptInput(true)}
              className="shadow-lg bg-purple-600 hover:bg-purple-700"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Interrupt Commander
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function AgentLego() {
  return (
    <ReactFlowProvider>
      <AgentLegoContent />
    </ReactFlowProvider>
  );
}
