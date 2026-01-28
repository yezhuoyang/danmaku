/**
 * Multi-Agent Collaboration Module
 *
 * Exports all collaboration primitives for the Agent Lego system.
 */

// Blackboard manager
export {
  BlackboardManager,
  createMergeRequest,
  validateMergeRequest,
  applyMergeRequest,
  proposeClaim,
  proposeQuestion,
  proposeQuestionAnswer,
  getBlackboardSummary,
} from './blackboard';

// Task manager
export {
  TaskManager,
  createTask,
  TaskTemplates,
} from './tasks';

// Context assembler
export {
  assembleContext,
  assembleMinimalContext,
  formatContextForPrompt,
  DEFAULT_CONTEXT_CONFIG,
  type ContextAssemblyConfig,
} from './context';
