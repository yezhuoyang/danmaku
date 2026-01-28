/**
 * Agent Lego Execution Module
 *
 * Exports the workflow execution engine and related utilities.
 */

// Main execution engine
export {
  WorkflowExecutor,
  runWorkflow,
  validateWorkflow,
  getExecutionOrder,
  getIncomingConnections,
  getOutgoingConnections,
  type ExecutionState,
  type ExecutionOptions,
} from './engine';

// Block executors
export { executeBlock } from './executors';

// AI client
export {
  callAI,
  validateApiKey,
  getModelProvider,
  getSupportedModels,
  type AIMessage,
  type AICallOptions,
  type AIResponse,
} from './ai-client';
