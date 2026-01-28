/**
 * Agentic Politics - Political Workflow Executor
 *
 * Executes workflows in political mode where:
 * - Commands flow from superiors to subordinates
 * - Reports flow back up the chain
 * - Permissions are strictly enforced
 * - Violations halt execution
 */

import type {
  PoliticalWorkflow,
  PoliticalAgentBlock,
  PoliticalExecutionState,
  PoliticalExecutionOptions,
  Command,
  Report,
  PermissionViolation,
  BlockExecutionContext,
  BlockExecutionResult,
  AgentRole,
  PrivateMemoryLog,
  PublicMemoryLog,
} from '@shared/types';
import { ROLE_DEFINITIONS, getRoleSystemPrompt } from './roles';
import {
  checkCommandPermission,
  checkResourcePermission,
  validateCommand,
  shouldHaltExecution,
  formatViolation,
} from './permissions';
import {
  createCommand,
  createReport,
  updateCommandStatus,
  createCommandChainFromUser,
  addToCommandChain,
  resolveCommandInChain,
  CommandChain,
  CommandFlowState,
  createCommandFlowState,
  addCommandToFlowState,
  addReportToFlowState,
} from './command-flow';
import { callAI } from '../execution/ai-client';
import { storage } from '../storage';

/**
 * Extract Python code blocks from markdown text.
 * Looks for ```python ... ``` or ```py ... ``` blocks.
 */
function extractPythonCode(text: string): string[] {
  const codeBlocks: string[] = [];
  const regex = /```(?:python|py)\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    codeBlocks.push(match[1].trim());
  }
  return codeBlocks;
}

/**
 * Execute Python code via the backend API.
 */
async function executePythonCode(
  code: string,
  timeout: number = 30000
): Promise<{ success: boolean; stdout: string; stderr: string; returnCode: number; executionTime: number }> {
  try {
    const response = await fetch('/api/agent-lego/python/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, timeout }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        stdout: '',
        stderr: `API Error: ${response.status} - ${errorText}`,
        returnCode: -1,
        executionTime: 0,
      };
    }

    const result = await response.json();
    return {
      success: result.success && result.returnCode === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      returnCode: result.returnCode ?? -1,
      executionTime: result.executionTime || 0,
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: `Execution Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      returnCode: -1,
      executionTime: 0,
    };
  }
}

/**
 * Political Workflow Executor
 *
 * Manages the execution of a workflow in political mode,
 * enforcing the hierarchical command structure and permissions.
 */
export class PoliticalWorkflowExecutor {
  private workflow: PoliticalWorkflow;
  private options: PoliticalExecutionOptions;
  private state: PoliticalExecutionState;
  private flowState: CommandFlowState;
  private abortController: AbortController;
  private blocksById: Map<string, PoliticalAgentBlock>;

  constructor(
    workflow: PoliticalWorkflow,
    options: PoliticalExecutionOptions
  ) {
    this.workflow = workflow;
    this.options = options;
    this.abortController = new AbortController();
    this.flowState = createCommandFlowState();

    // Index blocks by ID for quick lookup
    this.blocksById = new Map();
    for (const block of workflow.politicalBlocks) {
      this.blocksById.set(block.id, block);
    }

    // Initialize execution state
    this.state = {
      workflowId: workflow.id,
      status: 'idle',
      rootCommanderId: workflow.rootCommanderId,
      currentCommandChain: [],
      activeReports: [],
      violations: [],
      startedAt: 0,
      totalTokensUsed: 0,
      commandsIssued: 0,
      reportsReceived: 0,
    };
  }

  /**
   * Find the root commander block.
   */
  private findRootCommander(): PoliticalAgentBlock | null {
    return this.blocksById.get(this.workflow.rootCommanderId) || null;
  }

  // ============================================================================
  // MEMORY LOG METHODS
  // ============================================================================

