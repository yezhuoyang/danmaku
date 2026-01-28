/**
 * Agent Lego Execution Engine
 *
 * Client-side workflow execution engine that:
 * 1. Validates workflow structure and connections
 * 2. Resolves execution order (topological sort)
 * 3. Executes blocks in order, passing data via connections
 * 4. Handles conditional branching, loops, and merges
 * 5. Manages block memory and agent sessions
 */

import type {
  Workflow,
  WorkflowBlock,
  WorkflowConnection,
  BlockStatus,
  BlockExecutionContext,
  BlockExecutionResult,
  Blackboard,
  Artifact,
  WorkflowEvent,
  MergeRequest,
} from '@shared/types';
import { storage } from '../storage';
import { executeBlock } from './executors';

// Execution state
export interface ExecutionState {
  workflowId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  currentBlockId: string | null;
  completedBlocks: Set<string>;
  pendingBlocks: Set<string>;
  blockOutputs: Map<string, unknown>;  // blockId -> output
  errors: Array<{ blockId: string; error: string; timestamp: number }>;
  startedAt: number;
  totalTokensUsed: number;
  // Collaboration state (simplified for now)
  blackboard: Blackboard | null;
  artifacts: Artifact[];
  events: WorkflowEvent[];
  pendingMergeRequests: MergeRequest[];
}

// Execution options
export interface ExecutionOptions {
  startBlockId?: string;  // Start from specific block (for partial execution)
  apiKeys: Record<string, string>;  // Decrypted API keys
  onBlockStart?: (blockId: string) => void;
  onBlockComplete?: (blockId: string, result: BlockExecutionResult) => void;
  onBlockError?: (blockId: string, error: string) => void;
  onStatusChange?: (status: ExecutionState['status']) => void;
  onProgress?: (completed: number, total: number) => void;
  // Agent logging callbacks for detailed debugging
  onAgentMessage?: (
    blockId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: { model?: string; tokens?: number; duration?: number }
  ) => void;
  onAgentAction?: (blockId: string, action: string) => void;
  // Collaboration callbacks (for future integration)
  onArtifactCreated?: (artifact: Artifact) => void;
  onArtifactUpdated?: (artifact: Artifact) => void;
  onEventEmitted?: (event: WorkflowEvent) => void;
  onMergeRequested?: (request: MergeRequest) => void;
  onMergeApprovalRequired?: (request: MergeRequest) => Promise<boolean>;
  // Collaboration options
  blackboardId?: string;  // Existing blackboard to use
  autoApproveMerges?: boolean;  // Auto-approve merge requests from agents
  contextBudget?: number;  // Max tokens for context assembly
}

/**
 * Validates a workflow structure
 */
