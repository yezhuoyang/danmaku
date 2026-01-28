/**
 * Workflow Templates
 *
 * Pre-configured workflow templates that users can load in the Agent Lego builder.
 * Each template provides a complete workflow with blocks and connections.
 */

import type { Workflow, WorkflowBlock, WorkflowConnection, PoliticalAgentBlock, PoliticalWorkflow, PowerRelation } from '@shared/types';
import { ROLE_DEFINITIONS } from './politics';

export interface WorkflowTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'coding' | 'analysis' | 'automation';
  icon: string;
  createWorkflow: (userId: string) => Workflow | PoliticalWorkflow;
}

/**
 * Research Pipeline Template (Political Architecture)
 *
 * A hierarchical agent workflow that:
 * 1. Commander (L10) receives user's research topic
 * 2. Delegates to Researcher (L4) to analyze papers/gather information
 * 3. Delegates to Writer (L4) to generate research summary
 * 4. Commander synthesizes final response
 */
function createResearchPipelineWorkflow(userId: string): PoliticalWorkflow {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = Date.now();

  const commanderId = `blk_commander_${ts}`;
  const researcherId = `blk_researcher_${ts + 1}`;
  const writerId = `blk_writer_${ts + 2}`;

  // Helper to create political agent blocks
  function createPoliticalBlock(
    id: string,
    role: keyof typeof ROLE_DEFINITIONS,
    name: string,
    position: { x: number; y: number },
    systemPromptOverride?: string
  ): PoliticalAgentBlock {
    const roleDef = ROLE_DEFINITIONS[role];
    return {
      id,
      type: 'supervisor',
      name,
      position,
      config: {
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: systemPromptOverride || roleDef.systemPromptTemplate,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
      role,
      authorityLevel: roleDef.authorityLevel,
      pendingCommands: [],
      commandHistory: [],
      reportHistory: [],
      subordinateIds: [],
      peerIds: [],
      politicalStatus: 'idle',
      inbox: [],
      outbox: [],
    };
  }

  const blocks: PoliticalAgentBlock[] = [
    createPoliticalBlock(
      commanderId,
      'commander',
      'Research Commander',
      { x: 100, y: 200 },
      `You are the RESEARCH COMMANDER (Level 10), orchestrating a research pipeline.

YOUR ROLE:
- Receive a research topic from the user
- First delegate to the Researcher to gather and analyze information
- Then delegate to the Writer to create a comprehensive summary
- Synthesize findings into a final research report

YOUR SUBORDINATES:
- Researcher (Level 4): Use for searching papers, gathering information, analyzing data
- Writer (Level 4): Use for generating the final research summary/report

YOU CANNOT execute research tasks yourself - you must delegate.

When delegating, output JSON like:
{
  "delegations": [
    { "subordinateId": "<block_id>", "instruction": "<clear research task>" }
  ]
}

After receiving all reports, synthesize a final comprehensive research summary for the user.`
    ),
    createPoliticalBlock(
      researcherId,
      'researcher',
      'Researcher',
      { x: 450, y: 100 },
      `You are a RESEARCHER (Level 4), specializing in academic research and analysis.

YOUR ROLE:
- Search for and analyze academic papers on the given topic
- Identify key findings, methodologies, and contributions
- Summarize important concepts and recent developments
- Provide well-sourced, factual analysis

WHEN RECEIVING A COMMAND:
1. Acknowledge the research task
2. Analyze the topic comprehensively
3. Report your findings with key insights
4. Include relevant citations and confidence levels

Be thorough and academic in your approach.`
    ),
    createPoliticalBlock(
      writerId,
      'writer',
      'Writer',
      { x: 450, y: 300 },
      `You are a WRITER (Level 4), specializing in academic and research writing.

YOUR ROLE:
- Generate high-quality research summaries
- Create well-structured reports with clear sections
- Synthesize complex information into readable content
- Follow academic writing conventions

WHEN RECEIVING A COMMAND:
1. Acknowledge the writing task
2. Draft a comprehensive, well-organized document
3. Report back with the completed work
4. Use proper markdown formatting with sections

Aim for clarity, accuracy, and scholarly tone.`
    ),
  ];

  // Power relations
  const powerRelations: PowerRelation[] = [
    {
      id: `rel_cmd_res_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: researcherId,
      subordinateRole: 'researcher',
      type: 'command',
    },
    {
      id: `rel_cmd_wrt_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: writerId,
      subordinateRole: 'writer',
      type: 'command',
    },
  ];

  // Visual connections
  const connections: WorkflowConnection[] = [
    {
      id: `conn_cmd_res_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: researcherId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_wrt_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: writerId,
      targetPort: 'input',
    },
  ];

  // Update Commander's subordinateIds
  blocks[0].subordinateIds = [researcherId, writerId];

  return {
    id: workflowId,
    userId,
    name: 'Research Pipeline',
    description: 'Commander delegates to Researcher for analysis and Writer for summaries.',
    blocks: blocks as WorkflowBlock[],
    connections,
    status: 'draft',
    globalMemory: {},
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPoliticalMode: true,
    politicalBlocks: blocks,
    powerRelations,
    commandHistory: [],
    reportHistory: [],
    messageHistory: [],
    violations: [],
    rootCommanderId: commanderId,
    currentChainOfCommand: [],
  };
}

/**
 * Code Execution Pipeline Template (Political Architecture)
 *
 * A hierarchical agent workflow that:
 * 1. Commander (L10) receives a coding task
 * 2. Delegates to Coder (L4) to write Python code
 * 3. Code is automatically executed in Python environment
 * 4. If debugging needed, Commander delegates back to Coder
 * 5. Delegates to Writer (L4) for final report
 * 6. Commander synthesizes final response
 */
function createCodeExecutionWorkflow(userId: string): PoliticalWorkflow {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = Date.now();

  const commanderId = `blk_commander_${ts}`;
  const coderId = `blk_coder_${ts + 1}`;
  const writerId = `blk_writer_${ts + 2}`;

  // Helper to create political agent blocks
  function createPoliticalBlock(
    id: string,
    role: keyof typeof ROLE_DEFINITIONS,
    name: string,
    position: { x: number; y: number },
    systemPromptOverride?: string
  ): PoliticalAgentBlock {
    const roleDef = ROLE_DEFINITIONS[role];
    return {
      id,
      type: 'supervisor',
      name,
      position,
      config: {
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: systemPromptOverride || roleDef.systemPromptTemplate,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
      role,
      authorityLevel: roleDef.authorityLevel,
      pendingCommands: [],
      commandHistory: [],
      reportHistory: [],
      subordinateIds: [],
      peerIds: [],
      politicalStatus: 'idle',
      inbox: [],
      outbox: [],
    };
  }

  const blocks: PoliticalAgentBlock[] = [
    createPoliticalBlock(
      commanderId,
      'commander',
      'Code Commander',
      { x: 100, y: 200 },
      `You are the CODE COMMANDER (Level 10), orchestrating a code execution pipeline.

YOUR ROLE:
- Receive coding tasks from the user
- Delegate to the Coder to write Python code
- Review code execution results (the Coder's code is automatically executed)
- If execution fails, delegate back to Coder for debugging
- Once code works, delegate to Writer for a technical report
- Synthesize findings into a final response

YOUR SUBORDINATES:
- Coder (Level 4): Writes Python code. Code is AUTOMATICALLY EXECUTED after they report.
- Writer (Level 4): Writes technical reports based on results

YOU CANNOT write code yourself - you must delegate.

When delegating, output JSON like:
{
  "delegations": [
    { "subordinateId": "<block_id>", "instruction": "<clear coding task>" }
  ]
}

IMPORTANT: When delegating to Coder with errors, include the error message so they can debug.

After successful code execution and report, synthesize a final response for the user.`
    ),
    createPoliticalBlock(
      coderId,
      'coder',
      'Coder',
      { x: 450, y: 100 },
      `You are a CODER (Level 4), specializing in writing and debugging Python code.

YOUR ROLE:
- Write clean, functional Python code
- Debug and fix errors when provided
- Implement algorithms and data structures
- Your code will be AUTOMATICALLY EXECUTED after you report

WHEN RECEIVING A COMMAND:
1. Acknowledge the coding task
2. Write the code (ALWAYS wrap in \`\`\`python blocks)
3. Explain what the code does
4. Report back with the implementation

IMPORTANT CODE GUIDELINES:
- Write complete, runnable Python code
- Include all necessary imports
- Use matplotlib for visualizations (save to file, don't plt.show())
- Print results clearly for analysis
- Handle potential errors gracefully

If debugging, explain what you changed and why.`
    ),
    createPoliticalBlock(
      writerId,
      'writer',
      'Writer',
      { x: 450, y: 300 },
      `You are a WRITER (Level 4), specializing in technical writing.

YOUR ROLE:
- Generate technical reports based on code execution results
- Document methodology, findings, and conclusions
- Structure content clearly with proper sections
- Use markdown formatting

WHEN RECEIVING A COMMAND:
1. Acknowledge the writing task
2. Draft a comprehensive technical report
3. Include: summary, methodology, results, conclusions
4. Report back with the completed document

Be precise and technical in your writing style.`
    ),
  ];

  // Power relations
  const powerRelations: PowerRelation[] = [
    {
      id: `rel_cmd_cod_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: coderId,
      subordinateRole: 'coder',
      type: 'command',
    },
    {
      id: `rel_cmd_wrt_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: writerId,
      subordinateRole: 'writer',
      type: 'command',
    },
  ];

  // Visual connections
  const connections: WorkflowConnection[] = [
    {
      id: `conn_cmd_cod_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: coderId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_wrt_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: writerId,
      targetPort: 'input',
    },
  ];

  // Update Commander's subordinateIds
  blocks[0].subordinateIds = [coderId, writerId];

  return {
    id: workflowId,
    userId,
    name: 'Code Execution Pipeline',
    description: 'Commander delegates to Coder for Python code (auto-executed) and Writer for reports.',
    blocks: blocks as WorkflowBlock[],
    connections,
    status: 'draft',
    globalMemory: {},
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPoliticalMode: true,
    politicalBlocks: blocks,
    powerRelations,
    commandHistory: [],
    reportHistory: [],
    messageHistory: [],
    violations: [],
    rootCommanderId: commanderId,
    currentChainOfCommand: [],
  };
}

/**
 * Advanced Research + Code Pipeline Template (Political Architecture)
 *
 * A hierarchical agent workflow that combines research and coding:
 * 1. Commander (L10) receives a research + implementation task
 * 2. Delegates to Researcher (L4) to analyze topic/papers
 * 3. Delegates to Coder (L4) to implement based on research
 * 4. Code is automatically executed
 * 5. Delegates to Writer (L4) for comprehensive report
 * 6. Commander synthesizes final response
 */
function createAdvancedResearchCodeWorkflow(userId: string): PoliticalWorkflow {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = Date.now();

  const commanderId = `blk_commander_${ts}`;
  const researcherId = `blk_researcher_${ts + 1}`;
  const coderId = `blk_coder_${ts + 2}`;
  const writerId = `blk_writer_${ts + 3}`;
  const reviewerId = `blk_reviewer_${ts + 4}`;

  // Helper to create political agent blocks
  function createPoliticalBlock(
    id: string,
    role: keyof typeof ROLE_DEFINITIONS,
    name: string,
    position: { x: number; y: number },
    systemPromptOverride?: string
  ): PoliticalAgentBlock {
    const roleDef = ROLE_DEFINITIONS[role];
    return {
      id,
      type: 'supervisor',
      name,
      position,
      config: {
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: systemPromptOverride || roleDef.systemPromptTemplate,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
      role,
      authorityLevel: roleDef.authorityLevel,
      pendingCommands: [],
      commandHistory: [],
      reportHistory: [],
      subordinateIds: [],
      peerIds: [],
      politicalStatus: 'idle',
      inbox: [],
      outbox: [],
    };
  }

  const blocks: PoliticalAgentBlock[] = [
    createPoliticalBlock(
      commanderId,
      'commander',
      'Research & Code Commander',
      { x: 100, y: 250 },
      `You are the RESEARCH & CODE COMMANDER (Level 10), orchestrating a comprehensive research and implementation pipeline.

YOUR ROLE:
- Receive research topics that need both analysis AND implementation
- First delegate to Researcher for literature review and analysis
- Then delegate to Coder to implement ideas based on research
- Review code execution results (Coder's code is auto-executed)
- If code fails, delegate back to Coder for debugging
- Once code works, delegate to Writer for comprehensive report
- Optionally use Reviewer for quality checking
- Synthesize everything into a final response

YOUR SUBORDINATES:
- Researcher (Level 4): For literature review, analysis, gathering information
- Coder (Level 4): For implementing ideas in Python (code is AUTO-EXECUTED)
- Writer (Level 4): For comprehensive research reports
- Reviewer (Level 5): For quality checking and validation

YOU CANNOT do research or write code yourself - you must delegate.

When delegating, output JSON like:
{
  "delegations": [
    { "subordinateId": "<block_id>", "instruction": "<clear task>" }
  ]
}

WORKFLOW SEQUENCE:
1. Researcher analyzes the topic
2. Coder implements based on research findings
3. If code fails, Coder debugs
4. Once successful, Writer creates report
5. (Optional) Reviewer validates quality

After all reports received successfully, synthesize a final comprehensive response.`
    ),
    createPoliticalBlock(
      researcherId,
      'researcher',
      'Researcher',
      { x: 450, y: 100 },
      `You are a RESEARCHER (Level 4), specializing in academic research and analysis.

YOUR ROLE:
- Search for and analyze papers/information on the given topic
- Identify key concepts, methodologies, and findings
- Propose testable hypotheses or experiments
- Suggest implementation approaches

WHEN RECEIVING A COMMAND:
1. Acknowledge the research task
2. Conduct thorough analysis
3. Report findings with:
   - Key concepts identified
   - Relevant papers/sources
   - Proposed hypothesis or experiment
   - Suggested implementation approach
4. Be clear about what could be coded/tested

Your analysis informs what the Coder will implement.`
    ),
    createPoliticalBlock(
      coderId,
      'coder',
      'Coder',
      { x: 450, y: 250 },
      `You are a CODER (Level 4), specializing in implementing research ideas in Python.

YOUR ROLE:
- Implement ideas from research analysis
- Write clean, functional Python code
- Debug errors when provided execution results
- Your code is AUTOMATICALLY EXECUTED after you report

WHEN RECEIVING A COMMAND:
1. Acknowledge the coding task
2. Write Python code (ALWAYS wrap in \`\`\`python blocks)
3. Explain what the code does
4. Report back with implementation

CODE GUIDELINES:
- Write complete, runnable Python
- Include all imports
- Use numpy, pandas, matplotlib as needed
- Save visualizations to files (no plt.show())
- Print clear results
- Handle errors gracefully

If debugging, explain what was wrong and what you fixed.`
    ),
    createPoliticalBlock(
      writerId,
      'writer',
      'Writer',
      { x: 450, y: 400 },
      `You are a WRITER (Level 4), specializing in comprehensive research reports.

YOUR ROLE:
- Create comprehensive research reports
- Combine literature review with implementation results
- Structure content with clear academic sections
- Use proper markdown formatting

WHEN RECEIVING A COMMAND:
1. Acknowledge the writing task
2. Draft a comprehensive report with:
   - Literature Review
   - Research Methodology
   - Implementation Details
   - Results and Analysis
   - Conclusions and Future Work
3. Report back with completed document

Be thorough and maintain an academic tone.`
    ),
    createPoliticalBlock(
      reviewerId,
      'reviewer',
      'Reviewer',
      { x: 450, y: 550 },
      `You are a REVIEWER (Level 5), specializing in quality assurance.

YOUR ROLE:
- Review and validate work from other agents
- Check for accuracy, completeness, quality
- Identify issues and provide constructive feedback
- Recommend approval or revision

WHEN RECEIVING A COMMAND:
1. Acknowledge the review task
2. Systematically evaluate the work
3. Report findings with:
   - Quality assessment
   - Issues identified
   - Recommendations
   - Approve/Revise recommendation

Be thorough but constructive.`
    ),
  ];

  // Power relations
  const powerRelations: PowerRelation[] = [
    {
      id: `rel_cmd_res_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: researcherId,
      subordinateRole: 'researcher',
      type: 'command',
    },
    {
      id: `rel_cmd_cod_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: coderId,
      subordinateRole: 'coder',
      type: 'command',
    },
    {
      id: `rel_cmd_wrt_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: writerId,
      subordinateRole: 'writer',
      type: 'command',
    },
    {
      id: `rel_cmd_rev_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: reviewerId,
      subordinateRole: 'reviewer',
      type: 'command',
    },
  ];

  // Visual connections
  const connections: WorkflowConnection[] = [
    {
      id: `conn_cmd_res_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: researcherId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_cod_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: coderId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_wrt_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: writerId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_rev_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: reviewerId,
      targetPort: 'input',
    },
  ];

  // Update Commander's subordinateIds
  blocks[0].subordinateIds = [researcherId, coderId, writerId, reviewerId];

  return {
    id: workflowId,
    userId,
    name: 'Research + Code (Advanced)',
    description: 'Full team: Commander delegates to Researcher, Coder (auto-executed), Writer, and Reviewer.',
    blocks: blocks as WorkflowBlock[],
    connections,
    status: 'draft',
    globalMemory: {},
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPoliticalMode: true,
    politicalBlocks: blocks,
    powerRelations,
    commandHistory: [],
    reportHistory: [],
    messageHistory: [],
    violations: [],
    rootCommanderId: commanderId,
    currentChainOfCommand: [],
  };
}

/**
 * Political Command Chain Template
 *
 * A hierarchical agent governance workflow:
 * 1. Commander (L10) receives user instruction
 * 2. Commander delegates to appropriate subordinates:
 *    - Researcher (L4) for information gathering
 *    - Writer (L4) for content generation
 *    - Reviewer (L5) for quality control
 *    - Coder (L4) for code tasks
 * 3. Each subordinate reports back to Commander
 * 4. Commander synthesizes final response
 */
function createPoliticalCommandChainWorkflow(userId: string): PoliticalWorkflow {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const ts = Date.now();

  const commanderId = `blk_commander_${ts}`;
  const researcherId = `blk_researcher_${ts + 1}`;
  const writerId = `blk_writer_${ts + 2}`;
  const reviewerId = `blk_reviewer_${ts + 3}`;
  const coderId = `blk_coder_${ts + 4}`;

  // Helper to create political agent blocks
  function createPoliticalBlock(
    id: string,
    role: keyof typeof ROLE_DEFINITIONS,
    name: string,
    position: { x: number; y: number },
    systemPromptOverride?: string
  ): PoliticalAgentBlock {
    const roleDef = ROLE_DEFINITIONS[role];
    return {
      id,
      type: 'supervisor', // Base type for all political agents
      name,
      position,
      config: {
        modelId: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 4096,
        systemPrompt: systemPromptOverride || roleDef.systemPromptTemplate,
      },
      status: 'idle',
      memory: {},
      executionCount: 0,
      totalTokensUsed: 0,
      // Political properties
      role,
      authorityLevel: roleDef.authorityLevel,
      pendingCommands: [],
      commandHistory: [],
      reportHistory: [],
      subordinateIds: [],
      peerIds: [],
      politicalStatus: 'idle',
      inbox: [],
      outbox: [],
    };
  }

  const blocks: PoliticalAgentBlock[] = [
    createPoliticalBlock(
      commanderId,
      'commander',
      'Commander',
      { x: 100, y: 300 },
      `You are the COMMANDER (Level 10), the top-level orchestrator of this agent team.

YOUR ROLE:
- Receive instructions from the user
- Analyze what needs to be done
- Delegate tasks to your subordinates based on their specializations
- Synthesize their reports into a final cohesive response

YOUR SUBORDINATES:
- Researcher (Level 4): Use for gathering information, analyzing papers, web searches
- Writer (Level 4): Use for generating text content, reports, summaries
- Reviewer (Level 5): Use for quality checking, validation, critique
- Coder (Level 4): Use for writing code, technical implementations

YOU CANNOT execute tasks yourself - you must delegate.

When delegating, output JSON like:
{
  "delegations": [
    { "subordinateId": "<block_id>", "instruction": "<clear task>" }
  ]
}

After receiving reports, synthesize a final response for the user.`
    ),
    createPoliticalBlock(
      researcherId,
      'researcher',
      'Researcher',
      { x: 450, y: 100 },
      `You are a RESEARCHER (Level 4), specializing in information gathering and analysis.

YOUR ROLE:
- Search for and analyze information
- Read and summarize papers and documents
- Gather relevant data from available sources
- Provide factual, well-sourced findings

WHEN RECEIVING A COMMAND:
1. Acknowledge the task
2. Execute the research
3. Report your findings clearly and concisely
4. Include sources and confidence levels

Always be thorough but focused. Report back to your superior with actionable insights.`
    ),
    createPoliticalBlock(
      writerId,
      'writer',
      'Writer',
      { x: 450, y: 250 },
      `You are a WRITER (Level 4), specializing in content generation.

YOUR ROLE:
- Generate high-quality written content
- Create reports, summaries, documentation
- Adapt tone and style to requirements
- Structure content clearly and logically

WHEN RECEIVING A COMMAND:
1. Acknowledge the task
2. Draft the content
3. Report back with the completed work
4. Note any assumptions or areas needing clarification

Always aim for clarity, accuracy, and appropriate tone.`
    ),
    createPoliticalBlock(
      reviewerId,
      'reviewer',
      'Reviewer',
      { x: 450, y: 400 },
      `You are a REVIEWER (Level 5), specializing in quality control and validation.

YOUR ROLE:
- Review and critique work products
- Check for accuracy, completeness, and quality
- Identify issues, errors, or improvements
- Provide constructive feedback

WHEN RECEIVING A COMMAND:
1. Acknowledge the review task
2. Systematically evaluate the work
3. Report findings with specific issues and recommendations
4. Rate quality and suggest whether to approve or revise

Be thorough but fair. Your reviews help ensure team quality.`
    ),
    createPoliticalBlock(
      coderId,
      'coder',
      'Coder',
      { x: 450, y: 550 },
      `You are a CODER (Level 4), specializing in writing and debugging code.

YOUR ROLE:
- Write clean, functional code
- Debug and fix issues
- Implement algorithms and data structures
- Follow best practices and coding standards

WHEN RECEIVING A COMMAND:
1. Acknowledge the coding task
2. Write the code (wrap in \`\`\`python or appropriate language blocks)
3. Explain what the code does
4. Report back with the implementation

Always include error handling and clear comments. Test mentally before reporting.`
    ),
  ];

  // Power relations: Commander can command all others
  const powerRelations: PowerRelation[] = [
    {
      id: `rel_cmd_res_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: researcherId,
      subordinateRole: 'researcher',
      type: 'command',
    },
    {
      id: `rel_cmd_wrt_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: writerId,
      subordinateRole: 'writer',
      type: 'command',
    },
    {
      id: `rel_cmd_rev_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: reviewerId,
      subordinateRole: 'reviewer',
      type: 'command',
    },
    {
      id: `rel_cmd_cod_${ts}`,
      superiorAgentId: commanderId,
      superiorRole: 'commander',
      subordinateAgentId: coderId,
      subordinateRole: 'coder',
      type: 'command',
    },
  ];

  // Visual connections (matching power relations)
  const connections: WorkflowConnection[] = [
    {
      id: `conn_cmd_res_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: researcherId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_wrt_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: writerId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_rev_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: reviewerId,
      targetPort: 'input',
    },
    {
      id: `conn_cmd_cod_${ts}`,
      sourceBlockId: commanderId,
      sourcePort: 'output',
      targetBlockId: coderId,
      targetPort: 'input',
    },
  ];

  // Update Commander's subordinateIds
  blocks[0].subordinateIds = [researcherId, writerId, reviewerId, coderId];

  return {
    id: workflowId,
    userId,
    name: 'Political Command Chain',
    description: 'A hierarchical agent team with Commander delegating to Researcher, Writer, Reviewer, and Coder.',
    blocks: blocks as WorkflowBlock[],
    connections,
    status: 'draft',
    globalMemory: {},
    runHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Political workflow properties
    isPoliticalMode: true,
    politicalBlocks: blocks,
    powerRelations,
    commandHistory: [],
    reportHistory: [],
    messageHistory: [],
    violations: [],
    rootCommanderId: commanderId,
    currentChainOfCommand: [],
  };
}

/**
 * All available workflow templates - ALL use Political Architecture
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplateInfo[] = [
  {
    id: 'political-command-chain',
    name: 'General Purpose Team',
    description: 'Commander + Researcher, Writer, Reviewer, Coder. Handles any task.',
    category: 'automation',
    icon: 'Crown',
    createWorkflow: createPoliticalCommandChainWorkflow,
  },
  {
    id: 'research-pipeline',
    name: 'Research Team',
    description: 'Commander + Researcher, Writer. Focused on analysis and summaries.',
    category: 'research',
    icon: 'FileSearch',
    createWorkflow: createResearchPipelineWorkflow,
  },
  {
    id: 'code-execution',
    name: 'Coding Team',
    description: 'Commander + Coder (auto-execute), Writer. Focused on code tasks.',
    category: 'coding',
    icon: 'Terminal',
    createWorkflow: createCodeExecutionWorkflow,
  },
  {
    id: 'advanced-research-code',
    name: 'Full Research & Code Team',
    description: 'Commander + Researcher, Coder, Writer, Reviewer. Complete pipeline.',
    category: 'research',
    icon: 'Blocks',
    createWorkflow: createAdvancedResearchCodeWorkflow,
  },
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): WorkflowTemplateInfo | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.id === id);
}

/**
 * Create a workflow from a template
 */
export function createWorkflowFromTemplate(templateId: string, userId: string): Workflow | null {
  const template = getTemplateById(templateId);
  if (!template) return null;
  return template.createWorkflow(userId);
}
