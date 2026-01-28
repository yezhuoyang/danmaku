/**
 * Task Manager
 *
 * Manages the agent inbox/outbox system for directed work requests.
 * Agents receive tasks from their inbox and produce results to their outbox.
 */

import type {
  AgentTask,
  AgentMailbox,
  TaskStatus,
  TaskPriority,
  ArtifactType,
  WorkflowEvent,
  Artifact,
} from '@shared/types';
import { storage } from '../storage';

/**
 * Create a new task
 */
export function createTask(
  workflowId: string,
  createdBy: string,
  goal: string,
  inputArtifactIds: string[],
  outputSchema: AgentTask['outputSchema'],
  options?: {
    description?: string;
    priority?: TaskPriority;
    deadline?: number;
    assignedAgentId?: string;
    parentTaskId?: string;
  }
): AgentTask {
  const task: AgentTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    workflowId,
    goal,
    description: options?.description,
    inputArtifactIds,
    outputSchema,
    assignedAgentId: options?.assignedAgentId,
    assignedAt: options?.assignedAgentId ? Date.now() : undefined,
    status: options?.assignedAgentId ? 'assigned' : 'pending',
    priority: options?.priority || 'medium',
    createdAt: Date.now(),
    deadline: options?.deadline,
    createdBy,
    parentTaskId: options?.parentTaskId,
  };

  return task;
}

/**
 * Task Manager class for coordinating agent work
 */
export class TaskManager {
  private workflowId: string;
  private mailboxes: Map<string, AgentMailbox>;

  constructor(workflowId: string) {
    this.workflowId = workflowId;
    this.mailboxes = new Map();
  }

  /**
   * Initialize mailbox cache for an agent
   */
  private getOrCreateMailboxCache(agentId: string): AgentMailbox {
    if (!this.mailboxes.has(agentId)) {
      this.mailboxes.set(agentId, {
        agentId,
        inbox: [],
        outbox: [],
        completed: [],
      });
    }
    return this.mailboxes.get(agentId)!;
  }