export function validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const blockIds = new Set(workflow.blocks.map(b => b.id));

  // Check for empty workflow
  if (workflow.blocks.length === 0) {
    errors.push('Workflow has no blocks');
    return { valid: false, errors };
  }

  // Check connections reference valid blocks
  for (const conn of workflow.connections) {
    if (!blockIds.has(conn.sourceBlockId)) {
      errors.push(`Connection ${conn.id} references non-existent source block ${conn.sourceBlockId}`);
    }
    if (!blockIds.has(conn.targetBlockId)) {
      errors.push(`Connection ${conn.id} references non-existent target block ${conn.targetBlockId}`);
    }
  }

  // Check for cycles (would cause infinite loops)
  const hasCycle = detectCycle(workflow);
  if (hasCycle) {
    errors.push('Workflow contains a cycle - this would cause infinite execution');
  }

  // Check that all blocks have required config
  for (const block of workflow.blocks) {
    if (!block.type) {
      errors.push(`Block ${block.id} has no type`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Detect cycles in the workflow graph using DFS
 */
function detectCycle(workflow: Workflow): boolean {
  const adjacency = new Map<string, string[]>();

  // Build adjacency list
  for (const block of workflow.blocks) {
    adjacency.set(block.id, []);
  }
  for (const conn of workflow.connections) {
    const targets = adjacency.get(conn.sourceBlockId) || [];
    targets.push(conn.targetBlockId);
    adjacency.set(conn.sourceBlockId, targets);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(blockId: string): boolean {
    visited.add(blockId);
    recursionStack.add(blockId);

    const neighbors = adjacency.get(blockId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;  // Back edge found - cycle exists
      }
    }

    recursionStack.delete(blockId);
    return false;
  }

  for (const block of workflow.blocks) {
    if (!visited.has(block.id)) {
      if (dfs(block.id)) return true;
    }
  }

  return false;
}

/**
 * Get blocks in topological order (respecting dependencies)
 */
export function getExecutionOrder(workflow: Workflow): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const block of workflow.blocks) {
    inDegree.set(block.id, 0);
    adjacency.set(block.id, []);
  }

  // Build graph
  for (const conn of workflow.connections) {
    const targets = adjacency.get(conn.sourceBlockId) || [];
    targets.push(conn.targetBlockId);
    adjacency.set(conn.sourceBlockId, targets);

    inDegree.set(conn.targetBlockId, (inDegree.get(conn.targetBlockId) || 0) + 1);
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];

  // Start with blocks that have no incoming edges (source blocks)
  inDegree.forEach((degree, blockId) => {
    if (degree === 0) {
      queue.push(blockId);
    }
  });

  while (queue.length > 0) {
    const blockId = queue.shift()!;
    result.push(blockId);

    const neighbors = adjacency.get(blockId) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return result;
}

/**
 * Get incoming connections for a block
 */
export function getIncomingConnections(
  workflow: Workflow,
  blockId: string
): WorkflowConnection[] {
  return workflow.connections.filter(c => c.targetBlockId === blockId);
}

/**
 * Get outgoing connections for a block
 */
export function getOutgoingConnections(
  workflow: Workflow,
  blockId: string
): WorkflowConnection[] {
  return workflow.connections.filter(c => c.sourceBlockId === blockId);
}

/**
 * Collect input data for a block from its incoming connections
 */
function collectBlockInput(
  workflow: Workflow,
  blockId: string,
  blockOutputs: Map<string, unknown>
): unknown {
  const incoming = getIncomingConnections(workflow, blockId);

  if (incoming.length === 0) {
    return null;  // Source block, no input
  }

  if (incoming.length === 1) {
    // Single input - pass through directly
    const conn = incoming[0];
    return blockOutputs.get(conn.sourceBlockId);
  }

  // Multiple inputs - combine into object
  const combined: Record<string, unknown> = {};
  for (const conn of incoming) {
    const portId = conn.targetPort || 'input';
    combined[portId] = blockOutputs.get(conn.sourceBlockId);
  }
  return combined;
}

/**
 * Main execution engine class
 */
export class WorkflowExecutor {
  private workflow: Workflow;
  private state: ExecutionState;
  private options: ExecutionOptions;
  private abortController: AbortController;

  constructor(workflow: Workflow, options: ExecutionOptions) {
    this.workflow = workflow;
    this.options = options;
    this.abortController = new AbortController();

    this.state = {
      workflowId: workflow.id,
      status: 'idle',
      currentBlockId: null,
      completedBlocks: new Set(),
      pendingBlocks: new Set(workflow.blocks.map(b => b.id)),
      blockOutputs: new Map(),
      errors: [],
      startedAt: 0,
      totalTokensUsed: 0,
      // Initialize collaboration state
      blackboard: null,
      artifacts: [],
      events: [],
      pendingMergeRequests: [],
    };
  }

  /**
   * Start workflow execution
   */
  async execute(): Promise<ExecutionState> {
    // Validate workflow
    const validation = validateWorkflow(this.workflow);
    if (!validation.valid) {
      this.state.status = 'failed';
      this.state.errors = validation.errors.map(e => ({
        blockId: '',
        error: e,
        timestamp: Date.now(),
      }));
      return this.state;
    }

    this.state.status = 'running';
    this.state.startedAt = Date.now();
    this.options.onStatusChange?.('running');

    // Get execution order
    const order = getExecutionOrder(this.workflow);
    const totalBlocks = order.length;

    try {
      for (let i = 0; i < order.length; i++) {
        if (this.abortController.signal.aborted) {
          this.state.status = 'paused';
          this.options.onStatusChange?.('paused');
          return this.state;
        }

        const blockId = order[i];
        const block = this.workflow.blocks.find(b => b.id === blockId)!;

        // Skip if already completed (for resume scenarios)
        if (this.state.completedBlocks.has(blockId)) {
          continue;
        }

        // Check if all dependencies are satisfied
        const incoming = getIncomingConnections(this.workflow, blockId);
        const dependenciesMet = incoming.every(c =>
          this.state.completedBlocks.has(c.sourceBlockId)
        );

        if (!dependenciesMet) {
          // This shouldn't happen with proper topological sort
          console.warn(`Block ${blockId} dependencies not met, skipping`);
          continue;
        }

        // Execute block
        await this.executeBlock(block);

        // Update progress
        this.options.onProgress?.(i + 1, totalBlocks);
      }

      this.state.status = 'completed';
      this.options.onStatusChange?.('completed');
    } catch (error) {
      this.state.status = 'failed';
      this.options.onStatusChange?.('failed');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.state.errors.push({
        blockId: this.state.currentBlockId || '',
        error: errorMessage,
        timestamp: Date.now(),
      });
    }

    return this.state;
  }

  /**
   * Execute a single block
   */
  private async executeBlock(block: WorkflowBlock): Promise<void> {
    this.state.currentBlockId = block.id;
    this.state.pendingBlocks.delete(block.id);
    this.options.onBlockStart?.(block.id);

    // Update block status in workflow
    this.updateBlockStatus(block.id, 'running');

    try {
      // Collect input from connected blocks
      const input = collectBlockInput(
        this.workflow,
        block.id,
        this.state.blockOutputs
      );

      // Create execution context
      const context: BlockExecutionContext = {
        workflowId: this.workflow.id,
        blockId: block.id,
        globalMemory: this.workflow.globalMemory,
        blockMemory: block.memory,
        agentSession: block.agentSession,
        apiKeys: this.options.apiKeys,
        abortSignal: this.abortController.signal,
        updateStatus: (status) => this.updateBlockStatus(block.id, status),
        updateMemory: async (memory) => {
          block.memory = memory;
          await storage.saveBlockMemory(this.workflow.id, block.id, memory);
        },
        updateGlobalMemory: (key, value) => {
          this.workflow.globalMemory[key] = value;
        },
        appendMessage: (role, content, metadata) => {
          if (!block.agentSession) {
            block.agentSession = {
              messages: [],
              systemPrompt: '',
              modelId: (block.config.modelId as string) || 'gpt-4o',
              temperature: (block.config.temperature as number) || 0.7,
              maxTokens: (block.config.maxTokens as number) || 4096,
              totalTokens: 0,
            };
          }
          block.agentSession.messages.push({
            role,
            content,
            timestamp: Date.now(),
          });
          // Notify UI about the message for real-time logging
          this.options.onAgentMessage?.(block.id, role, content, metadata);
        },
        setCurrentAction: (action) => {
          // Notify UI about what the agent is currently doing
          this.options.onAgentAction?.(block.id, action);
        },
        log: (message, data) => {
          storage.addLog({
            workflowId: this.workflow.id,
            blockId: block.id,
            eventType: 'output',
            eventData: { message, data },
            timestamp: Date.now(),
          });
        },
      };

      // Execute the block
      const result = await executeBlock(block, input, context);

      // Update block state
      block.lastInput = input;
      block.lastOutput = result.output;
      block.executionCount++;

      if (result.tokensUsed) {
        block.totalTokensUsed += result.tokensUsed;
        this.state.totalTokensUsed += result.tokensUsed;
      }

      if (result.success) {
        this.updateBlockStatus(block.id, 'completed');
        this.state.completedBlocks.add(block.id);
        this.state.blockOutputs.set(block.id, result.output);
        this.options.onBlockComplete?.(block.id, result);
      } else {
        block.lastError = result.error;
        this.updateBlockStatus(block.id, 'failed');
        this.options.onBlockError?.(block.id, result.error || 'Unknown error');
        throw new Error(result.error || 'Block execution failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      block.lastError = errorMessage;
      this.updateBlockStatus(block.id, 'failed');

      this.state.errors.push({
        blockId: block.id,
        error: errorMessage,
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Update a block's status
   */
  private updateBlockStatus(blockId: string, status: BlockStatus): void {
    const block = this.workflow.blocks.find(b => b.id === blockId);
    if (block) {
      block.status = status;
    }
  }

  /**
   * Pause execution
   */
  pause(): void {
    this.abortController.abort();
    this.state.status = 'paused';
    this.options.onStatusChange?.('paused');
  }

  /**
   * Resume execution from paused state
   */
  async resume(): Promise<ExecutionState> {
    if (this.state.status !== 'paused') {
      throw new Error('Can only resume from paused state');
    }

    this.abortController = new AbortController();
    return this.execute();
  }

  /**
   * Stop execution completely
   */
  stop(): void {
    this.abortController.abort();
    this.state.status = 'failed';
    this.options.onStatusChange?.('failed');
  }

  /**
   * Get current execution state
   */
  getState(): ExecutionState {
    return this.state;
  }
}

/**
 * Helper to create and run a workflow
 */
export async function runWorkflow(
  workflow: Workflow,
  options: ExecutionOptions
): Promise<ExecutionState> {
  const executor = new WorkflowExecutor(workflow, options);
  return executor.execute();
}
