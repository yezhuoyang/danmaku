/**
 * Agentic Politics - Command & Report Flow Management
 *
 * Handles the creation, routing, and tracking of commands
 * and reports between agents in the political hierarchy.
 */

import type {
  Command,
  Report,
  PeerMessage,
  PoliticalAgentBlock,
  AgentRole,
} from '@shared/types';

/**
 * Generate a unique command ID.
 */
export function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique report ID.
 */
export function generateReportId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique message ID.
 */
export function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new command from a superior to a subordinate.
 */
export function createCommand(
  commander: PoliticalAgentBlock,
  subordinate: PoliticalAgentBlock,
  instruction: string,
  options: {
    type?: Command['type'];
    context?: string;
    constraints?: string[];
    priority?: Command['priority'];
  } = {}
): Command {
  return {
    id: generateCommandId(),
    type: options.type || 'task',
    fromAgentId: commander.id,
    fromRole: commander.role,
    toAgentId: subordinate.id,
    toRole: subordinate.role,
    instruction,
    context: options.context,
    constraints: options.constraints,
    priority: options.priority || 'medium',
    issuedAt: Date.now(),
    status: 'pending',
  };
}

/**
 * Create a report from subordinate to superior.
 */
export function createReport(
  subordinate: PoliticalAgentBlock,
  superior: PoliticalAgentBlock,
  command: Command,
  options: {
    status: Report['status'];
    summary: string;
    output?: unknown;
    tokensUsed?: number;
  }
): Report {
  return {
    id: generateReportId(),
    commandId: command.id,
    fromAgentId: subordinate.id,
    fromRole: subordinate.role,
    toAgentId: superior.id,
    toRole: superior.role,
    status: options.status,
    summary: options.summary,
    output: options.output,
    tokensUsed: options.tokensUsed,
    submittedAt: Date.now(),
  };
}

/**
 * Create a peer message between agents at the same level.
 */
export function createPeerMessage(
  sender: PoliticalAgentBlock,
  receiver: PoliticalAgentBlock,
  content: string
): PeerMessage {
  return {
    id: generateMessageId(),
    fromAgentId: sender.id,
    fromRole: sender.role,
    toAgentId: receiver.id,
    toRole: receiver.role,
    content,
    timestamp: Date.now(),
    acknowledged: false,
  };
}

/**
 * Update command status.
 */
export function updateCommandStatus(
  command: Command,
  status: Command['status']
): Command {
  const updated = { ...command, status };

  if (status === 'acknowledged' && !command.acknowledgedAt) {
    updated.acknowledgedAt = Date.now();
  }

  if ((status === 'completed' || status === 'failed') && !command.completedAt) {
    updated.completedAt = Date.now();
  }

  return updated;
}

/**
 * Format a command for display in logs.
 */
export function formatCommand(command: Command): string {
  const priority = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };

  return `${priority[command.priority]} [${command.type.toUpperCase()}] From ${command.fromRole} → ${command.toRole}: "${command.instruction.substring(0, 100)}${command.instruction.length > 100 ? '...' : ''}"`;
}

/**
 * Format a report for display in logs.
 */
export function formatReport(report: Report): string {
  const status = {
    success: '✅',
    partial: '🟡',
    failed: '❌',
    needs_escalation: '⬆️',
  };

  return `${status[report.status]} [REPORT] From ${report.fromRole} → ${report.toRole}: "${report.summary.substring(0, 100)}${report.summary.length > 100 ? '...' : ''}"`;
}

/**
 * Format a peer message for display in logs.
 */
export function formatPeerMessage(message: PeerMessage): string {
  return `💬 [PEER] From ${message.fromRole} → ${message.toRole}: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}"`;
}

/**
 * Command chain represents the active hierarchy of commands.
 */
export interface CommandChain {
  root: Command;
  chain: Command[];
  currentCommand: Command;
  pendingReports: string[];  // Command IDs awaiting reports
}

/**
 * Create an initial command chain from a user instruction.
 */
export function createCommandChainFromUser(
  rootCommander: PoliticalAgentBlock,
  userInstruction: string
): CommandChain {
  // Create a virtual "user" command to the commander
  const rootCommand: Command = {
    id: generateCommandId(),
    type: 'task',
    fromAgentId: 'user',
    fromRole: 'commander' as AgentRole,  // User acts at commander level
    toAgentId: rootCommander.id,
    toRole: rootCommander.role,
    instruction: userInstruction,
    priority: 'high',
    issuedAt: Date.now(),
    status: 'pending',
  };

  return {
    root: rootCommand,
    chain: [rootCommand],
    currentCommand: rootCommand,
    pendingReports: [rootCommand.id],
  };
}

/**
 * Add a command to the chain.
 */
export function addToCommandChain(
  chain: CommandChain,
  command: Command
): CommandChain {
  return {
    ...chain,
    chain: [...chain.chain, command],
    currentCommand: command,
    pendingReports: [...chain.pendingReports, command.id],
  };
}

/**
 * Mark a command as having received its report.
 */