  /**
   * Create and optionally assign a task
   */
  async createTask(
    createdBy: string,
    goal: string,
    inputArtifactIds: string[],
    outputSchema: AgentTask['outputSchema'],
    options?: {
      description?: string;
      priority?: TaskPriority;
      deadline?: number;
      assignedAgentId?: string;
      parentTaskId?: string;
    }
  ): Promise<AgentTask> {
    const task = createTask(
      this.workflowId,
      createdBy,
      goal,
      inputArtifactIds,
      outputSchema,
      options
    );

    // Save task to storage
    await storage.saveTask(task);

    // Add to creator's outbox
    const creatorMailbox = this.getOrCreateMailboxCache(createdBy);
    creatorMailbox.outbox.push(task);

    // Add to assignee's inbox if assigned
    if (options?.assignedAgentId) {
      const assigneeMailbox = this.getOrCreateMailboxCache(options.assignedAgentId);
      assigneeMailbox.inbox.push(task);
    }

    // Log event
    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'task_created',
      agentId: createdBy,
      data: {
        taskId: task.id,
        goal: task.goal,
        assignedTo: options?.assignedAgentId,
        priority: task.priority,
      },
      inputs: inputArtifactIds,
      outputs: [],
    });

    return task;
  }

  /**
   * Assign a pending task to an agent
   */
  async assignTask(taskId: string, agentId: string): Promise<AgentTask> {
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status !== 'pending') {
      throw new Error(`Task ${taskId} is not pending (status: ${task.status})`);
    }

    const updatedTask: AgentTask = {
      ...task,
      assignedAgentId: agentId,
      assignedAt: Date.now(),
      status: 'assigned',
    };

    await storage.saveTask(updatedTask);

    // Add to agent's inbox
    const mailbox = this.getOrCreateMailboxCache(agentId);
    mailbox.inbox.push(updatedTask);

    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'task_started',
      agentId,
      data: { taskId, assignedBy: 'supervisor' },
      inputs: task.inputArtifactIds,
      outputs: [],
    });

    return updatedTask;
  }

  /**
   * Mark task as in progress
   */
  async startTask(taskId: string): Promise<AgentTask> {
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask: AgentTask = {
      ...task,
      status: 'in_progress',
      startedAt: Date.now(),
    };

    await storage.saveTask(updatedTask);
    return updatedTask;
  }

  /**
   * Complete a task with results
   */
  async completeTask(
    taskId: string,
    outputArtifactIds: string[],
    success: boolean = true,
    error?: string
  ): Promise<AgentTask> {
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask: AgentTask = {
      ...task,
      status: success ? 'completed' : 'failed',
      completedAt: Date.now(),
      outputArtifactId: outputArtifactIds[0],  // Primary output
      result: {
        success,
        error,
        artifacts: outputArtifactIds,
      },
    };

    await storage.saveTask(updatedTask);

    // Move from inbox to completed
    if (task.assignedAgentId) {
      const mailbox = this.getOrCreateMailboxCache(task.assignedAgentId);
      mailbox.inbox = mailbox.inbox.filter(t => t.id !== taskId);
      mailbox.completed.push(updatedTask);
    }

    // Log event
    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: success ? 'task_completed' : 'task_failed',
      agentId: task.assignedAgentId,
      data: {
        taskId,
        success,
        error,
        duration: updatedTask.completedAt! - (task.startedAt || task.assignedAt || task.createdAt),
      },
      inputs: task.inputArtifactIds,
      outputs: outputArtifactIds,
    });

    return updatedTask;
  }

  /**
   * Get pending tasks for assignment
   */
  async getPendingTasks(): Promise<AgentTask[]> {
    const tasks = await storage.getPendingTasks(this.workflowId);
    return tasks.filter(t => t.status === 'pending').sort((a, b) => {
      // Sort by priority then by creation time
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Get inbox for an agent
   */
  async getInbox(agentId: string): Promise<AgentTask[]> {
    const tasks = await storage.getTasksForAgent(agentId);
    return tasks
      .filter(t => t.status === 'assigned' || t.status === 'in_progress')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Get outbox for an agent (tasks they created)
   */
  async getOutbox(agentId: string): Promise<AgentTask[]> {
    const tasks = await storage.getTasksByWorkflow(this.workflowId);
    return tasks.filter(t => t.createdBy === agentId);
  }

  /**
   * Get completed tasks for an agent
   */
  async getCompleted(agentId: string): Promise<AgentTask[]> {
    const tasks = await storage.getTasksForAgent(agentId);
    return tasks
      .filter(t => t.status === 'completed' || t.status === 'failed')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      .slice(0, 10);  // Last 10 completed
  }

  /**
   * Get full mailbox for an agent
   */
  async getMailbox(agentId: string): Promise<AgentMailbox> {
    const [inbox, outbox, completed] = await Promise.all([
      this.getInbox(agentId),
      this.getOutbox(agentId),
      this.getCompleted(agentId),
    ]);

    return {
      agentId,
      inbox,
      outbox,
      completed,
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string, reason?: string): Promise<AgentTask> {
    const task = await storage.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const updatedTask: AgentTask = {
      ...task,
      status: 'cancelled',
      completedAt: Date.now(),
      result: {
        success: false,
        error: reason || 'Task cancelled',
        artifacts: [],
      },
    };

    await storage.saveTask(updatedTask);

    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'task_failed',
      data: { taskId, reason: 'cancelled', cancelReason: reason },
      inputs: [],
      outputs: [],
    });

    return updatedTask;
  }

  /**
   * Create a sub-task from a parent task
   */
  async createSubTask(
    parentTaskId: string,
    goal: string,
    inputArtifactIds: string[],
    outputSchema: AgentTask['outputSchema'],
    assignedAgentId?: string
  ): Promise<AgentTask> {
    const parentTask = await storage.getTask(parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentTaskId} not found`);
    }

    return this.createTask(
      parentTask.assignedAgentId || parentTask.createdBy,
      goal,
      inputArtifactIds,
      outputSchema,
      {
        parentTaskId,
        assignedAgentId,
        priority: parentTask.priority,
      }
    );
  }

  /**
   * Get all sub-tasks of a task
   */
  async getSubTasks(taskId: string): Promise<AgentTask[]> {
    const tasks = await storage.getTasksByWorkflow(this.workflowId);
    return tasks.filter(t => t.parentTaskId === taskId);
  }

  /**
   * Get task statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    byPriority: Record<TaskPriority, number>;
    byAgent: Record<string, number>;
  }> {
    const tasks = await storage.getTasksByWorkflow(this.workflowId);

    const stats = {
      total: tasks.length,
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      byPriority: { low: 0, medium: 0, high: 0, critical: 0 } as Record<TaskPriority, number>,
      byAgent: {} as Record<string, number>,
    };

    for (const task of tasks) {
      switch (task.status) {
        case 'pending':
        case 'assigned':
          stats.pending++;
          break;
        case 'in_progress':
          stats.inProgress++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
        case 'cancelled':
          stats.failed++;
          break;
      }

      stats.byPriority[task.priority]++;

      if (task.assignedAgentId) {
        stats.byAgent[task.assignedAgentId] = (stats.byAgent[task.assignedAgentId] || 0) + 1;
      }
    }

    return stats;
  }
}

/**
 * Predefined task templates for common agent workflows
 */
export const TaskTemplates = {
  /**
   * Research task template
   */
  research: (
    workflowId: string,
    query: string,
    sourceArtifactIds: string[] = []
  ): Omit<AgentTask, 'id' | 'createdAt'> => ({
    workflowId,
    goal: `Research: ${query}`,
    description: `Analyze sources and extract relevant information about: ${query}`,
    inputArtifactIds: sourceArtifactIds,
    inputContext: { query },
    outputSchema: {
      artifactType: 'note',
      requiredFields: ['claims', 'openQuestions', 'recommendedNextSteps'],
    },
    status: 'pending',
    priority: 'medium',
    createdBy: 'supervisor',
  }),

  /**
   * Experiment design task template
   */
  designExperiment: (
    workflowId: string,
    hypothesisId: string,
    constraintArtifactIds: string[] = []
  ): Omit<AgentTask, 'id' | 'createdAt'> => ({
    workflowId,
    goal: `Design experiment for hypothesis ${hypothesisId}`,
    description: 'Create a detailed experiment specification with metrics and stopping rules',
    inputArtifactIds: [hypothesisId, ...constraintArtifactIds],
    outputSchema: {
      artifactType: 'experiment_spec',
      requiredFields: ['variables', 'metrics', 'stoppingRule', 'protocol'],
    },
    status: 'pending',
    priority: 'high',
    createdBy: 'supervisor',
  }),

  /**
   * Verification task template
   */
  verify: (
    workflowId: string,
    runArtifactId: string,
    experimentSpecId: string
  ): Omit<AgentTask, 'id' | 'createdAt'> => ({
    workflowId,
    goal: `Verify run ${runArtifactId}`,
    description: 'Verify experimental results and check for reproducibility',
    inputArtifactIds: [runArtifactId, experimentSpecId],
    outputSchema: {
      artifactType: 'decision',
      requiredFields: ['passed', 'issues', 'recommendations'],
    },
    status: 'pending',
    priority: 'high',
    createdBy: 'supervisor',
  }),

  /**
   * Writing task template
   */
  write: (
    workflowId: string,
    section: string,
    inputArtifactIds: string[]
  ): Omit<AgentTask, 'id' | 'createdAt'> => ({
    workflowId,
    goal: `Write ${section} section`,
    description: `Draft the ${section} section based on verified claims and results`,
    inputArtifactIds,
    outputSchema: {
      artifactType: 'draft',
      requiredFields: ['content', 'citations'],
    },
    status: 'pending',
    priority: 'medium',
    createdBy: 'supervisor',
  }),

  /**
   * Review task template
   */
  review: (
    workflowId: string,
    draftArtifactId: string
  ): Omit<AgentTask, 'id' | 'createdAt'> => ({
    workflowId,
    goal: `Review draft ${draftArtifactId}`,
    description: 'Review the draft for accuracy, clarity, and citation validity',
    inputArtifactIds: [draftArtifactId],
    outputSchema: {
      artifactType: 'decision',
      requiredFields: ['overallAssessment', 'issues', 'suggestions'],
    },
    status: 'pending',
    priority: 'medium',
    createdBy: 'supervisor',
  }),
};
