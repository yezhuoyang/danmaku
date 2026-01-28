/**
 * Context Assembler
 *
 * Assembles the context packet that will be sent to an agent.
 * Implements tiered context (global, task, agent-local, long-term).
 */

import type {
  ContextPacket,
  ContextTier,
  Artifact,
  ArtifactType,
  Blackboard,
  AgentTask,
  DecisionArtifactContent,
  BlackboardClaim,
  BlackboardQuestion,
  WorkflowAgentSession,
} from '@shared/types';
import { storage } from '../storage';
import { getBlackboardSummary } from './blackboard';

/**
 * Context assembly configuration
 */
export interface ContextAssemblyConfig {
  maxTokensPerTier: Record<ContextTier, number>;
  priorityWeights: Record<ArtifactType, number>;
  recencyWeight: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextAssemblyConfig = {
  maxTokensPerTier: {
    global: 2000,
    task: 4000,
    agent_local: 1000,
    long_term: 500,
  },
  priorityWeights: {
    source: 1.0,
    note: 1.2,
    hypothesis: 1.5,
    experiment_spec: 1.3,
    run: 1.1,
    draft: 1.0,
    decision: 1.4,
    code: 0.8,
    data: 0.7,
    citation: 0.9,
    constraint: 1.5,
    summary: 0.6,
  },
  recencyWeight: 0.3,
};

/**
 * Estimate token count for text (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit token budget
 */
function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars - 20) + '\n\n[... truncated]';
}

/**
 * Score an artifact for relevance
 */
function scoreArtifact(
  artifact: Artifact,
  taskArtifactIds: string[],
  config: ContextAssemblyConfig,
  now: number = Date.now()
): number {
  let score = 0;

  // Base priority by type
  score += config.priorityWeights[artifact.type] || 1.0;

  // Boost if directly referenced by task
  if (taskArtifactIds.includes(artifact.id)) {
    score += 2.0;
  }

  // Recency boost (decay over 24 hours)
  const ageHours = (now - artifact.metadata.updatedAt) / (1000 * 60 * 60);
  const recencyBoost = Math.max(0, 1 - ageHours / 24) * config.recencyWeight;
  score += recencyBoost;

  // Boost verified/merged artifacts
  if (artifact.status === 'verified' || artifact.status === 'merged') {
    score += 0.3;
  }

  return score;
}

/**
 * Assemble global context tier
 */
async function assembleGlobalContext(
  workflowId: string,
  blackboard: Blackboard,
  config: ContextAssemblyConfig
): Promise<ContextPacket['tiers']['global']> {
  // Get recent decisions
  const allArtifacts = await storage.getArtifactsByWorkflow(workflowId);
  const decisions = allArtifacts
    .filter(a => a.type === 'decision')
    .sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt)
    .slice(0, 5)
    .map(a => a.content as DecisionArtifactContent);

  return {
    blackboardSummary: truncateToTokens(
      getBlackboardSummary(blackboard),
      config.maxTokensPerTier.global * 0.6
    ),
    problemStatement: blackboard.problemStatement,
    activeConstraints: blackboard.constraints,
    recentDecisions: decisions,
  };
}

/**
 * Assemble task context tier
 */
async function assembleTaskContext(
  workflowId: string,
  task: AgentTask,
  blackboard: Blackboard,
  config: ContextAssemblyConfig
): Promise<ContextPacket['tiers']['task']> {
  // Get input artifacts
  const inputArtifacts = await Promise.all(
    task.inputArtifactIds.map(id => storage.getArtifact(id))
  );
  const validArtifacts = inputArtifacts.filter((a): a is Artifact => a !== undefined);

  // Get related claims (those that cite our input artifacts)
  const relevantClaims = blackboard.claims.filter(claim =>
    claim.sourceArtifactIds.some(id => task.inputArtifactIds.includes(id))
  );

  // Get related questions
  const relevantQuestions = blackboard.openQuestions.filter(q =>
    q.relatedArtifactIds.some(id => task.inputArtifactIds.includes(id)) ||
    q.status === 'open'
  ).slice(0, 5);

  return {
    taskGoal: task.goal,
    inputArtifacts: validArtifacts,
    relevantClaims,
    relevantQuestions,
  };
}

