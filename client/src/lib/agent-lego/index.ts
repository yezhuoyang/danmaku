/**
 * Agent Lego Library
 *
 * Main entry point for the Agent Lego multi-agent workflow system.
 */

// Storage
export { storage } from './storage';

// Execution engine
export {
  WorkflowExecutor,
  runWorkflow,
  validateWorkflow,
  getExecutionOrder,
  executeBlock,
  callAI,
  validateApiKey,
  getModelProvider,
  getSupportedModels,
  type ExecutionState,
  type ExecutionOptions,
  type AIMessage,
  type AICallOptions,
  type AIResponse,
} from './execution';

// Validation
export {
  validateConnection,
  validateAllConnections,
  wouldCreateCycle,
  getSuggestedConnections,
  getBlockDefinition,
  getInputPorts,
  getOutputPorts,
  areTypesCompatible,
} from './validation';

// Multi-agent collaboration
export {
  BlackboardManager,
  createMergeRequest,
  validateMergeRequest,
  applyMergeRequest,
  proposeClaim,
  proposeQuestion,
  getBlackboardSummary,
  TaskManager,
  createTask,
  TaskTemplates,
  assembleContext,
  assembleMinimalContext,
  formatContextForPrompt,
  DEFAULT_CONTEXT_CONFIG,
} from './collaboration';