  /**
   * Initialize memory logs for all agents at workflow start.
   */
  private async initializeMemoryLogs(): Promise<void> {
    // Create public memory log with user instruction as main goal
    let publicLog = await storage.getPublicMemoryLog(this.workflow.id);
    if (!publicLog) {
      publicLog = await storage.createPublicMemoryLog(
        this.workflow.id,
        this.options.userInstruction
      );
    } else {
      // Update main goal
      await storage.updatePublicMemoryGoal(
        this.workflow.id,
        this.options.userInstruction
      );
    }

    // Add role reminders for all agents
    for (const block of this.workflow.politicalBlocks) {
      const roleDef = ROLE_DEFINITIONS[block.role];
      await storage.addRoleReminder(
        this.workflow.id,
        block.role,
        `${roleDef.name}: ${roleDef.description}`
      );

      // Initialize private memory log for each agent
      let privateLog = await storage.getPrivateMemoryLog(this.workflow.id, block.id);
      if (!privateLog) {
        privateLog = await storage.createPrivateMemoryLog(
          this.workflow.id,
          block.id,
          {
            skills: roleDef.permissions.resources.map(r => r.replace('_', ' ')),
            values: ['accuracy', 'helpfulness', 'following instructions'],
            goals: [`Serve the ${block.role} role effectively`, 'Report to superiors accurately'],
            constraints: roleDef.permissions.resources.length > 0
              ? [`Can only access: ${roleDef.permissions.resources.join(', ')}`]
              : ['No special resource access'],
          }
        );
      }
    }

    // Add workflow start as first public milestone
    await storage.addMilestone(
      this.workflow.id,
      'Workflow Started',
      `User instruction received: "${this.options.userInstruction.substring(0, 100)}..."`,
      'achieved'
    );

    this.options.onAgentAction?.(this.workflow.rootCommanderId, 'Memory logs initialized');
  }

  /**
   * Get an agent's private memory context for prompting.
   * This is read when context switches to this agent.
   */
  private async getAgentMemoryContext(agentId: string): Promise<string> {
    const privateLog = await storage.getPrivateMemoryLog(this.workflow.id, agentId);
    if (!privateLog) return '';

    const identity = privateLog.identity;
    const recentEntries = privateLog.entries.slice(-5); // Last 5 entries

    let context = `
=== YOUR IDENTITY (from your private memory) ===
Skills: ${identity.skills.join(', ') || 'None specified'}
Values: ${identity.values.join(', ') || 'None specified'}
Goals: ${identity.goals.join(', ') || 'None specified'}
Constraints: ${identity.constraints.join(', ') || 'None specified'}
Current Status: ${privateLog.currentStatus}
${privateLog.currentTask ? `Current Task: ${privateLog.currentTask}` : ''}
`;

    if (recentEntries.length > 0) {
      context += `
=== YOUR RECENT PROGRESS LOG ===
${recentEntries.map(e =>
  `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type.toUpperCase()}: ${e.purpose}
   Action: ${e.action}
   ${e.result ? `Result: ${e.result}` : ''}
   ${e.currentProblem ? `Problem: ${e.currentProblem}` : ''}`
).join('\n')}
`;
    }

