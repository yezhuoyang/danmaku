/**
 * Agentic Politics - Permission Enforcement
 *
 * Validates that agents only perform actions they are authorized to do.
 * Any permission violation halts execution with a detailed error.
 */

import type {
  AgentRole,
  ResourceType,
  AgentAction,
  PermissionViolation,
  PoliticalAgentBlock,
  Command,
} from '@shared/types';
import { ROLE_DEFINITIONS } from './roles';

/**
 * Generate a unique violation ID.
 */
function generateViolationId(): string {
  return `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an agent has permission to access a resource.
 * Returns null if permitted, or a PermissionViolation if not.
 */
export function checkResourcePermission(
  block: PoliticalAgentBlock,
  resource: ResourceType
): PermissionViolation | null {
  const roleDef = ROLE_DEFINITIONS[block.role];

  if (!roleDef.permissions.resources.includes(resource)) {
    return {
      id: generateViolationId(),
      type: 'resource',
      violatingAgentId: block.id,
      violatingRole: block.role,
      attemptedOperation: `Access resource: ${resource}`,
      attemptedResource: resource,
      message: `Agent "${block.name}" (role: ${block.role}, level: ${block.authorityLevel}) attempted to access resource "${resource}" which is not permitted for this role. Allowed resources: ${roleDef.permissions.resources.join(', ') || 'none'}`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  return null;
}

/**
 * Check if an agent has permission to perform an action.
 * Returns null if permitted, or a PermissionViolation if not.
 */
export function checkActionPermission(
  block: PoliticalAgentBlock,
  action: AgentAction
): PermissionViolation | null {
  const roleDef = ROLE_DEFINITIONS[block.role];

  if (!roleDef.permissions.actions.includes(action)) {
    return {
      id: generateViolationId(),
      type: 'action',
      violatingAgentId: block.id,
      violatingRole: block.role,
      attemptedOperation: `Perform action: ${action}`,
      attemptedAction: action,
      message: `Agent "${block.name}" (role: ${block.role}, level: ${block.authorityLevel}) attempted action "${action}" which is not permitted for this role. Allowed actions: ${roleDef.permissions.actions.join(', ') || 'none'}`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  return null;
}

/**
 * Check if an agent has authority to command another agent.
 * Returns null if permitted, or a PermissionViolation if not.
 */
export function checkCommandPermission(
  commander: PoliticalAgentBlock,
  subordinate: PoliticalAgentBlock
): PermissionViolation | null {
  const commanderDef = ROLE_DEFINITIONS[commander.role];

  // Check if commander can issue commands at all
  if (!commanderDef.permissions.actions.includes('command') &&
      !commanderDef.permissions.actions.includes('delegate')) {
    return {
      id: generateViolationId(),
      type: 'action',
      violatingAgentId: commander.id,
      violatingRole: commander.role,
      targetAgentId: subordinate.id,
      targetRole: subordinate.role,
      attemptedOperation: `Issue command to ${subordinate.name}`,
      attemptedAction: 'command',
      message: `Agent "${commander.name}" (role: ${commander.role}) cannot issue commands - this action is not permitted for this role.`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  // Check if commander can command this specific role
  if (!commanderDef.permissions.canCommand.includes(subordinate.role)) {
    return {
      id: generateViolationId(),
      type: 'command',
      violatingAgentId: commander.id,
      violatingRole: commander.role,
      targetAgentId: subordinate.id,
      targetRole: subordinate.role,
      attemptedOperation: `Command agent with role: ${subordinate.role}`,
      message: `Agent "${commander.name}" (role: ${commander.role}, level: ${commander.authorityLevel}) cannot command "${subordinate.name}" (role: ${subordinate.role}, level: ${subordinate.authorityLevel}). Commandable roles: ${commanderDef.permissions.canCommand.join(', ') || 'none'}`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  // Check authority level (additional safety check)
  if (commander.authorityLevel <= subordinate.authorityLevel) {
    return {
      id: generateViolationId(),
      type: 'authority',
      violatingAgentId: commander.id,
      violatingRole: commander.role,
      targetAgentId: subordinate.id,
      targetRole: subordinate.role,
      attemptedOperation: `Command agent at equal or higher authority level`,
      message: `Agent "${commander.name}" (level: ${commander.authorityLevel}) cannot command "${subordinate.name}" (level: ${subordinate.authorityLevel}). A commander must have higher authority than their subordinates.`,
      timestamp: Date.now(),
      severity: 'critical',
    };
  }

  return null;
}

/**
 * Check if an agent can send a peer message to another agent.
 * Returns null if permitted, or a PermissionViolation if not.
 */
export function checkPeerMessagePermission(
  sender: PoliticalAgentBlock,
  receiver: PoliticalAgentBlock
): PermissionViolation | null {
  const senderDef = ROLE_DEFINITIONS[sender.role];

  // Check if sender can send messages at all
  if (!senderDef.permissions.actions.includes('message')) {
    return {
      id: generateViolationId(),
      type: 'action',
      violatingAgentId: sender.id,
      violatingRole: sender.role,
      targetAgentId: receiver.id,
      targetRole: receiver.role,
      attemptedOperation: `Send peer message to ${receiver.name}`,
      attemptedAction: 'message',
      message: `Agent "${sender.name}" (role: ${sender.role}) cannot send peer messages - this action is not permitted for this role.`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  // Check if sender can message this specific role as a peer
  if (!senderDef.permissions.canMessagePeers.includes(receiver.role)) {
    return {
      id: generateViolationId(),
      type: 'command',
      violatingAgentId: sender.id,
      violatingRole: sender.role,
      targetAgentId: receiver.id,
      targetRole: receiver.role,
      attemptedOperation: `Send peer message to role: ${receiver.role}`,
      message: `Agent "${sender.name}" (role: ${sender.role}) cannot send peer messages to "${receiver.name}" (role: ${receiver.role}). Allowed peer roles: ${senderDef.permissions.canMessagePeers.join(', ') || 'none'}`,
      timestamp: Date.now(),
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Check if an agent can report to another agent.
 * Returns null if permitted, or a PermissionViolation if not.
 */
export function checkReportPermission(
  reporter: PoliticalAgentBlock,
  superior: PoliticalAgentBlock
): PermissionViolation | null {
  const reporterDef = ROLE_DEFINITIONS[reporter.role];

  // Check if reporter can report at all
  if (!reporterDef.permissions.actions.includes('report')) {
    return {
      id: generateViolationId(),
      type: 'action',
      violatingAgentId: reporter.id,
      violatingRole: reporter.role,
      targetAgentId: superior.id,
      targetRole: superior.role,
      attemptedOperation: `Report to ${superior.name}`,
      attemptedAction: 'report',
      message: `Agent "${reporter.name}" (role: ${reporter.role}) cannot send reports - this action is not permitted for this role.`,
      timestamp: Date.now(),
      severity: 'error',
    };
  }

  // Check if reporter can report to this specific role
  if (!reporterDef.permissions.reportTo.includes(superior.role)) {
    return {
      id: generateViolationId(),
      type: 'command',
      violatingAgentId: reporter.id,
      violatingRole: reporter.role,
      targetAgentId: superior.id,
      targetRole: superior.role,
      attemptedOperation: `Report to role: ${superior.role}`,
      message: `Agent "${reporter.name}" (role: ${reporter.role}) cannot report to "${superior.name}" (role: ${superior.role}). Allowed report targets: ${reporterDef.permissions.reportTo.join(', ') || 'none'}`,
      timestamp: Date.now(),
      severity: 'warning',
    };
  }

  return null;
}

/**
 * Validate a command before execution.
 * Returns null if valid, or a PermissionViolation if not.
 */
export function validateCommand(
  command: Command,
  commander: PoliticalAgentBlock,
  subordinate: PoliticalAgentBlock
): PermissionViolation | null {
  // First check command permission
  const commandViolation = checkCommandPermission(commander, subordinate);
  if (commandViolation) {
    return commandViolation;
  }

  // Validate command roles match block roles
  if (command.fromRole !== commander.role) {
    return {
      id: generateViolationId(),
      type: 'authority',
      violatingAgentId: commander.id,
      violatingRole: commander.role,
      attemptedOperation: `Issue command with mismatched role`,
      message: `Command claims to be from role "${command.fromRole}" but agent "${commander.name}" has role "${commander.role}".`,
      timestamp: Date.now(),
      severity: 'critical',
    };
  }

  if (command.toRole !== subordinate.role) {
    return {
      id: generateViolationId(),
      type: 'authority',
      violatingAgentId: commander.id,
      violatingRole: commander.role,
      targetAgentId: subordinate.id,
      targetRole: subordinate.role,
      attemptedOperation: `Issue command with mismatched target role`,
      message: `Command targets role "${command.toRole}" but agent "${subordinate.name}" has role "${subordinate.role}".`,
      timestamp: Date.now(),
      severity: 'critical',
    };
  }

  return null;
}

/**
 * Comprehensive permission check for an agent operation.
 * Returns all violations found.
 */
export function checkPermissions(
  block: PoliticalAgentBlock,
  options: {
    resource?: ResourceType;
    action?: AgentAction;
    commandTarget?: PoliticalAgentBlock;
    messageTarget?: PoliticalAgentBlock;
    reportTarget?: PoliticalAgentBlock;
  }
): PermissionViolation[] {
  const violations: PermissionViolation[] = [];

  if (options.resource) {
    const violation = checkResourcePermission(block, options.resource);
    if (violation) violations.push(violation);
  }

  if (options.action) {
    const violation = checkActionPermission(block, options.action);
    if (violation) violations.push(violation);
  }

  if (options.commandTarget) {
    const violation = checkCommandPermission(block, options.commandTarget);
    if (violation) violations.push(violation);
  }

  if (options.messageTarget) {
    const violation = checkPeerMessagePermission(block, options.messageTarget);
    if (violation) violations.push(violation);
  }

  if (options.reportTarget) {
    const violation = checkReportPermission(block, options.reportTarget);
    if (violation) violations.push(violation);
  }

  return violations;
}

/**
 * Format a violation for display.
 */
export function formatViolation(violation: PermissionViolation): string {
  const severityEmoji = {
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };

  return `${severityEmoji[violation.severity]} [${violation.type.toUpperCase()}] ${violation.message}`;
}

/**
 * Check if an operation should halt execution based on violation severity.
 */
export function shouldHaltExecution(violations: PermissionViolation[]): boolean {
  return violations.some(v => v.severity === 'error' || v.severity === 'critical');
}
