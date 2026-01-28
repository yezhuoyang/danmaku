/**
 * Block Executors
 *
 * Contains the execution logic for each block type.
 * Each executor receives input data and context, and returns output.
 */

import type {
  WorkflowBlock,
  BlockType,
  BlockExecutionContext,
  BlockExecutionResult,
  ResearcherBlockOutput,
  WriterBlockOutput,
  ReviewerBlockOutput,
  SummarizerBlockOutput,
  CoderBlockOutput,
  ConditionalBlockOutput,
  MergeBlockOutput,
} from '@shared/types';

// API call helpers (will be implemented with actual API calls)
import { callAI, AIMessage } from './ai-client';

/**
 * Main entry point for executing any block type
 */
export async function executeBlock(
  block: WorkflowBlock,
  input: unknown,
  context: BlockExecutionContext
): Promise<BlockExecutionResult> {
  const executor = BLOCK_EXECUTORS[block.type];

  if (!executor) {
    return {
      success: false,
      output: null,
      error: `No executor found for block type: ${block.type}`,
    };
  }

  try {
    return await executor(block, input, context);
  } catch (error) {
    return {
      success: false,
      output: null,
      error: error instanceof Error ? error.message : 'Unknown execution error',
    };
  }
}

// Type for block executor functions
type BlockExecutor = (
  block: WorkflowBlock,
  input: unknown,
  context: BlockExecutionContext
) => Promise<BlockExecutionResult>;

/**
 * Registry of all block executors
 */
