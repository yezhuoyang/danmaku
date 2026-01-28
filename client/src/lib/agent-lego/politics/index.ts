/**
 * Agentic Politics Module
 *
 * Hierarchical agent governance system where:
 * - Agents have authority levels (0-10)
 * - Role-based permissions define access and actions
 * - Connections represent power relations
 * - Commands flow down, reports flow up
 * - Violations halt execution
 */

// Role definitions and utilities
export {
  ROLE_DEFINITIONS,
  ROLE_CATEGORIES,
  getRoleDefinition,
  getRolesByLevel,
  getCommandableRoles,
  getPeerRoles,
  getSuperiorRoles,
  canCommand,
  canMessagePeer,
  getRoleSystemPrompt,
} from './roles';

// Permission enforcement
export {
  checkResourcePermission,
  checkActionPermission,
  checkCommandPermission,
  checkPeerMessagePermission,
  checkReportPermission,
  validateCommand,
  checkPermissions,
  formatViolation,
  shouldHaltExecution,
} from './permissions';

// Command and report flow management
export {
  generateCommandId,
  generateReportId,
  generateMessageId,
  createCommand,
  createReport,
  createPeerMessage,
  updateCommandStatus,
  formatCommand,
  formatReport,
  formatPeerMessage,
  createCommandChainFromUser,
  addToCommandChain,
  resolveCommandInChain,
  getCommandDepth,
  isChainComplete,
  createCommandFlowState,
  addCommandToFlowState,
  addReportToFlowState,
  addMessageToFlowState,
  getCommandsForAgent,
  getReportsFromAgent,
  getPendingCommand,
  buildCommandFlowTimeline,
  type CommandChain,
  type CommandFlowState,
  type CommandFlowNode,
} from './command-flow';

// Political workflow executor
export {
  PoliticalWorkflowExecutor,
  runPoliticalWorkflow,
} from './executor';
