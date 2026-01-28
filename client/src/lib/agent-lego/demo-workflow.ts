/**
 * Demo Workflow: Research Paper Pipeline
 *
 * A pre-configured workflow that demonstrates the Agent Lego system:
 * 1. Paper Fetcher - Searches arXiv for papers on a given topic
 * 2. Researcher - Analyzes papers and generates research ideas
 * 3. Writer - Creates a research summary document
 * 4. Notification - Notifies the user when complete
 */

import type { Workflow, WorkflowBlock, WorkflowConnection } from '@shared/types';

/**
 * Create a demo workflow with the paper research pipeline
 */
export function createDemoWorkflow(userId: string, topic: string = 'transformer attention mechanisms'): Workflow {
  const workflowId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Block IDs
  const paperFetcherId = `blk_paper_fetcher_${Date.now()}`;
  const researcherId = `blk_researcher_${Date.now() + 1}`;
  const writerId = `blk_writer_${Date.now() + 2}`;
  const notificationId = `blk_notification_${Date.now() + 3}`;

  // Define blocks
  const blocks: WorkflowBlock[] = [
    {
      id: paperFetcherId,
      type: 'paper_fetcher',
      name: 'Paper Fetcher',
      position: { x: 100, y: 200 },
      config: {
        source: 'arxiv',
        maxResults: 5,
        query: topic,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
    {
      id: researcherId,
      type: 'researcher',
      name: 'Research Analyst',
      position: { x: 400, y: 200 },
      config: {
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: `You are a senior research scientist specializing in machine learning and AI.
Analyze the provided papers carefully and generate innovative research ideas.
Focus on:
1. Identifying unexplored directions
2. Proposing novel combinations of techniques
3. Suggesting practical applications
4. Highlighting potential breakthrough opportunities

Respond with structured JSON containing your analysis.`,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
    {
      id: writerId,
      type: 'writer',
      name: 'Report Writer',
      position: { x: 700, y: 200 },
      config: {
        modelId: 'gpt-4o',
        style: 'research_summary',
        maxWords: 1500,
        outputFormat: 'markdown',
        temperature: 0.7,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
    {
      id: notificationId,
      type: 'notification',
      name: 'Complete Notification',
      position: { x: 1000, y: 200 },
      config: {
        title: 'Research Report Ready',
        type: 'success',
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
  ];

  // Define connections
  const connections: WorkflowConnection[] = [
    {
      id: `conn_1_${Date.now()}`,
      sourceBlockId: paperFetcherId,
      sourcePort: 'output',
      targetBlockId: researcherId,
      targetPort: 'input',
    },
    {
      id: `conn_2_${Date.now()}`,
      sourceBlockId: researcherId,
      sourcePort: 'output',
      targetBlockId: writerId,
      targetPort: 'input',
    },
    {
      id: `conn_3_${Date.now()}`,
      sourceBlockId: writerId,
      sourcePort: 'output',
      targetBlockId: notificationId,
      targetPort: 'input',
    },
  ];

  return {
    id: workflowId,
    userId,
    name: `Research Pipeline: ${topic}`,
    description: `Automated research workflow that fetches papers about "${topic}", analyzes them with AI, and generates a research summary report.`,
    blocks,
    connections,
    status: 'draft',
    globalMemory: {
      topic,
      createdAt: Date.now(),
    },
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a simple test workflow with just paper fetcher
 */
export function createSimpleTestWorkflow(userId: string, query: string): Workflow {
  const workflowId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const paperFetcherId = `blk_paper_fetcher_${Date.now()}`;
  const notificationId = `blk_notification_${Date.now() + 1}`;

  const blocks: WorkflowBlock[] = [
    {
      id: paperFetcherId,
      type: 'paper_fetcher',
      name: 'Paper Fetcher',
      position: { x: 100, y: 200 },
      config: {
        source: 'arxiv',
        maxResults: 3,
        query,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
    {
      id: notificationId,
      type: 'notification',
      name: 'Results',
      position: { x: 400, y: 200 },
      config: {
        title: 'Papers Found',
        type: 'info',
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
    },
  ];

  const connections: WorkflowConnection[] = [
    {
      id: `conn_1_${Date.now()}`,
      sourceBlockId: paperFetcherId,
      sourcePort: 'output',
      targetBlockId: notificationId,
      targetPort: 'input',
    },
  ];

  return {
    id: workflowId,
    userId,
    name: `Quick Paper Search: ${query}`,
    description: `Simple workflow to test paper fetching for "${query}"`,
    blocks,
    connections,
    status: 'draft',
    globalMemory: { query },
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