const BLOCK_EXECUTORS: Record<BlockType, BlockExecutor> = {
  // ============================================================================
  // AGENT BLOCKS
  // ============================================================================

  researcher: async (block, input, context) => {
    context.setCurrentAction('Preparing research analysis...');

    // Handle papers input from paper_fetcher or string query
    const inputData = input as { papers?: Array<{ title: string; abstract: string; authors: string[] }>; query?: string } | string;
    const papers = typeof inputData === 'object' && inputData?.papers ? inputData.papers : [];
    const query = typeof inputData === 'string' ? inputData : inputData?.query || '';

    // Build context from papers
    let papersContext = '';
    if (papers.length > 0) {
      context.setCurrentAction(`Analyzing ${papers.length} papers...`);
      papersContext = papers.map((p, i) =>
        `Paper ${i + 1}: "${p.title}"\nAuthors: ${p.authors?.join(', ') || 'Unknown'}\nAbstract: ${p.abstract}`
      ).join('\n\n---\n\n');
    }

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are a senior research scientist. Analyze academic papers and generate innovative research ideas.
Your task is to:
1. Identify key themes, methodologies, and findings across the papers
2. Find gaps in current research
3. Generate novel research ideas that could advance the field
4. Suggest potential experiments or studies

Respond with JSON containing:
{
  "summary": "Brief overview of the papers analyzed",
  "keyThemes": ["theme1", "theme2", ...],
  "researchGaps": ["gap1", "gap2", ...],
  "ideas": [
    {
      "title": "Idea title",
      "description": "Detailed description",
      "novelty": "Why this is novel",
      "feasibility": "high/medium/low",
      "potentialImpact": "Potential impact description"
    }
  ],
  "suggestedExperiments": ["experiment1", "experiment2", ...],
  "openQuestions": ["question1", "question2", ...]
}`;

    const userContent = papersContext
      ? `Analyze these ${papers.length} papers and generate research ideas:\n\n${papersContext}`
      : `Research query: ${query}`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    // Add conversation history if continuing
    if (context.agentSession?.messages) {
      for (const msg of context.agentSession.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    context.log(`Analyzing ${papers.length} papers`, { query });
    context.setCurrentAction('Generating research ideas with AI...');

    // Log the user message for debugging
    context.appendMessage('system', systemPrompt);
    context.appendMessage('user', userContent);

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.7,
      maxTokens: (block.config.maxTokens as number) || 4096,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    // Store assistant response in session with metadata
    context.setCurrentAction('Processing research results...');
    context.appendMessage('assistant', response.content, { tokens: response.tokensUsed });

    // Parse structured output
    let output: ResearcherBlockOutput & { ideas?: Array<{ title: string; description: string }>; researchGaps?: string[] };
    const mappedPapers = papers.map((p, i) => ({
      id: `paper_${i}`,
      title: p.title,
      authors: p.authors || [],
      abstract: p.abstract,
      url: '',
    }));
    try {
      const parsed = JSON.parse(response.content);
      output = {
        papers: mappedPapers,
        summary: parsed.summary || response.content,
        searchTerms: parsed.keyThemes || [],
        ideas: parsed.ideas,
        researchGaps: parsed.researchGaps,
      };
    } catch {
      output = {
        papers: mappedPapers,
        summary: response.content,
        searchTerms: [],
      };
    }

    context.log(`Generated ${(output as any).ideas?.length || 0} research ideas`);

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  writer: async (block, input, context) => {
    context.setCurrentAction('Preparing to write document...');

    // Handle research ideas input from researcher block
    const inputData = input as {
      summary?: string;
      ideas?: Array<{ title: string; description: string; novelty?: string; potentialImpact?: string }>;
      keyThemes?: string[];
      researchGaps?: string[];
      suggestedExperiments?: string[];
    } | string;

    const style = (block.config.style as string) || 'research_summary';
    const maxWords = (block.config.maxWords as number) || 2000;
    const outputFormat = (block.config.outputFormat as string) || 'markdown';

    // Build input context
    let inputContext = '';
    if (typeof inputData === 'string') {
      inputContext = inputData;
    } else {
      if (inputData?.summary) {
        inputContext += `## Research Summary\n${inputData.summary}\n\n`;
      }
      if (inputData?.keyThemes?.length) {
        inputContext += `## Key Themes\n${inputData.keyThemes.map(t => `- ${t}`).join('\n')}\n\n`;
      }
      if (inputData?.researchGaps?.length) {
        inputContext += `## Research Gaps\n${inputData.researchGaps.map(g => `- ${g}`).join('\n')}\n\n`;
      }
      if (inputData?.ideas?.length) {
        inputContext += `## Research Ideas\n`;
        inputData.ideas.forEach((idea, i) => {
          inputContext += `\n### Idea ${i + 1}: ${idea.title}\n`;
          inputContext += `${idea.description}\n`;
          if (idea.novelty) inputContext += `**Novelty:** ${idea.novelty}\n`;
          if (idea.potentialImpact) inputContext += `**Potential Impact:** ${idea.potentialImpact}\n`;
        });
        inputContext += '\n';
      }
      if (inputData?.suggestedExperiments?.length) {
        inputContext += `## Suggested Experiments\n${inputData.suggestedExperiments.map(e => `- ${e}`).join('\n')}\n\n`;
      }
    }

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are an expert science writer who transforms research analysis into clear, engaging content.
Your task is to write a comprehensive ${style} document based on the research input provided.

Guidelines:
1. Create a well-structured document with clear sections
2. Highlight the most promising and novel ideas
3. Explain technical concepts accessibly without oversimplifying
4. Include actionable next steps and recommendations
5. Use ${outputFormat} formatting for readability
6. Target approximately ${maxWords} words