/**
 * Assemble agent-local context tier
 */
async function assembleAgentLocalContext(
  workflowId: string,
  agentId: string,
  config: ContextAssemblyConfig
): Promise<ContextPacket['tiers']['agentLocal']> {
  // Get agent's previous outputs
  const tasks = await storage.getTasksByWorkflow(workflowId);
  const completedTasks = tasks
    .filter(t => t.assignedAgentId === agentId && t.status === 'completed')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 5);

  const previousOutputs = await Promise.all(
    completedTasks.map(async t => {
      if (!t.outputArtifactId) return null;
      const artifact = await storage.getArtifact(t.outputArtifactId);
      if (!artifact) return null;
      return {
        taskId: t.id,
        outputId: t.outputArtifactId,
        summary: artifact.title,
      };
    })
  );

  // Get agent's scratchpad from block memory
  const scratchpad = await storage.getBlockMemory(workflowId, agentId) || {};

  return {
    previousOutputs: previousOutputs.filter((o): o is NonNullable<typeof o> => o !== null),
    scratchpad,
  };
}

/**
 * Assemble long-term context tier
 */
async function assembleLongTermContext(
  workflowId: string,
  agentId: string,
  config: ContextAssemblyConfig
): Promise<ContextPacket['tiers']['longTerm']> {
  // Get agent session for learned patterns
  const session = await storage.getAgentSession(workflowId, agentId);

  // Extract patterns from conversation history
  const learnedConstraints: string[] = [];
  const repeatedPatterns: string[] = [];

  if (session?.messages) {
    // Look for explicit constraints mentioned
    for (const msg of session.messages) {
      if (msg.content.toLowerCase().includes('constraint:')) {
        const match = msg.content.match(/constraint:\s*(.+?)(?:\n|$)/i);
        if (match) {
          learnedConstraints.push(match[1]);
        }
      }
    }
  }

  return {
    agentPreferences: {},  // Could be populated from agent config
    repeatedPatterns,
    learnedConstraints,
  };
}

/**
 * Main context assembly function
 */
export async function assembleContext(
  workflowId: string,
  agentId: string,
  task: AgentTask,
  config: ContextAssemblyConfig = DEFAULT_CONTEXT_CONFIG
): Promise<ContextPacket> {
  const blackboard = await storage.getBlackboard(workflowId);
  if (!blackboard) {
    throw new Error(`Blackboard not found for workflow ${workflowId}`);
  }

  // Assemble each tier
  const [globalCtx, taskCtx, agentLocalCtx, longTermCtx] = await Promise.all([
    assembleGlobalContext(workflowId, blackboard, config),
    assembleTaskContext(workflowId, task, blackboard, config),
    assembleAgentLocalContext(workflowId, agentId, config),
    assembleLongTermContext(workflowId, agentId, config),
  ]);

  // Estimate total tokens
  const globalTokens = estimateTokens(JSON.stringify(globalCtx));
  const taskTokens = estimateTokens(JSON.stringify(taskCtx));
  const agentLocalTokens = estimateTokens(JSON.stringify(agentLocalCtx));
  const longTermTokens = estimateTokens(JSON.stringify(longTermCtx));
  const totalTokens = globalTokens + taskTokens + agentLocalTokens + longTermTokens;

  const maxTokens = Object.values(config.maxTokensPerTier).reduce((a, b) => a + b, 0);

  // Log context assembly event
  await storage.addEvent({
    workflowId,
    timestamp: Date.now(),
    eventType: 'context_assembled',
    agentId,
    data: {
      taskId: task.id,
      tokensByTier: {
        global: globalTokens,
        task: taskTokens,
        agent_local: agentLocalTokens,
        long_term: longTermTokens,
      },
      totalTokens,
      truncated: totalTokens > maxTokens,
    },
    inputs: task.inputArtifactIds,
    outputs: [],
  });

  return {
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    assembledFor: agentId,
    assembledAt: Date.now(),
    tiers: {
      global: globalCtx,
      task: taskCtx,
      agentLocal: agentLocalCtx,
      longTerm: longTermCtx,
    },
    estimatedTokens: totalTokens,
    maxTokens,
    truncated: totalTokens > maxTokens,
  };
}