export function resolveCommandInChain(
  chain: CommandChain,
  commandId: string
): CommandChain {
  return {
    ...chain,
    pendingReports: chain.pendingReports.filter(id => id !== commandId),
  };
}

/**
 * Get the depth of a command in the chain (distance from root).
 */
export function getCommandDepth(chain: CommandChain, commandId: string): number {
  const index = chain.chain.findIndex(c => c.id === commandId);
  return index >= 0 ? index : -1;
}

/**
 * Check if all commands in the chain have been resolved.
 */
export function isChainComplete(chain: CommandChain): boolean {
  return chain.pendingReports.length === 0;
}

/**
 * Command flow state for tracking execution.
 */
export interface CommandFlowState {
  chains: CommandChain[];
  activeChainIndex: number;
  allCommands: Map<string, Command>;
  allReports: Map<string, Report>;
  allMessages: PeerMessage[];
  commandsByAgent: Map<string, string[]>;  // agentId -> commandIds received
  reportsByAgent: Map<string, string[]>;   // agentId -> reportIds sent
}

/**
 * Create initial command flow state.
 */
export function createCommandFlowState(): CommandFlowState {
  return {
    chains: [],
    activeChainIndex: -1,
    allCommands: new Map(),
    allReports: new Map(),
    allMessages: [],
    commandsByAgent: new Map(),
    reportsByAgent: new Map(),
  };
}

/**
 * Add a command to the flow state.
 */
export function addCommandToFlowState(
  state: CommandFlowState,
  command: Command
): CommandFlowState {
  const newCommands = new Map(state.allCommands);
  newCommands.set(command.id, command);

  const commandsByAgent = new Map(state.commandsByAgent);
  const existingCommands = commandsByAgent.get(command.toAgentId) || [];
  commandsByAgent.set(command.toAgentId, [...existingCommands, command.id]);

  return {
    ...state,
    allCommands: newCommands,
    commandsByAgent,
  };
}

/**
 * Add a report to the flow state.
 */
export function addReportToFlowState(
  state: CommandFlowState,
  report: Report
): CommandFlowState {
  const newReports = new Map(state.allReports);
  newReports.set(report.id, report);

  const reportsByAgent = new Map(state.reportsByAgent);
  const existingReports = reportsByAgent.get(report.fromAgentId) || [];
  reportsByAgent.set(report.fromAgentId, [...existingReports, report.id]);

  return {
    ...state,
    allReports: newReports,
    reportsByAgent,
  };
}

/**
 * Add a peer message to the flow state.
 */
export function addMessageToFlowState(
  state: CommandFlowState,
  message: PeerMessage
): CommandFlowState {
  return {
    ...state,
    allMessages: [...state.allMessages, message],
  };
}

/**
 * Get all commands received by an agent.
 */
export function getCommandsForAgent(
  state: CommandFlowState,
  agentId: string
): Command[] {
  const commandIds = state.commandsByAgent.get(agentId) || [];
  return commandIds
    .map(id => state.allCommands.get(id))
    .filter((c): c is Command => c !== undefined);
}

/**
 * Get all reports sent by an agent.
 */
export function getReportsFromAgent(
  state: CommandFlowState,
  agentId: string
): Report[] {
  const reportIds = state.reportsByAgent.get(agentId) || [];
  return reportIds
    .map(id => state.allReports.get(id))
    .filter((r): r is Report => r !== undefined);
}

/**
 * Get the most recent pending command for an agent.
 */
export function getPendingCommand(
  state: CommandFlowState,
  agentId: string
): Command | undefined {
  const commands = getCommandsForAgent(state, agentId);
  return commands.find(c => c.status === 'pending' || c.status === 'acknowledged' || c.status === 'in_progress');
}

/**
 * Build a visual representation of the command flow.
 */
export interface CommandFlowNode {
  id: string;
  type: 'command' | 'report' | 'message';
  data: Command | Report | PeerMessage;
  fromAgentId: string;
  toAgentId: string;
  timestamp: number;
}

export function buildCommandFlowTimeline(
  state: CommandFlowState
): CommandFlowNode[] {
  const nodes: CommandFlowNode[] = [];

  // Add all commands
  state.allCommands.forEach((command) => {
    nodes.push({
      id: command.id,
      type: 'command',
      data: command,
      fromAgentId: command.fromAgentId,
      toAgentId: command.toAgentId,
      timestamp: command.issuedAt,
    });
  });

  // Add all reports
  state.allReports.forEach((report) => {
    nodes.push({
      id: report.id,
      type: 'report',
      data: report,
      fromAgentId: report.fromAgentId,
      toAgentId: report.toAgentId,
      timestamp: report.submittedAt,
    });
  });

  // Add all messages
  state.allMessages.forEach((message) => {
    nodes.push({
      id: message.id,
      type: 'message',
      data: message,
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
      timestamp: message.timestamp,
    });
  });

  // Sort by timestamp
  return nodes.sort((a, b) => a.timestamp - b.timestamp);
}