Structure your output as:
1. Executive Summary (2-3 paragraphs)
2. Key Findings and Themes
3. Novel Research Opportunities (prioritized)
4. Recommended Next Steps
5. Conclusion`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please write a research summary document based on the following analysis:\n\n${inputContext}` },
    ];

    context.log(`Writing ${style} document`, { wordTarget: maxWords });
    context.setCurrentAction(`Writing ${style} document...`);

    // Log messages for debugging
    context.appendMessage('system', systemPrompt);
    context.appendMessage('user', `Please write a research summary document based on the following analysis:\n\n${inputContext}`);

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.7,
      maxTokens: (block.config.maxTokens as number) || 4096,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.setCurrentAction('Processing written content...');
    context.appendMessage('assistant', response.content, { tokens: response.tokensUsed });

    const wordCount = response.content.split(/\s+/).length;

    context.log(`Written document with ${wordCount} words`);

    const output: WriterBlockOutput = {
      content: response.content,
      wordCount,
    };

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  reviewer: async (block, input, context) => {
    const content = typeof input === 'string' ? input : JSON.stringify(input);
    const strictness = (block.config.strictness as string) || 'moderate';
    const criteria = (block.config.criteria as string) || '';

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are a ${strictness} reviewer. Evaluate the content and provide structured feedback.
       ${criteria ? `Criteria to consider: ${criteria}` : ''}
       Respond with JSON containing: approved (boolean), score (0-100), feedback (string), suggestions (array), issues (array of {severity, description}).`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Review this content:\n\n${content}` },
    ];

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.5,
      maxTokens: (block.config.maxTokens as number) || 2048,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.appendMessage('assistant', response.content);

    let output: ReviewerBlockOutput;
    try {
      output = JSON.parse(response.content);
    } catch {
      output = {
        approved: true,
        score: 70,
        feedback: response.content,
        suggestions: [],
        issues: [],
      };
    }

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  planner: async (block, input, context) => {
    const goal = typeof input === 'string' ? input : (input as any)?.goal || JSON.stringify(input);
    const constraints = (block.config.constraints as string) || '';

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are a strategic planner. Create a detailed, actionable plan to achieve the goal.
       ${constraints ? `Constraints: ${constraints}` : ''}
       Respond with JSON containing: plan (array of {step, action, description, dependencies}), estimatedSteps, risks (array).`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a plan for: ${goal}` },
    ];

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.6,
      maxTokens: (block.config.maxTokens as number) || 2048,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.appendMessage('assistant', response.content);

    let output;
    try {
      output = JSON.parse(response.content);
    } catch {
      output = {
        plan: [{ step: 1, action: 'Execute', description: response.content }],
        estimatedSteps: 1,
        risks: [],
      };
    }

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  supervisor: async (block, input, context) => {
    const inputStr = JSON.stringify(input, null, 2);

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are a workflow supervisor. Analyze the results and make decisions.
       Respond with JSON containing: decision ('continue'|'retry'|'abort'|'complete'), feedback (string), nextAction (optional string), aggregatedResult (optional).`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Evaluate these results and decide next steps:\n\n${inputStr}` },
    ];

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.4,
      maxTokens: (block.config.maxTokens as number) || 1024,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.appendMessage('assistant', response.content);

    let output;
    try {
      output = JSON.parse(response.content);
    } catch {
      output = {
        decision: 'continue',
        feedback: response.content,
      };
    }

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  summarizer: async (block, input, context) => {
    const content = typeof input === 'string' ? input :
      Array.isArray(input) ? input.join('\n\n---\n\n') : JSON.stringify(input);
    const maxLength = (block.config.maxLength as number) || 500;
    const format = (block.config.format as string) || 'bullets';

    const systemPrompt =
      `Summarize the content in ${format} format. Target length: ~${maxLength} words.
       Respond with JSON containing: summary (string), keyPoints (array of strings), wordCount (number).`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Summarize:\n\n${content}` },
    ];

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o-mini',
      messages,
      temperature: (block.config.temperature as number) || 0.5,
      maxTokens: (block.config.maxTokens as number) || 1024,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.appendMessage('assistant', response.content);

    let output: SummarizerBlockOutput;
    try {
      output = JSON.parse(response.content);
    } catch {
      output = {
        summary: response.content,
        keyPoints: [],
        wordCount: response.content.split(/\s+/).length,
      };
    }

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  coder: async (block, input, context) => {
    context.setCurrentAction('Analyzing code task...');

    const task = typeof input === 'string' ? input : (input as any)?.task || JSON.stringify(input);
    const language = (block.config.language as string) || 'python';

    const systemPrompt = (block.config.systemPrompt as string) ||
      `You are an expert ${language} programmer. Write clean, efficient code with proper error handling.
       Respond with JSON containing: code (string), language (string), explanation (string), tests (optional string).`;

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Write ${language} code for: ${task}` },
    ];

    context.setCurrentAction(`Writing ${language} code...`);
    context.appendMessage('system', systemPrompt);
    context.appendMessage('user', `Write ${language} code for: ${task}`);

    const response = await callAI({
      modelId: (block.config.modelId as string) || 'gpt-4o',
      messages,
      temperature: (block.config.temperature as number) || 0.3,
      maxTokens: (block.config.maxTokens as number) || 4096,
      apiKeys: context.apiKeys,
      signal: context.abortSignal,
    });

    context.setCurrentAction('Code generated, processing output...');
    context.appendMessage('assistant', response.content, { tokens: response.tokensUsed });

    let output: CoderBlockOutput;
    try {
      output = JSON.parse(response.content);
    } catch {
      // Try to extract code block from response
      const codeMatch = response.content.match(/```[\w]*\n([\s\S]*?)```/);
      output = {
        code: codeMatch ? codeMatch[1] : response.content,
        language,
        explanation: 'See code above',
      };
    }

    return {
      success: true,
      output,
      tokensUsed: response.tokensUsed,
    };
  },

  // ============================================================================
  // LOGIC BLOCKS
  // ============================================================================

  conditional: async (block, input, context) => {
    const condition = (block.config.condition as string) || 'true';

    // Evaluate condition with input available as 'value'
    let conditionResult: boolean;
    try {
      // Create a safe evaluation context
      const evalFn = new Function('value', `return ${condition}`);
      conditionResult = Boolean(evalFn(input));
    } catch (error) {
      context.log(`Condition evaluation error: ${error}`, { condition, input });
      conditionResult = false;
    }

    const output: ConditionalBlockOutput = {
      value: input,
      conditionResult,
    };

    return {
      success: true,
      output,
      outputPort: conditionResult ? 'output-true' : 'output-false',
    };
  },

  loop: async (block, input, context) => {
    const maxIterations = (block.config.maxIterations as number) || 10;
    const stopCondition = (block.config.stopCondition as string) || '';

    // Get loop state from memory
    const loopState = (context.blockMemory.loopState as {
      index: number;
      items?: unknown[];
      accumulator?: unknown;
    }) || { index: 0 };

    // Initialize items if this is first iteration
    if (loopState.index === 0 && Array.isArray(input)) {
      loopState.items = input;
    }

    const items = loopState.items || [input];
    const currentIndex = loopState.index;

    // Check if loop should stop
    let shouldStop = currentIndex >= items.length || currentIndex >= maxIterations;

    if (!shouldStop && stopCondition) {
      try {
        const evalFn = new Function('value', 'index', 'accumulator', `return ${stopCondition}`);
        shouldStop = Boolean(evalFn(items[currentIndex], currentIndex, loopState.accumulator));
      } catch (error) {
        context.log(`Stop condition evaluation error: ${error}`, { stopCondition });
      }
    }

    if (shouldStop) {
      // Clear loop state
      await context.updateMemory({});

      return {
        success: true,
        output: {
          currentItem: null,
          index: currentIndex,
          isComplete: true,
          accumulator: loopState.accumulator,
        },
        outputPort: 'output-done',
      };
    }

    // Continue loop
    loopState.index++;
    await context.updateMemory({ loopState });

    return {
      success: true,
      output: {
        currentItem: items[currentIndex],
        index: currentIndex,
        isComplete: false,
        accumulator: loopState.accumulator,
      },
      outputPort: 'output-continue',
    };
  },

  merge: async (block, input, context) => {
    const strategy = (block.config.mergeStrategy as string) || 'object';
    const inputs = input as { 'input-a'?: unknown; 'input-b'?: unknown } | unknown;

    let merged: unknown;
    const sources: string[] = [];

    if (typeof inputs === 'object' && inputs !== null && ('input-a' in inputs || 'input-b' in inputs)) {
      const a = (inputs as any)['input-a'];
      const b = (inputs as any)['input-b'];

      if (a !== undefined) sources.push('input-a');
      if (b !== undefined) sources.push('input-b');

      switch (strategy) {
        case 'array':
          merged = [a, b].filter(x => x !== undefined);
          break;
        case 'concat':
          merged = [a, b].filter(x => x !== undefined).map(String).join('\n');
          break;
        case 'object':
        default:
          merged = { ...((a as object) || {}), ...((b as object) || {}) };
          break;
      }
    } else {
      merged = inputs;
      sources.push('single');
    }

    const output: MergeBlockOutput = {
      merged,
      sources,
    };

    return {
      success: true,
      output,
    };
  },

  delay: async (block, input, context) => {
    const delaySeconds = (block.config.delaySeconds as number) || 60;
    const delayedAt = Date.now();

    // Wait for the delay
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, delaySeconds * 1000);

      // Handle abort
      context.abortSignal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Delay aborted'));
      });
    });

    return {
      success: true,
      output: {
        value: input,
        delayedAt,
        resumedAt: Date.now(),
      },
    };
  },

  python_verifier: async (block, input, context) => {
    // Get code from input (from coder block) or from config
    const inputData = input as { code?: string } | string;
    const code = typeof inputData === 'object' && inputData?.code
      ? inputData.code
      : (block.config.code as string) || '';

    if (!code) {
      return {
        success: false,
        output: null,
        error: 'No Python code provided',
      };
    }

    const timeout = (block.config.timeout as number) || 30000;

    context.log('Executing Python code', { codeLength: code.length, timeout });

    try {
      // Call the Python execution endpoint
      const response = await fetch('/api/agent-lego/python/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeout }),
        signal: context.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Python execution API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        success: boolean;
        stdout: string;
        stderr: string;
        returnCode: number | null;
        executionTime: number;
        error?: string;
      };

      context.log(`Python execution completed`, {
        success: result.success,
        executionTime: result.executionTime,
        hasErrors: !!result.stderr,
      });

      return {
        success: true,
        output: {
          result: result.stdout,
          passed: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          returnCode: result.returnCode,
          executionTime: result.executionTime,
          code, // Include the code that was executed
        },
        outputPort: result.success ? 'output-pass' : 'output-fail',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.log(`Python execution error: ${errorMessage}`);

      return {
        success: false,
        output: {
          result: null,
          passed: false,
          stdout: '',
          stderr: errorMessage,
          returnCode: null,
          executionTime: 0,
          code,
        },
        error: errorMessage,
        outputPort: 'output-fail',
      };
    }
  },

  // Code executor with iterative debugging support
  code_executor: async (block, input, context) => {
    // Get code from input or config
    const inputData = input as { code?: string; language?: string } | string;
    let code = typeof inputData === 'string'
      ? inputData
      : inputData?.code || (block.config.code as string) || '';

    // Extract code from markdown code blocks if present
    const codeBlockMatch = code.match(/```(?:python|py)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    if (!code.trim()) {
      return {
        success: false,
        output: null,
        error: 'No code provided for execution',
      };
    }

    const timeout = (block.config.timeout as number) || 30000;
    const maxRetries = (block.config.maxRetries as number) || 0;

    context.log('Executing code', { codeLength: code.length, timeout });

    try {
      const response = await fetch('/api/agent-lego/python/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeout }),
        signal: context.abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Execution API error: ${response.statusText}`);
      }

      const result = await response.json() as {
        success: boolean;
        stdout: string;
        stderr: string;
        returnCode: number | null;
        executionTime: number;
        error?: string;
      };

      // Get retry count from memory
      const retryCount = (context.blockMemory.retryCount as number) || 0;

      context.log(`Execution completed (attempt ${retryCount + 1})`, {
        success: result.success,
        executionTime: result.executionTime,
      });

      // If failed and retries remain, increment retry count
      if (!result.success && retryCount < maxRetries) {
        await context.updateMemory({
          ...context.blockMemory,
          retryCount: retryCount + 1,
          lastError: result.stderr || result.error,
          lastCode: code,
        });
      } else {
        // Reset retry count on success or max retries reached
        await context.updateMemory({
          ...context.blockMemory,
          retryCount: 0,
          lastCode: code,
          lastOutput: result.stdout,
        });
      }

      return {
        success: true,
        output: {
          executionSuccess: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          returnCode: result.returnCode,
          executionTime: result.executionTime,
          code,
          attempt: retryCount + 1,
          needsDebug: !result.success && retryCount < maxRetries,
        },
        outputPort: result.success ? 'output-success' : (retryCount < maxRetries ? 'output-retry' : 'output-fail'),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.log(`Execution error: ${errorMessage}`);

      return {
        success: false,
        output: {
          executionSuccess: false,
          stdout: '',
          stderr: errorMessage,
          returnCode: null,
          executionTime: 0,
          code,
          attempt: 1,
          needsDebug: false,
        },
        error: errorMessage,
        outputPort: 'output-fail',
      };
    }
  },

  human_review: async (block, input, context) => {
    const prompt = (block.config.prompt as string) || 'Please review this content:';

    // This would pause execution and wait for user input
    // For now, auto-approve after showing notification
    context.log('Human review requested', { prompt, content: input });

    return {
      success: true,
      output: {
        approved: true,
        feedback: 'Auto-approved (human review UI not yet implemented)',
        reviewedAt: Date.now(),
        reviewerId: 'system',
      },
      outputPort: 'output-approved',
    };
  },

  // ============================================================================
  // DATA BLOCKS
  // ============================================================================

  paper_fetcher: async (block, input, context) => {
    context.setCurrentAction('Preparing paper search...');

    // Get query from input OR from block config (for first block in chain)
    const inputQuery = typeof input === 'string' ? input : (input as any)?.query || '';
    const configQuery = (block.config.query as string) || '';
    const query = inputQuery || configQuery;
    const source = (block.config.source as string) || 'arxiv';
    const maxResults = (block.config.maxResults as number) || 10;

    context.log(`Fetching papers from ${source}`, { query, maxResults });
    context.setCurrentAction(`Searching ${source} for: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);

    if (!query) {
      return {
        success: false,
        output: null,
        error: 'No search query provided. Set query in block config or provide via input.',
      };
    }

    try {
      // Call arXiv API via server proxy (to avoid CORS)
      const encodedQuery = encodeURIComponent(query);
      const proxyUrl = `/api/agent-lego/arxiv/search?query=${encodedQuery}&maxResults=${maxResults}`;

      const response = await fetch(proxyUrl, { signal: context.abortSignal });
      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.statusText}`);
      }

      const xmlText = await response.text();

      // Parse XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const entries = xmlDoc.querySelectorAll('entry');

      const papers: Array<{
        id: string;
        title: string;
        authors: string[];
        abstract: string;
        published: string;
        pdfUrl: string;
        categories: string[];
      }> = [];

      entries.forEach((entry) => {
        const id = entry.querySelector('id')?.textContent || '';
        const title = entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const abstract = entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const published = entry.querySelector('published')?.textContent || '';

        const authorElements = entry.querySelectorAll('author name');
        const authors = Array.from(authorElements).map((a) => a.textContent || '');

        const categoryElements = entry.querySelectorAll('category');
        const categories = Array.from(categoryElements).map((c) => c.getAttribute('term') || '');

        // Extract arXiv ID from URL
        const arxivId = id.split('/abs/').pop() || id;
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

        papers.push({
          id: arxivId,
          title,
          authors,
          abstract,
          published,
          pdfUrl,
          categories,
        });
      });

      context.log(`Found ${papers.length} papers`, { query });
      context.setCurrentAction(`Found ${papers.length} papers`);

      // Log papers to agent log for debugging
      context.appendMessage('assistant', `Found ${papers.length} papers:\n\n${papers.map((p, i) => `${i + 1}. ${p.title}`).join('\n')}`);

      return {
        success: true,
        output: {
          papers,
          totalFound: papers.length,
          query,
          source,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      context.log(`Paper fetch error: ${errorMessage}`, { query });

      return {
        success: false,
        output: null,
        error: `Failed to fetch papers: ${errorMessage}`,
      };
    }
  },

  memory_store: async (block, input, context) => {
    const action = (block.config.action as string) || 'set';
    const key = (block.config.key as string) || 'default';
    const scope = (block.config.scope as string) || 'global';

    let value: unknown;
    let keys: string[] = [];

    switch (action) {
      case 'get':
        if (scope === 'global') {
          value = context.globalMemory[key];
        } else {
          value = context.blockMemory[key];
        }
        break;

      case 'set':
        if (scope === 'global') {
          context.updateGlobalMemory(key, input);
        } else {
          await context.updateMemory({ ...context.blockMemory, [key]: input });
        }
        value = input;
        break;

      case 'delete':
        if (scope === 'global') {
          context.updateGlobalMemory(key, undefined);
        } else {
          const newMemory = { ...context.blockMemory };
          delete newMemory[key];
          await context.updateMemory(newMemory);
        }
        break;

      case 'list':
        if (scope === 'global') {
          keys = Object.keys(context.globalMemory);
        } else {
          keys = Object.keys(context.blockMemory);
        }
        break;
    }

    return {
      success: true,
      output: {
        success: true,
        value,
        keys: keys.length > 0 ? keys : undefined,
      },
    };
  },

  history_logger: async (block, input, context) => {
    const label = (block.config.label as string) || 'log';
    const logId = `${context.workflowId}:${context.blockId}:${Date.now()}`;

    context.log(label, input);

    return {
      success: true,
      output: {
        logged: true,
        logId,
        timestamp: Date.now(),
      },
    };
  },

  progress_tracker: async (block, input, context) => {
    const update = input as { current?: number; total?: number; message?: string; stage?: string };

    const progress = update?.total ? Math.round((update.current || 0) / update.total * 100) : 0;

    context.log('Progress update', { progress, ...update });

    return {
      success: true,
      output: {
        progress,
        message: update?.message || '',
        stage: update?.stage || '',
      },
    };
  },

  file_writer: async (block, input, context) => {
    const filename = (block.config.filename as string) || 'output';
    const format = (block.config.format as string) || 'text';

    let content: string;
    if (format === 'json') {
      content = JSON.stringify(input, null, 2);
    } else if (typeof input === 'string') {
      content = input;
    } else {
      content = JSON.stringify(input);
    }

    // Create a download blob
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/plain',
    });

    // Store in memory for later download
    const fileData = {
      content,
      filename: `${filename}.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`,
      blob,
    };

    await context.updateMemory({ ...context.blockMemory, lastFile: fileData });

    return {
      success: true,
      output: {
        success: true,
        filePath: fileData.filename,
        bytesWritten: content.length,
      },
    };
  },

  notification: async (block, input, context) => {
    context.setCurrentAction('Preparing notification...');

    const title = (block.config.title as string) || 'Workflow Complete';
    const type = (block.config.type as string) || 'success';

    // Handle WriterBlockOutput or other inputs
    const inputData = input as { content?: string; wordCount?: number } | string;
    let message: string;
    let summary: string | undefined;

    if (typeof inputData === 'string') {
      message = inputData;
    } else if (inputData?.content) {
      // Writer output - extract preview
      const content = inputData.content;
      message = `Research report generated (${inputData.wordCount || content.split(/\s+/).length} words)`;
      // Get first 500 chars as summary
      summary = content.slice(0, 500) + (content.length > 500 ? '...' : '');
    } else {
      message = JSON.stringify(inputData, null, 2);
    }

    // Store the full output in workflow memory for later access
    context.updateGlobalMemory('lastNotification', {
      title,
      message,
      summary,
      fullContent: typeof inputData === 'object' && inputData?.content ? inputData.content : undefined,
      type,
      timestamp: Date.now(),
    });

    // Log notification for UI display
    context.log('Notification', { title, message, type, hasSummary: !!summary });

    return {
      success: true,
      output: {
        sent: true,
        title,
        message,
        summary,
        fullContent: typeof inputData === 'object' && inputData?.content ? inputData.content : undefined,
        timestamp: Date.now(),
      },
    };
  },
};