/**
 * Format context packet into a prompt string
 */
export function formatContextForPrompt(context: ContextPacket): string {
  const parts: string[] = [];

  // Global context
  parts.push('# WORKSPACE STATE');
  parts.push(`## Problem Statement\n${context.tiers.global.problemStatement || '(Not defined)'}`);
  if (context.tiers.global.activeConstraints.length > 0) {
    parts.push(`## Constraints\n${context.tiers.global.activeConstraints.map(c => `- ${c}`).join('\n')}`);
  }
  parts.push(`## Blackboard Summary\n${context.tiers.global.blackboardSummary}`);

  if (context.tiers.global.recentDecisions.length > 0) {
    parts.push('## Recent Decisions');
    for (const decision of context.tiers.global.recentDecisions.slice(0, 3)) {
      parts.push(`- ${decision.decisionType}: ${decision.rationale.slice(0, 100)}...`);
    }
  }

  // Task context
  parts.push('\n# CURRENT TASK');
  parts.push(`Goal: ${context.tiers.task.taskGoal}`);

  if (context.tiers.task.inputArtifacts.length > 0) {
    parts.push('\n## Input Artifacts');
    for (const artifact of context.tiers.task.inputArtifacts) {
      parts.push(`### ${artifact.title} (${artifact.type})`);
      const contentStr = typeof artifact.content === 'string'
        ? artifact.content
        : JSON.stringify(artifact.content, null, 2);
      parts.push(contentStr.slice(0, 1000) + (contentStr.length > 1000 ? '...' : ''));
    }
  }

  if (context.tiers.task.relevantClaims.length > 0) {
    parts.push('\n## Relevant Claims');
    for (const claim of context.tiers.task.relevantClaims) {
      const status = claim.status === 'verified' ? '✓' : '?';
      parts.push(`- [${status}] ${claim.text} (confidence: ${(claim.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (context.tiers.task.relevantQuestions.length > 0) {
    parts.push('\n## Open Questions');
    for (const q of context.tiers.task.relevantQuestions) {
      parts.push(`- [${q.priority}] ${q.text}`);
    }
  }

  // Agent local context
  if (context.tiers.agentLocal.previousOutputs.length > 0) {
    parts.push('\n# YOUR PREVIOUS OUTPUTS');
    for (const output of context.tiers.agentLocal.previousOutputs) {
      parts.push(`- ${output.summary}`);
    }
  }

  // Long-term context
  if (context.tiers.longTerm.learnedConstraints.length > 0) {
    parts.push('\n# LEARNED CONSTRAINTS');
    for (const constraint of context.tiers.longTerm.learnedConstraints) {
      parts.push(`- ${constraint}`);
    }
  }

  return parts.join('\n');
}

/**
 * Create a minimal context for quick operations
 */
export async function assembleMinimalContext(
  workflowId: string,
  agentId: string
): Promise<{
  problemStatement: string;
  constraints: string[];
  recentClaims: BlackboardClaim[];
}> {
  const blackboard = await storage.getBlackboard(workflowId);
  if (!blackboard) {
    return {
      problemStatement: '',
      constraints: [],
      recentClaims: [],
    };
  }

  return {
    problemStatement: blackboard.problemStatement,
    constraints: blackboard.constraints,
    recentClaims: blackboard.claims
      .filter(c => c.status === 'verified')
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 5),
  };
}