    return context;
  }

  /**
   * Get the public memory context visible to all agents.
   */
  private async getPublicMemoryContext(): Promise<string> {
    const publicLog = await storage.getPublicMemoryLog(this.workflow.id);
    if (!publicLog) return '';

    const activeMilestones = publicLog.milestones.filter(m => m.status !== 'achieved').slice(0, 3);
    const achievedMilestones = publicLog.milestones.filter(m => m.status === 'achieved').slice(-3);
    const unresolvedProblems = publicLog.activeProblems.filter(p => !p.resolvedAt);
    const recentEntries = publicLog.entries.slice(-3);

    let context = `
=== SHARED TEAM MEMORY (visible to all agents) ===
MAIN GOAL: ${publicLog.mainGoal}
${publicLog.subGoals.length > 0 ? `Sub-goals: ${publicLog.subGoals.join(', ')}` : ''}
`;

    if (activeMilestones.length > 0) {
      context += `
ACTIVE MILESTONES:
${activeMilestones.map(m => `- [${m.status}] ${m.title}: ${m.description}`).join('\n')}
`;
    }

    if (achievedMilestones.length > 0) {
      context += `
RECENT ACHIEVEMENTS:
${achievedMilestones.map(m => `- ✓ ${m.title}`).join('\n')}
`;
    }

    if (unresolvedProblems.length > 0) {
      context += `
CURRENT PROBLEMS:
${unresolvedProblems.map(p => `- [${p.severity}] ${p.description} (reported by ${p.reportedBy})`).join('\n')}
`;
    }

    if (publicLog.roleReminders.length > 0) {
      context += `
TEAM ROLES:
${publicLog.roleReminders.map(r => `- ${r.role}: ${r.reminder}`).join('\n')}
`;
    }

    return context;
  }

  /**
   * Log a progress entry to an agent's private memory.
   */
  private async logAgentProgress(
    agentId: string,
    type: 'progress' | 'problem' | 'help_request' | 'reflection' | 'decision',
    purpose: string,
    action: string,
    result?: string,
    currentProblem?: string,
    needsHelp?: { fromRole: AgentRole; reason: string }
  ): Promise<void> {
    await storage.addPrivateMemoryEntry(this.workflow.id, agentId, {
      type,
      purpose,
      action,
      result,
      currentProblem,
      needsHelp,
    });
  }

  /**
   * Log to public memory.
   */
  private async logPublicProgress(
    authorAgentId: string,
    authorRole: AgentRole,
    type: 'milestone' | 'progress' | 'problem' | 'announcement' | 'role_reminder',
    title: string,
    content: string,
    importance: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await storage.addPublicMemoryEntry(this.workflow.id, {
      type,
      authorAgentId,
      authorRole,
      title,
      content,
      importance,
    });
  }

  /**
   * Record a violation and optionally halt execution.
   */
  private recordViolation(violation: PermissionViolation): void {
    this.state.violations.push(violation);
    this.workflow.violations.push(violation);
    this.options.onViolation?.(violation);

    storage.addLog({
      workflowId: this.workflow.id,
      blockId: violation.violatingAgentId,
      eventType: 'error',
      eventData: {
        type: 'permission_violation',
        violation,
        formatted: formatViolation(violation),
      },
      timestamp: Date.now(),
    });

    if (this.options.haltOnViolation !== false && shouldHaltExecution([violation])) {
      this.state.status = 'violation_halt';
      this.options.onStatusChange?.('violation_halt');
      throw new Error(`Execution halted due to violation: ${formatViolation(violation)}`);
    }
  }

  /**
   * Update an agent's political status.
   */
  private updateAgentStatus(
    agentId: string,
    status: PoliticalAgentBlock['politicalStatus']
  ): void {
    const block = this.blocksById.get(agentId);
    if (block) {
      block.politicalStatus = status;
      this.options.onAgentStatusChange?.(agentId, status);
    }
  }

  /**
   * Execute a command by having the subordinate perform the task.
   */
  private async executeCommand(
    command: Command,
    subordinate: PoliticalAgentBlock
  ): Promise<Report> {
    // Update command status
    const acknowledgedCommand = updateCommandStatus(command, 'acknowledged');
    subordinate.activeCommand = acknowledgedCommand;
    subordinate.pendingCommands = subordinate.pendingCommands.filter(c => c.id !== command.id);
    this.updateAgentStatus(subordinate.id, 'executing');

    this.options.onAgentAction?.(subordinate.id, `Executing: ${command.instruction.substring(0, 50)}...`);

    // Update private memory status
    await storage.updatePrivateMemoryStatus(this.workflow.id, subordinate.id, 'working', command.instruction.substring(0, 100));

    // Get the role's system prompt
    const roleSystemPrompt = getRoleSystemPrompt(subordinate.role);
    const roleDef = ROLE_DEFINITIONS[subordinate.role];

    // Get memory context for this agent
    const privateMemoryContext = await this.getAgentMemoryContext(subordinate.id);
    const publicMemoryContext = await this.getPublicMemoryContext();

    // Build the execution prompt with memory context
    const executionPrompt = `${roleSystemPrompt}
${privateMemoryContext}
${publicMemoryContext}

CURRENT COMMAND:
From: ${command.fromRole} (${command.fromAgentId})
Type: ${command.type}
Priority: ${command.priority}
Instruction: ${command.instruction}
${command.context ? `Context: ${command.context}` : ''}
${command.constraints ? `Constraints:\n${command.constraints.map(c => `- ${c}`).join('\n')}` : ''}

Your task is to execute this command within your role's permissions.
Remember:
- You can ONLY access: ${roleDef.permissions.resources.join(', ') || 'nothing'}
- You can ONLY perform actions: ${roleDef.permissions.actions.join(', ') || 'none'}

After completing the task, provide a clear summary of what you accomplished.
If you encounter problems or need help from other agents, clearly state this in your response.`;

    // Log the system message
    this.options.onAgentMessage?.(
      subordinate.id,
      'system',
      executionPrompt,
      { model: (subordinate.config.modelId as string) || 'gpt-4o' }
    );

    // Log the user message (the command)
    this.options.onAgentMessage?.(
      subordinate.id,
      'user',
      command.instruction
    );

    try {
      // Check if execution was stopped
      if (this.abortController.signal.aborted) {
        throw new Error('Execution stopped by user');
      }

      // Call the AI to execute the command
      const startTime = Date.now();
      const aiResponse = await callAI({
        messages: [
          { role: 'system', content: executionPrompt },
          { role: 'user', content: command.instruction },
        ],
        modelId: (subordinate.config.modelId as string) || 'gpt-4o',
        temperature: (subordinate.config.temperature as number) || 0.7,
        maxTokens: (subordinate.config.maxTokens as number) || 4096,
        apiKeys: this.options.apiKeys,
      });
      const duration = Date.now() - startTime;

      // Log the assistant response
      this.options.onAgentMessage?.(
        subordinate.id,
        'assistant',
        aiResponse.content,
        {
          model: aiResponse.modelId,
          tokens: aiResponse.tokensUsed,
          duration,
        }
      );

      // Update token usage
      const tokensUsed = aiResponse.tokensUsed || 0;
      subordinate.totalTokensUsed += tokensUsed;
      this.state.totalTokensUsed += tokensUsed;

      // For coder role: extract and execute Python code
      let finalResponseContent = aiResponse.content;
      let codeExecutionFailed = false;
      let codeExecutionError = '';

      if (subordinate.role === 'coder') {
        const codeBlocks = extractPythonCode(aiResponse.content);
        if (codeBlocks.length > 0) {
          this.options.onAgentAction?.(subordinate.id, `Executing ${codeBlocks.length} Python code block(s)...`);

          // Execute each code block and collect results
          const executionResults: string[] = [];
          for (let i = 0; i < codeBlocks.length; i++) {
            const code = codeBlocks[i];
            this.options.onAgentMessage?.(
              subordinate.id,
              'system',
              `Executing code block ${i + 1}/${codeBlocks.length}...`
            );

            const execResult = await executePythonCode(code, 30000);

            // Notify via callback
            this.options.onCodeExecuted?.(subordinate.id, code, {
              success: execResult.success,
              stdout: execResult.stdout,
              stderr: execResult.stderr,
              executionTime: execResult.executionTime,
            });

            // Track if any code execution failed
            if (!execResult.success) {
              codeExecutionFailed = true;
              codeExecutionError = execResult.stderr || 'Code execution failed';
            }

            // Format execution result
            let resultStr = `\n\n### Code Execution Result (Block ${i + 1}):\n`;
            if (execResult.success) {
              resultStr += `**Status:** Success (${execResult.executionTime}ms)\n`;
              if (execResult.stdout) {
                resultStr += `**Output:**\n\`\`\`\n${execResult.stdout}\n\`\`\`\n`;
              } else {
                resultStr += `**Output:** (no output)\n`;
              }
            } else {
              resultStr += `**Status:** FAILED\n`;
              if (execResult.stderr) {
                resultStr += `**Error:**\n\`\`\`\n${execResult.stderr}\n\`\`\`\n`;
              }
              if (execResult.stdout) {
                resultStr += `**Partial Output:**\n\`\`\`\n${execResult.stdout}\n\`\`\`\n`;
              }
            }
            executionResults.push(resultStr);

            // Log execution result
            this.options.onAgentMessage?.(
              subordinate.id,
              'system',
              execResult.success
                ? `Code execution successful (${execResult.executionTime}ms)`
                : `Code execution failed: ${execResult.stderr.substring(0, 200)}`,
              { duration: execResult.executionTime }
            );
          }

          // Append execution results to the response
          finalResponseContent = aiResponse.content + executionResults.join('\n');

          // If code execution failed, add clear failure notice
          if (codeExecutionFailed) {
            finalResponseContent += '\n\n**[EXECUTION STATUS: FAILED]** One or more code blocks failed to execute successfully.';
          } else {
            finalResponseContent += '\n\n**[EXECUTION STATUS: SUCCESS]** All code blocks executed successfully.';
          }
        }
      }

      // Update command status
      subordinate.activeCommand = updateCommandStatus(
        acknowledgedCommand,
        codeExecutionFailed ? 'failed' : 'completed'
      );
      subordinate.commandHistory.push(subordinate.activeCommand);

      // Find the superior to report to
      const superior = subordinate.superiorId
        ? this.blocksById.get(subordinate.superiorId)
        : null;

      // Create the report with appropriate status based on code execution
      // For coder: if code execution failed, report status is 'failed'
      // For other roles: report status is 'success' (LLM call succeeded)
      const reportStatus = codeExecutionFailed ? 'failed' : 'success';

      const report = createReport(
        subordinate,
        superior || subordinate,  // If no superior, report to self (should not happen)
        subordinate.activeCommand,
        {
          status: reportStatus,
          summary: finalResponseContent,
          output: finalResponseContent,
          tokensUsed,
        }
      );

      subordinate.reportHistory.push(report);
      this.state.activeReports.push(report);
      this.state.reportsReceived++;
      this.updateAgentStatus(subordinate.id, 'idle');

      // Log progress to private memory
      await this.logAgentProgress(
        subordinate.id,
        'progress',
        command.instruction.substring(0, 50),
        'Completed task and reported to superior',
        aiResponse.content.substring(0, 200),
        undefined
      );

      // Update private memory status
      await storage.updatePrivateMemoryStatus(this.workflow.id, subordinate.id, 'idle', undefined);

      // Log to public memory if significant
      await this.logPublicProgress(
        subordinate.id,
        subordinate.role,
        'progress',
        `${subordinate.name} completed task`,
        `Completed: ${command.instruction.substring(0, 100)}...`,
        'low'
      );

      this.options.onReportReceived?.(report);

      return report;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update command status to failed
      subordinate.activeCommand = updateCommandStatus(acknowledgedCommand, 'failed');
      subordinate.commandHistory.push(subordinate.activeCommand);

      // Log failure to private memory
      await this.logAgentProgress(
        subordinate.id,
        'problem',
        command.instruction.substring(0, 50),
        'Task failed',
        undefined,
        errorMessage
      );

      // Report problem to public memory
      await storage.reportProblem(
        this.workflow.id,
        subordinate.role,
        `${subordinate.name} failed: ${errorMessage}`,
        'high'
      );

      // Update private memory status
      await storage.updatePrivateMemoryStatus(this.workflow.id, subordinate.id, 'blocked', errorMessage);

      // Log the error
      this.options.onAgentMessage?.(
        subordinate.id,
        'system',
        `Error: ${errorMessage}`
      );

      // Find the superior to report to
      const superior = subordinate.superiorId
        ? this.blocksById.get(subordinate.superiorId)
        : null;

      // Create a failure report
      const report = createReport(
        subordinate,
        superior || subordinate,
        subordinate.activeCommand,
        {
          status: 'failed',
          summary: `Execution failed: ${errorMessage}`,
        }
      );

      subordinate.reportHistory.push(report);
      this.state.activeReports.push(report);
      this.state.reportsReceived++;
      this.updateAgentStatus(subordinate.id, 'idle');

      this.options.onReportReceived?.(report);

      return report;
    }
  }

  /**
   * Issue a command from a superior to a subordinate.
   */
  private async issueCommand(
    superior: PoliticalAgentBlock,
    subordinate: PoliticalAgentBlock,
    instruction: string,
    options: {
      type?: Command['type'];
      context?: string;
      constraints?: string[];
      priority?: Command['priority'];
    } = {}
  ): Promise<Report> {
    // Check command permission
    const violation = checkCommandPermission(superior, subordinate);
    if (violation) {
      this.recordViolation(violation);
      throw new Error(formatViolation(violation));
    }

    // Create the command
    const command = createCommand(superior, subordinate, instruction, options);

    // Validate the command
    const commandViolation = validateCommand(command, superior, subordinate);
    if (commandViolation) {
      this.recordViolation(commandViolation);
      throw new Error(formatViolation(commandViolation));
    }

    // Add to subordinate's pending commands
    subordinate.pendingCommands.push(command);
    superior.commandHistory.push(command);
    this.workflow.commandHistory.push(command);
    this.state.currentCommandChain.push(command);
    this.state.commandsIssued++;
    this.flowState = addCommandToFlowState(this.flowState, command);

    // Update statuses
    this.updateAgentStatus(superior.id, 'waiting_for_subordinate');
    this.updateAgentStatus(subordinate.id, 'awaiting_command');

    this.options.onCommandIssued?.(command);
    this.options.onAgentAction?.(superior.id, `Issued command to ${subordinate.name}`);

    // Execute the command and wait for report
    const report = await this.executeCommand(command, subordinate);
    this.flowState = addReportToFlowState(this.flowState, report);

    // Update superior status
    this.updateAgentStatus(superior.id, 'executing');

    return report;
  }

  /**
   * Have the commander process the user instruction and delegate to subordinates iteratively.
   *
   * This uses an iterative command loop:
   * 1. Commander analyzes current state (instruction + reports so far)
   * 2. Commander decides: delegate to someone OR synthesize final answer
   * 3. If delegate: execute, get report, loop back to step 1
   * 4. If synthesize: output final answer and done
   */
  private async processCommanderInstruction(
    commander: PoliticalAgentBlock,
    instruction: string
  ): Promise<string> {
    const roleSystemPrompt = getRoleSystemPrompt(commander.role);

    // Get list of available subordinates
    const subordinates = commander.subordinateIds
      .map(id => this.blocksById.get(id))
      .filter((b): b is PoliticalAgentBlock => b !== undefined);

    // Build a map of role names to block IDs for resolution
    const roleToBlockId = new Map<string, string>();
    for (const s of subordinates) {
      roleToBlockId.set(s.role, s.id);
      roleToBlockId.set(s.name.toLowerCase(), s.id);
    }

    const subordinateList = subordinates
      .map(s => `- Role: ${s.role} | Name: ${s.name} (Level ${s.authorityLevel}): ${ROLE_DEFINITIONS[s.role].description}`)
      .join('\n');

    // Track all reports received
    const allReports: Report[] = [];
    const MAX_ITERATIONS = 10; // Safety limit
    let iteration = 0;

    // Track user interruption messages
    let pendingUserMessage: string | null = null;

    while (iteration < MAX_ITERATIONS) {
      // Check if execution was stopped/paused
      if (this.abortController.signal.aborted) {
        this.options.onAgentAction?.(commander.id, 'Execution stopped by user');
        throw new Error('Execution stopped by user');
      }

      // Check for user interruption/message
      if (this.options.getUserMessage) {
        const userMsg = this.options.getUserMessage();
        if (userMsg) {
          pendingUserMessage = userMsg;
          this.options.onAgentAction?.(commander.id, `User interrupt received: "${userMsg.substring(0, 50)}..."`);
        }
      }

      iteration++;
      this.options.onAgentAction?.(commander.id, `Iteration ${iteration}: Analyzing and deciding next action...`);

      // Build context with any reports received so far, clearly marking success/failure
      const successReports = allReports.filter(r => r.status === 'success');
      const failedReports = allReports.filter(r => r.status === 'failed' || r.status === 'partial');

      let reportsContext = '';
      if (allReports.length > 0) {
        reportsContext = `\n\nREPORTS RECEIVED (${successReports.length} success, ${failedReports.length} failed):\n`;
        reportsContext += allReports.map((r, i) =>
          `[Report ${i + 1}] From ${r.fromRole} [STATUS: ${r.status.toUpperCase()}]:\n${r.summary}`
        ).join('\n\n');

        if (failedReports.length > 0) {
          reportsContext += `\n\n⚠️ WARNING: ${failedReports.length} task(s) FAILED. You MUST address these failures before synthesizing.`;
        }
      }

      // Get memory context for the commander
      const privateMemoryContext = await this.getAgentMemoryContext(commander.id);
      const publicMemoryContext = await this.getPublicMemoryContext();

      // Build the commander's iterative prompt with memory context
      const commanderPrompt = `${roleSystemPrompt}
${privateMemoryContext}
${publicMemoryContext}

AVAILABLE SUBORDINATES:
${subordinateList}

ORIGINAL USER INSTRUCTION:
${instruction}
${reportsContext}

You are the Commander. Analyze the current state and decide your next action.

CRITICAL RULES:
1. You can ONLY synthesize when ALL tasks have SUCCEEDED. If ANY report shows FAILED status, you MUST delegate to fix it.
2. For code tasks: The code MUST execute successfully (not just be written). Look for "[EXECUTION STATUS: SUCCESS]" in coder reports.
3. If a task failed, delegate to the SAME subordinate with instructions to FIX the specific error.
4. Do NOT declare completion until the user's original goal is FULLY achieved with working results.

DECISION OPTIONS:
1. DELEGATE - If you need work done OR if any previous task FAILED (retry/fix)
2. SYNTHESIZE - ONLY if ALL tasks succeeded AND the user's goal is fully achieved

Respond with JSON in ONE of these formats:

To DELEGATE to a subordinate (use this if ANY task failed):
{
  "action": "delegate",
  "subordinateRole": "<role name: researcher, writer, reviewer, or coder>",
  "instruction": "<clear, specific instruction - if retrying, include the error to fix>",
  "reasoning": "<why you chose this subordinate and what you expect>"
}

To SYNTHESIZE the final answer (ONLY if all tasks succeeded):
{
  "action": "synthesize",
  "finalAnswer": "<your complete, well-structured final response to the user>",
  "reasoning": "<how you combined the information>"
}

IMPORTANT: If you see any FAILED reports or code execution errors, you MUST delegate to fix them first!`;

      // Log the prompt
      this.options.onAgentMessage?.(
        commander.id,
        'system',
        commanderPrompt,
        { model: (commander.config.modelId as string) || 'gpt-4o' }
      );

      // Build the user message, including any interrupt
      let userMessage = iteration === 1
        ? instruction
        : `Continue. Reports received: ${allReports.length}. Decide next action.`;

      // If there's a pending user interrupt, include it prominently
      if (pendingUserMessage) {
        userMessage = `⚠️ USER INTERRUPT - NEW INSTRUCTION FROM HUMAN USER:\n"${pendingUserMessage}"\n\nPlease acknowledge this new instruction and adjust your plan accordingly. You may need to stop current work and address this immediately.\n\n---\nPrevious context: ${userMessage}`;
        pendingUserMessage = null; // Clear after use
      }

      this.options.onAgentMessage?.(
        commander.id,
        'user',
        userMessage
      );

      try {
        // Check abort before AI call
        if (this.abortController.signal.aborted) {
          throw new Error('Execution stopped by user');
        }

        // Call AI to get next action
        const startTime = Date.now();
        const aiResponse = await callAI({
          messages: [
            { role: 'system', content: commanderPrompt },
            { role: 'user', content: userMessage },
          ],
          modelId: (commander.config.modelId as string) || 'gpt-4o',
          temperature: 0.4,
          maxTokens: (commander.config.maxTokens as number) || 4096,
          apiKeys: this.options.apiKeys,
        });
        const duration = Date.now() - startTime;

        // Log response
        this.options.onAgentMessage?.(
          commander.id,
          'assistant',
          aiResponse.content,
          {
            model: aiResponse.modelId,
            tokens: aiResponse.tokensUsed,
            duration,
          }
        );

        // Update token usage
        const tokensUsed = aiResponse.tokensUsed || 0;
        commander.totalTokensUsed += tokensUsed;
        this.state.totalTokensUsed += tokensUsed;

        // Parse the commander's decision
        let decision: {
          action: 'delegate' | 'synthesize';
          subordinateRole?: string;
          instruction?: string;
          reasoning?: string;
          finalAnswer?: string;
        };

        try {
          const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]);
          } else {
            // If no JSON, assume it's a final answer
            decision = {
              action: 'synthesize',
              finalAnswer: aiResponse.content,
            };
          }
        } catch {
          // If parsing fails, treat as final answer
          decision = {
            action: 'synthesize',
            finalAnswer: aiResponse.content,
          };
        }

        // Handle the decision
        if (decision.action === 'synthesize') {
          // SAFEGUARD: Check if there are any failed reports
          const failedReportCount = allReports.filter(r => r.status === 'failed' || r.status === 'partial').length;
          if (failedReportCount > 0 && iteration < MAX_ITERATIONS - 1) {
            // Force the Commander to continue and fix failures
            this.options.onAgentAction?.(commander.id, `⚠️ Cannot synthesize: ${failedReportCount} task(s) failed. Continuing to fix...`);
            this.options.onAgentMessage?.(
              commander.id,
              'system',
              `BLOCKED: You attempted to synthesize but ${failedReportCount} task(s) have FAILED status. You must delegate to fix these failures first.`
            );
            // Continue to next iteration - Commander will be prompted again
            continue;
          }

          this.options.onAgentAction?.(commander.id, `Synthesizing final answer after ${allReports.length} report(s)`);

          // Log commander's synthesis decision
          await this.logAgentProgress(
            commander.id,
            'decision',
            'Synthesize final answer',
            `Combined ${allReports.length} reports into final response`,
            decision.reasoning,
            undefined
          );

          // Add completion milestone to public memory
          await storage.updateMilestoneStatus(
            this.workflow.id,
            'Workflow Started',
            'achieved'
          );
          await storage.addMilestone(
            this.workflow.id,
            'Task Completed',
            `Commander synthesized final answer from ${allReports.length} subordinate reports`,
            'achieved'
          );

          return decision.finalAnswer || aiResponse.content;
        }

        // Handle delegation
        if (decision.action === 'delegate' && decision.subordinateRole && decision.instruction) {
          // Resolve subordinate by role name
          const resolvedId = roleToBlockId.get(decision.subordinateRole) ||
                            roleToBlockId.get(decision.subordinateRole.toLowerCase());

          if (!resolvedId) {
            this.options.onAgentAction?.(commander.id, `Subordinate role "${decision.subordinateRole}" not found. Available: ${Array.from(roleToBlockId.keys()).join(', ')}`);
            // Try to continue with synthesis
            continue;
          }

          const subordinate = this.blocksById.get(resolvedId);
          if (!subordinate) {
            this.options.onAgentAction?.(commander.id, `Block ${resolvedId} not found`);
            continue;
          }

          this.options.onAgentAction?.(commander.id, `Delegating to ${subordinate.name}: ${decision.instruction.substring(0, 50)}...`);

          // Log commander's delegation decision
          await this.logAgentProgress(
            commander.id,
            'decision',
            `Delegate to ${subordinate.role}`,
            decision.instruction.substring(0, 100),
            decision.reasoning,
            undefined
          );

          const report = await this.issueCommand(
            commander,
            subordinate,
            decision.instruction,
            { priority: 'medium' }
          );

          allReports.push(report);
          this.options.onAgentAction?.(commander.id, `Received report from ${subordinate.name}. Total reports: ${allReports.length}`);

          // Log receiving report
          await this.logAgentProgress(
            commander.id,
            'progress',
            `Received report from ${subordinate.role}`,
            `Report status: ${report.status}`,
            report.summary.substring(0, 200),
            undefined
          );

          // Continue to next iteration
          continue;
        }

        // If we get here with an unclear decision, try to synthesize
        this.options.onAgentAction?.(commander.id, `Unclear decision, attempting synthesis...`);
        return aiResponse.content;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.options.onAgentMessage?.(
          commander.id,
          'system',
          `Error in iteration ${iteration}: ${errorMessage}`
        );
        throw error;
      }
    }

    // Max iterations reached - synthesize with what we have
    const finalSuccessCount = allReports.filter(r => r.status === 'success').length;
    const finalFailedCount = allReports.filter(r => r.status === 'failed' || r.status === 'partial').length;

    this.options.onAgentAction?.(commander.id, `Max iterations (${MAX_ITERATIONS}) reached. Success: ${finalSuccessCount}, Failed: ${finalFailedCount}`);

    if (allReports.length > 0) {
      let fallbackSynthesis = `## Task Summary (Max iterations reached)\n\n`;
      fallbackSynthesis += `**Status:** ${finalFailedCount > 0 ? '⚠️ INCOMPLETE - Some tasks failed' : '✓ Completed'}\n`;
      fallbackSynthesis += `**Reports:** ${finalSuccessCount} succeeded, ${finalFailedCount} failed\n\n`;
      fallbackSynthesis += `### Reports:\n\n${allReports.map((r, i) =>
        `**[${i + 1}] ${r.fromRole} [${r.status.toUpperCase()}]:**\n${r.summary}`
      ).join('\n\n---\n\n')}`;
      return fallbackSynthesis;
    }

    return 'Unable to complete the task within iteration limit.';
  }

  /**
   * Start the political workflow execution.
   */
  async execute(): Promise<PoliticalExecutionState> {
    // Find root commander
    const commander = this.findRootCommander();
    if (!commander) {
      this.state.status = 'failed';
      this.options.onStatusChange?.('failed');
      throw new Error('Root commander not found in workflow');
    }

    // Validate commander role
    if (commander.role !== 'commander') {
      this.recordViolation({
        id: `violation-${Date.now()}`,
        type: 'authority',
        violatingAgentId: commander.id,
        violatingRole: commander.role,
        attemptedOperation: 'Act as root commander',
        message: `Agent "${commander.name}" cannot be root commander with role "${commander.role}". Only "commander" role can be root.`,
        timestamp: Date.now(),
        severity: 'critical',
      });
    }

    this.state.status = 'running';
    this.state.startedAt = Date.now();
    this.options.onStatusChange?.('running');

    // Initialize memory logs for all agents
    await this.initializeMemoryLogs();

    this.updateAgentStatus(commander.id, 'executing');
    this.options.onAgentAction?.(commander.id, 'Received user instruction, planning delegation...');

    // Log commander starting work
    await this.logAgentProgress(
      commander.id,
      'progress',
      'Received user instruction',
      'Starting to analyze and plan delegation',
      undefined,
      undefined
    );

    try {
      // Process the user instruction through the commander
      const result = await this.processCommanderInstruction(
        commander,
        this.options.userInstruction
      );

      // Store the final result
      commander.lastOutput = result;

      // Call the final result callback
      this.options.onFinalResult?.(result);

      this.state.status = 'completed';
      this.state.completedAt = Date.now();
      this.options.onStatusChange?.('completed');

      this.updateAgentStatus(commander.id, 'idle');

      return this.state;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if this was a violation halt (status may have been set by recordViolation)
      const currentStatus = this.state.status as PoliticalExecutionState['status'];
      if (currentStatus !== 'violation_halt') {
        this.state.status = 'failed';
        this.options.onStatusChange?.('failed');
      }

      storage.addLog({
        workflowId: this.workflow.id,
        blockId: commander.id,
        eventType: 'error',
        eventData: { error: errorMessage },
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  /**
   * Pause execution.
   */
  pause(): void {
    this.abortController.abort();
    this.state.status = 'paused';
    this.options.onStatusChange?.('paused');
  }

  /**
   * Stop execution completely.
   */
  stop(): void {
    this.abortController.abort();
    this.state.status = 'failed';
    this.options.onStatusChange?.('failed');
  }

  /**
   * Get current execution state.
   */
  getState(): PoliticalExecutionState {
    return this.state;
  }

  /**
   * Get command flow state for visualization.
   */
  getFlowState(): CommandFlowState {
    return this.flowState;
  }
}

/**
 * Helper to run a political workflow.
 */
export async function runPoliticalWorkflow(
  workflow: PoliticalWorkflow,
  options: PoliticalExecutionOptions
): Promise<PoliticalExecutionState> {
  const executor = new PoliticalWorkflowExecutor(workflow, options);
  return executor.execute();
}
