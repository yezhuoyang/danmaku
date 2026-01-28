/**
 * Blackboard Manager
 *
 * Manages the shared workspace state with controlled updates via merge requests.
 * Implements the "blackboard" pattern for multi-agent collaboration.
 */

import type {
  Blackboard,
  BlackboardClaim,
  BlackboardQuestion,
  BlackboardHypothesis,
  MergeRequest,
  MergeRequestCheck,
  MergeRules,
  WorkflowEvent,
  Artifact,
  TaskPriority,
} from '@shared/types';
import { storage } from '../storage';

/**
 * Create a new merge request
 */
export function createMergeRequest(
  workflowId: string,
  proposedBy: string,
  title: string,
  changes: MergeRequest['changes'],
  description?: string
): MergeRequest {
  return {
    id: `mr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    workflowId,
    title,
    description,
    proposedBy,
    proposedAt: Date.now(),
    changes,
    checks: [],
    autoMergeEligible: false,
    status: 'pending',
  };
}

/**
 * Validate merge request checks based on rules
 */
export async function validateMergeRequest(
  mr: MergeRequest,
  blackboard: Blackboard,
  rules: MergeRules
): Promise<MergeRequest> {
  const checks: MergeRequestCheck[] = [];

  for (const change of mr.changes) {
    switch (change.type) {
      case 'add_claim': {
        const claim = change.after as BlackboardClaim;

        // Check: Citation required
        if (rules.claimRequiresCitation) {
          checks.push({
            name: 'Citation Required',
            description: 'Claims must have at least one source artifact',
            status: claim.sourceArtifactIds.length > 0 ? 'passed' : 'failed',
            message: claim.sourceArtifactIds.length > 0
              ? `${claim.sourceArtifactIds.length} citation(s) provided`
              : 'No citations provided',
          });
        }

        // Check: Minimum confidence
        checks.push({
          name: 'Confidence Threshold',
          description: `Confidence must be at least ${rules.claimMinConfidence}`,
          status: claim.confidence >= rules.claimMinConfidence ? 'passed' : 'failed',
          message: `Confidence: ${(claim.confidence * 100).toFixed(0)}%`,
        });

        // Check: No duplicate claims
        const isDuplicate = blackboard.claims.some(
          c => c.text.toLowerCase() === claim.text.toLowerCase()
        );
        checks.push({
          name: 'No Duplicates',
          description: 'Claim should not already exist',
          status: isDuplicate ? 'failed' : 'passed',
          message: isDuplicate ? 'Similar claim already exists' : 'No duplicates found',
        });

        // Verify cited artifacts exist
        for (const artifactId of claim.sourceArtifactIds) {
          const artifact = await storage.getArtifact(artifactId);
          if (!artifact) {
            checks.push({
              name: 'Artifact Exists',
              description: 'All cited artifacts must exist',
              status: 'failed',
              message: `Artifact ${artifactId} not found`,
            });
          }
        }
        break;
      }

      case 'add_hypothesis': {
        const hypothesis = change.after as BlackboardHypothesis;

        // Check: Hypothesis artifact exists
        const artifact = await storage.getArtifact(hypothesis.artifactId);
        checks.push({
          name: 'Hypothesis Artifact',
          description: 'Hypothesis must reference a valid artifact',
          status: artifact ? 'passed' : 'failed',
          message: artifact ? 'Hypothesis artifact found' : 'Hypothesis artifact not found',
        });

        // Human review required for hypotheses
        if (rules.requireHumanReviewFor.includes('hypothesis')) {
          checks.push({
            name: 'Human Review Required',
            description: 'Hypotheses require human approval',
            status: 'pending',
            message: 'Awaiting human review',
          });
        }
        break;
      }

      case 'add_constraint':
      case 'update_problem': {
        // Major changes require human review
        if (rules.requireHumanReviewFor.includes('constraint_change')) {
          checks.push({
            name: 'Human Review Required',
            description: 'Constraint changes require human approval',
            status: 'pending',
            message: 'Awaiting human review',
          });
        }
        break;
      }

      case 'add_to_queue': {
        const experimentId = change.after as string;
        const artifact = await storage.getArtifact(experimentId);

        // Check experiment spec has metrics
        if (rules.experimentRequiresMetrics && artifact) {
          const content = artifact.content as any;
          const hasMetrics = content?.metrics && content.metrics.length > 0;
          checks.push({
            name: 'Metrics Defined',
            description: 'Experiment spec must define metrics',
            status: hasMetrics ? 'passed' : 'failed',
            message: hasMetrics ? `${content.metrics.length} metric(s) defined` : 'No metrics defined',
          });
        }

        // Check experiment spec has stopping rule
        if (rules.experimentRequiresStoppingRule && artifact) {
          const content = artifact.content as any;
          const hasStoppingRule = content?.stoppingRule?.value;
          checks.push({
            name: 'Stopping Rule',
            description: 'Experiment spec must define a stopping rule',
            status: hasStoppingRule ? 'passed' : 'failed',
            message: hasStoppingRule ? 'Stopping rule defined' : 'No stopping rule defined',
          });
        }
        break;
      }
    }
  }

  // Determine auto-merge eligibility
  const allChecksPassed = checks.every(c => c.status === 'passed');
  const hasPendingChecks = checks.some(c => c.status === 'pending');
  const autoMergeEligible = rules.autoMergeRequiresAllChecksPassed
    ? allChecksPassed && !hasPendingChecks
    : !checks.some(c => c.status === 'failed') && !hasPendingChecks;

  return {
    ...mr,
    checks,
    autoMergeEligible,
  };
}

/**
 * Apply approved changes to blackboard
 */
export async function applyMergeRequest(
  mr: MergeRequest,
  blackboard: Blackboard
): Promise<{ blackboard: Blackboard; event: Omit<WorkflowEvent, 'id'> }> {
  const updatedBlackboard = { ...blackboard };

  for (const change of mr.changes) {
    switch (change.type) {
      case 'add_claim':
        updatedBlackboard.claims = [...updatedBlackboard.claims, change.after as BlackboardClaim];
        break;

      case 'update_claim': {
        const updatedClaim = change.after as BlackboardClaim;
        updatedBlackboard.claims = updatedBlackboard.claims.map(c =>
          c.id === updatedClaim.id ? updatedClaim : c
        );
        break;
      }

      case 'remove_claim':
        updatedBlackboard.claims = updatedBlackboard.claims.filter(c => c.id !== change.target);
        break;

      case 'add_question':
        updatedBlackboard.openQuestions = [
          ...updatedBlackboard.openQuestions,
          change.after as BlackboardQuestion,
        ];
        break;

      case 'update_question': {
        const updatedQuestion = change.after as BlackboardQuestion;
        updatedBlackboard.openQuestions = updatedBlackboard.openQuestions.map(q =>
          q.id === updatedQuestion.id ? updatedQuestion : q
        );
        break;
      }

      case 'remove_question':
        updatedBlackboard.openQuestions = updatedBlackboard.openQuestions.filter(
          q => q.id !== change.target
        );
        break;

      case 'add_hypothesis':
        updatedBlackboard.hypotheses = [
          ...updatedBlackboard.hypotheses,
          change.after as BlackboardHypothesis,
        ];
        break;

      case 'update_hypothesis': {
        const updatedHypothesis = change.after as BlackboardHypothesis;
        updatedBlackboard.hypotheses = updatedBlackboard.hypotheses.map(h =>
          h.id === updatedHypothesis.id ? updatedHypothesis : h
        );
        break;
      }

      case 'remove_hypothesis':
        updatedBlackboard.hypotheses = updatedBlackboard.hypotheses.filter(
          h => h.id !== change.target
        );
        break;

      case 'update_problem':
        updatedBlackboard.problemStatement = change.after as string;
        break;

      case 'add_assumption':
        updatedBlackboard.assumptions = [...updatedBlackboard.assumptions, change.after as string];
        break;

      case 'add_constraint':
        updatedBlackboard.constraints = [...updatedBlackboard.constraints, change.after as string];
        break;

      case 'add_to_queue':
        updatedBlackboard.experimentQueue = [
          ...updatedBlackboard.experimentQueue,
          change.after as string,
        ];
        break;

      case 'update_outline':
        updatedBlackboard.draftOutline = change.after as typeof blackboard.draftOutline;
        break;
    }
  }

  // Create event for this merge
  const event: Omit<WorkflowEvent, 'id'> = {
    workflowId: blackboard.workflowId,
    timestamp: Date.now(),
    eventType: 'blackboard_updated',
    data: {
      mergeRequestId: mr.id,
      changes: mr.changes.map(c => c.type),
    },
    inputs: [],
    outputs: [],
  };

  return { blackboard: updatedBlackboard, event };
}

/**
 * Helper to create a claim and propose it via merge request
 */
export function proposeClaim(
  workflowId: string,
  proposedBy: string,
  text: string,
  confidence: number,
  sourceArtifactIds: string[]
): MergeRequest {
  const claim: BlackboardClaim = {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    text,
    confidence,
    sourceArtifactIds,
    status: 'proposed',
    addedAt: Date.now(),
    addedBy: proposedBy,
  };

  return createMergeRequest(
    workflowId,
    proposedBy,
    `Add claim: "${text.slice(0, 50)}..."`,
    [{ type: 'add_claim', after: claim }]
  );
}

/**
 * Helper to create a question and propose it via merge request
 */
export function proposeQuestion(
  workflowId: string,
  proposedBy: string,
  text: string,
  priority: TaskPriority = 'medium',
  relatedArtifactIds: string[] = []
): MergeRequest {
  const question: BlackboardQuestion = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    text,
    priority,
    status: 'open',
    relatedArtifactIds,
    addedAt: Date.now(),
    addedBy: proposedBy,
  };

  return createMergeRequest(
    workflowId,
    proposedBy,
    `Add question: "${text.slice(0, 50)}..."`,
    [{ type: 'add_question', after: question }]
  );
}

/**
 * Helper to answer a question via merge request
 */
export function proposeQuestionAnswer(
  workflowId: string,
  proposedBy: string,
  questionId: string,
  answer: string,
  confidence: number,
  sourceId?: string
): MergeRequest {
  return createMergeRequest(
    workflowId,
    proposedBy,
    `Answer question ${questionId}`,
    [{
      type: 'update_question',
      target: questionId,
      after: {
        proposedAnswers: [{
          text: answer,
          confidence,
          sourceId,
        }],
      },
    }]
  );
}

/**
 * Get blackboard summary for context assembly
 */
export function getBlackboardSummary(blackboard: Blackboard): string {
  const parts: string[] = [];

  if (blackboard.problemStatement) {
    parts.push(`## Problem Statement\n${blackboard.problemStatement}`);
  }

  if (blackboard.assumptions.length > 0) {
    parts.push(`## Assumptions\n${blackboard.assumptions.map(a => `- ${a}`).join('\n')}`);
  }

  if (blackboard.constraints.length > 0) {
    parts.push(`## Constraints\n${blackboard.constraints.map(c => `- ${c}`).join('\n')}`);
  }

  const verifiedClaims = blackboard.claims.filter(c => c.status === 'verified');
  if (verifiedClaims.length > 0) {
    parts.push(
      `## Verified Claims (${verifiedClaims.length})\n` +
      verifiedClaims.slice(0, 10).map(c =>
        `- ${c.text} (confidence: ${(c.confidence * 100).toFixed(0)}%)`
      ).join('\n')
    );
  }

  const openQuestions = blackboard.openQuestions.filter(q => q.status === 'open');
  if (openQuestions.length > 0) {
    parts.push(
      `## Open Questions (${openQuestions.length})\n` +
      openQuestions.slice(0, 5).map(q => `- [${q.priority}] ${q.text}`).join('\n')
    );
  }

  const activeHypotheses = blackboard.hypotheses.filter(h =>
    h.status === 'proposed' || h.status === 'testing'
  );
  if (activeHypotheses.length > 0) {
    parts.push(`## Active Hypotheses: ${activeHypotheses.length}`);
  }

  if (blackboard.experimentQueue.length > 0) {
    parts.push(`## Pending Experiments: ${blackboard.experimentQueue.length}`);
  }

  return parts.join('\n\n');
}

/**
 * BlackboardManager class for stateful operations
 */
export class BlackboardManager {
  private workflowId: string;
  private rules: MergeRules;

  constructor(workflowId: string, rules: MergeRules) {
    this.workflowId = workflowId;
    this.rules = rules;
  }

  async getBlackboard(): Promise<Blackboard> {
    const bb = await storage.getBlackboard(this.workflowId);
    if (!bb) {
      return storage.createBlackboard(this.workflowId);
    }
    return bb;
  }

  async proposeClaim(
    proposedBy: string,
    text: string,
    confidence: number,
    sourceArtifactIds: string[]
  ): Promise<MergeRequest> {
    const mr = proposeClaim(this.workflowId, proposedBy, text, confidence, sourceArtifactIds);
    const blackboard = await this.getBlackboard();
    const validated = await validateMergeRequest(mr, blackboard, this.rules);

    // Save the merge request
    await storage.saveMergeRequest(validated);

    // Log event
    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'merge_request_created',
      agentId: proposedBy,
      data: { mergeRequestId: validated.id, type: 'add_claim' },
      inputs: sourceArtifactIds,
      outputs: [],
    });

    // Auto-merge if eligible
    if (validated.autoMergeEligible) {
      return this.approveMergeRequest(validated.id, 'system');
    }

    return validated;
  }

  async proposeQuestion(
    proposedBy: string,
    text: string,
    priority: TaskPriority = 'medium'
  ): Promise<MergeRequest> {
    const mr = proposeQuestion(this.workflowId, proposedBy, text, priority);
    const blackboard = await this.getBlackboard();
    const validated = await validateMergeRequest(mr, blackboard, this.rules);

    await storage.saveMergeRequest(validated);

    // Questions typically auto-merge
    if (validated.autoMergeEligible) {
      return this.approveMergeRequest(validated.id, 'system');
    }

    return validated;
  }

  async approveMergeRequest(mrId: string, approvedBy: string): Promise<MergeRequest> {
    const mr = await storage.getMergeRequest(mrId);
    if (!mr) {
      throw new Error(`Merge request ${mrId} not found`);
    }

    const blackboard = await this.getBlackboard();
    const { blackboard: updated, event } = await applyMergeRequest(mr, blackboard);

    // Save updated blackboard
    await storage.saveBlackboard(updated);

    // Update merge request status
    const approvedMr: MergeRequest = {
      ...mr,
      status: approvedBy === 'system' ? 'auto_merged' : 'approved',
      reviewedBy: approvedBy,
      reviewedAt: Date.now(),
    };
    await storage.saveMergeRequest(approvedMr);

    // Log event
    const eventId = await storage.addEvent(event);
    approvedMr.mergedEventId = eventId;

    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'merge_request_approved',
      userId: approvedBy === 'system' ? undefined : approvedBy,
      data: { mergeRequestId: mrId, autoMerged: approvedBy === 'system' },
      inputs: [],
      outputs: [],
    });

    return approvedMr;
  }

  async rejectMergeRequest(mrId: string, rejectedBy: string, comment?: string): Promise<MergeRequest> {
    const mr = await storage.getMergeRequest(mrId);
    if (!mr) {
      throw new Error(`Merge request ${mrId} not found`);
    }

    const rejectedMr: MergeRequest = {
      ...mr,
      status: 'rejected',
      reviewedBy: rejectedBy,
      reviewedAt: Date.now(),
      reviewComment: comment,
    };
    await storage.saveMergeRequest(rejectedMr);

    await storage.addEvent({
      workflowId: this.workflowId,
      timestamp: Date.now(),
      eventType: 'merge_request_rejected',
      userId: rejectedBy,
      data: { mergeRequestId: mrId, comment },
      inputs: [],
      outputs: [],
    });

    return rejectedMr;
  }

  async getSummary(): Promise<string> {
    const bb = await this.getBlackboard();
    return getBlackboardSummary(bb);
  }
}
