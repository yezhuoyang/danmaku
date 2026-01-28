// Background reading worker
// Processes AI reading jobs in the background
import db from '../db.js';
import { fetchPdfFromArxiv, parsePdf } from './pdf-parser.js';
import { segmentSentences } from './sentence-segmenter.js';
import { detectSections, findSectionForPosition } from './section-detector.js';
import { chatCompletion } from './ai-providers/index.js';
import type { Sentence, Section, ProcessedPage, BackgroundJobStatus } from './types.js';

// Worker configuration
const POLL_INTERVAL_MS = 5000;  // Check for new jobs every 5 seconds
const MAX_CONCURRENT_JOBS = 2;  // Max jobs running simultaneously
const PAGE_BATCH_SIZE = 3;      // Pages to process before updating DB

// Track active jobs
const activeJobs = new Map<string, { aborted: boolean }>();

/**
 * Start the background worker
 */
export function startBackgroundWorker(): void {
  console.log('[BackgroundWorker] Starting background reading worker...');

  // Run initial check
  setTimeout(() => processJobs(), 1000);

  // Schedule periodic checks
  setInterval(processJobs, POLL_INTERVAL_MS);
}

/**
 * Process pending jobs
 */
async function processJobs(): Promise<void> {
  // Skip if at capacity
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    return;
  }

  try {
    // Find pending jobs
    const slotsAvailable = MAX_CONCURRENT_JOBS - activeJobs.size;
    const pendingJobs = db.prepare(`
      SELECT * FROM background_reading_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(slotsAvailable) as any[];

    // Also check for jobs to resume (paused or recovering from restart)
    const activeJobIds = Array.from(activeJobs.keys());
    const placeholders = activeJobIds.length > 0
      ? activeJobIds.map(() => '?').join(',')
      : "''";

    const resumableJobs = db.prepare(`
      SELECT * FROM background_reading_jobs
      WHERE status = 'running' AND id NOT IN (${placeholders})
      LIMIT ?
    `).all(...activeJobIds, Math.max(0, slotsAvailable - pendingJobs.length)) as any[];

    const jobsToProcess = [...pendingJobs, ...resumableJobs];

    for (const job of jobsToProcess) {
      if (activeJobs.size >= MAX_CONCURRENT_JOBS) break;

      // Start processing this job
      activeJobs.set(job.id, { aborted: false });
      processJob(job).catch(err => {
        console.error(`[BackgroundWorker] Job ${job.id} failed:`, err);
      }).finally(() => {
        activeJobs.delete(job.id);
      });
    }
  } catch (error) {
    console.error('[BackgroundWorker] Error checking for jobs:', error);
  }
}

/**
 * Process a single reading job
 */
async function processJob(job: any): Promise<void> {
  const jobId = job.id;
  const control = activeJobs.get(jobId)!;

  console.log(`[BackgroundWorker] Starting job ${jobId} for paper ${job.paper_id}`);

  try {
    // Update status to running
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE background_reading_jobs
      SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ?
      WHERE id = ?
    `).run(now, now, jobId);

    // Get paper info
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(job.paper_id) as any;
    if (!paper) {
      throw new Error('Paper not found');
    }

    // Parse PDF if not already done
    let parsedData: { numPages: number; pages: ProcessedPage[] };

    if (job.pdf_parsed_data) {
      parsedData = JSON.parse(job.pdf_parsed_data);
      console.log(`[BackgroundWorker] Using cached parsed data for job ${jobId}`);
    } else {
      console.log(`[BackgroundWorker] Fetching and parsing PDF for job ${jobId}`);

      if (!paper.arxiv_id) {
        throw new Error('Paper does not have an ArXiv ID - cannot fetch PDF');
      }

      const pdfBuffer = await fetchPdfFromArxiv(paper.arxiv_id);
      const pdf = await parsePdf(pdfBuffer);

      // Process each page: segment sentences, detect sections
      const processedPages: ProcessedPage[] = [];
      const allSections = new Map<number, Section[]>();

      for (const page of pdf.pages) {
        const sentences = segmentSentences(page.textItems, page.pageNumber);
        const sections = detectSections(page.textItems, page.pageNumber);

        allSections.set(page.pageNumber, sections);

        // Assign sections to sentences
        for (const sentence of sentences) {
          const section = findSectionForPosition(
            sections,
            sentence.pageNumber,
            sentence.bounds.minY,
            allSections
          );
          if (section) {
            sentence.section = {
              number: section.number,
              title: section.title,
              fullTitle: section.fullTitle,
            };
          }
        }

        processedPages.push({
          pageNumber: page.pageNumber,
          sentences,
          sections,
        });
      }

      parsedData = {
        numPages: pdf.numPages,
        pages: processedPages,
      };

      // Store parsed data for resumption
      db.prepare(`
        UPDATE background_reading_jobs
        SET pdf_parsed_data = ?, total_pages = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(parsedData), parsedData.numPages, Math.floor(Date.now() / 1000), jobId);
    }

    // Decrypt API key
    const apiKey = Buffer.from(job.api_key_encrypted, 'base64').toString('utf-8');

    // Parse workflow config
    const workflowConfig = job.workflow_config_snapshot
      ? JSON.parse(job.workflow_config_snapshot)
      : null;

    // Load existing analysis (for resumption)
    let sentenceAnalysis: Record<string, any> = JSON.parse(job.sentence_analysis || '{}');
    let figureTableAnalysis: Record<string, any> = JSON.parse(job.figure_table_analysis || '{}');
    let totalPromptTokens = job.total_prompt_tokens || 0;
    let totalCompletionTokens = job.total_completion_tokens || 0;
    let debugEntries: any[] = JSON.parse(job.debug_entries || '[]');

    // Get figure/table regions from DB
    const figureTableRegions = db.prepare(`
      SELECT * FROM figure_table_regions WHERE paper_id = ?
    `).all(job.paper_id) as any[];

    // Build figure/table map by page
    const figuresByPage = new Map<number, any[]>();
    for (const region of figureTableRegions) {
      const pageNum = region.page_number;
      if (!figuresByPage.has(pageNum)) {
        figuresByPage.set(pageNum, []);
      }
      figuresByPage.get(pageNum)!.push({
        id: region.id,
        type: region.type,
        label: region.label,
        caption: region.caption,
      });
    }

    // Process pages starting from current_page
    const startPage = job.current_page || 1;

    for (let pageNum = startPage; pageNum <= parsedData.numPages; pageNum++) {
      // Check for abort
      if (control.aborted) {
        console.log(`[BackgroundWorker] Job ${jobId} aborted at page ${pageNum}`);
        db.prepare(`
          UPDATE background_reading_jobs
          SET status = 'paused', current_page = ?, updated_at = ?
          WHERE id = ?
        `).run(pageNum, Math.floor(Date.now() / 1000), jobId);
        return;
      }

      const pageData = parsedData.pages.find(p => p.pageNumber === pageNum);
      const figureTables = figuresByPage.get(pageNum) || [];

      if (!pageData || (pageData.sentences.length === 0 && figureTables.length === 0)) {
        continue;
      }

      console.log(`[BackgroundWorker] Job ${jobId} analyzing page ${pageNum}/${parsedData.numPages}`);

      // Call AI to analyze this page
      try {
        const analysis = await analyzePageWithAI(
          paper,
          pageData.sentences,
          figureTables,
          pageNum,
          parsedData.numPages,
          job.model_id,
          apiKey,
          workflowConfig
        );

        // Accumulate results
        if (analysis.sentences) {
          for (const [idx, data] of Object.entries(analysis.sentences)) {
            const sentenceIdx = parseInt(idx) - 1;
            if (sentenceIdx >= 0 && sentenceIdx < pageData.sentences.length) {
              const sentence = pageData.sentences[sentenceIdx];
              sentenceAnalysis[sentence.id] = data;
            }
          }
        }

        if (analysis.figureTables && figureTables.length > 0) {
          for (const [label, data] of Object.entries(analysis.figureTables)) {
            const ft = figureTables.find(f => f.label === label);
            if (ft) {
              figureTableAnalysis[ft.id] = data;
            }
          }
        }

        totalPromptTokens += analysis.usage?.promptTokens || 0;
        totalCompletionTokens += analysis.usage?.completionTokens || 0;

        // Add debug entries for this page
        if (analysis.debug) {
          const timestamp = new Date().toISOString();
          // Request entry
          debugEntries.push({
            id: `${jobId}-req-${pageNum}`,
            timestamp,
            type: 'request',
            pageNumber: pageNum,
            prompt: analysis.debug.userPrompt,
            systemPrompt: analysis.debug.systemPrompt,
          });
          // Response entry
          debugEntries.push({
            id: `${jobId}-res-${pageNum}`,
            timestamp,
            type: 'response',
            pageNumber: pageNum,
            response: analysis.debug.rawResponse,
            sentenceCount: Object.keys(analysis.sentences || {}).length,
            figureTableCount: Object.keys(analysis.figureTables || {}).length,
            promptTokens: analysis.usage?.promptTokens || 0,
            completionTokens: analysis.usage?.completionTokens || 0,
            duration: analysis.debug.duration,
          });
        }
      } catch (aiError: any) {
        console.error(`[BackgroundWorker] AI error on page ${pageNum}:`, aiError);
        // Add error debug entry
        debugEntries.push({
          id: `${jobId}-err-${pageNum}`,
          timestamp: new Date().toISOString(),
          type: 'error',
          pageNumber: pageNum,
          error: aiError.message || 'Unknown error',
        });
        // Continue with next page instead of failing entire job
      }

      // Update progress periodically
      if (pageNum % PAGE_BATCH_SIZE === 0 || pageNum === parsedData.numPages) {
        const now = Math.floor(Date.now() / 1000);
        const elapsedSeconds = now - (job.started_at || now);
        const avgSecondsPerPage = pageNum > 0 ? elapsedSeconds / pageNum : 10;
        const remainingPages = parsedData.numPages - pageNum;
        const estimatedCompletionAt = now + Math.floor(remainingPages * avgSecondsPerPage);

        // Update background job progress
        db.prepare(`
          UPDATE background_reading_jobs
          SET current_page = ?,
              pages_completed = ?,
              sentence_analysis = ?,
              figure_table_analysis = ?,
              total_prompt_tokens = ?,
              total_completion_tokens = ?,
              estimated_completion_at = ?,
              debug_entries = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          pageNum,
          pageNum,
          JSON.stringify(sentenceAnalysis),
          JSON.stringify(figureTableAnalysis),
          totalPromptTokens,
          totalCompletionTokens,
          estimatedCompletionAt,
          JSON.stringify(debugEntries),
          now,
          jobId
        );

        // Also sync incrementally to ai_agent_history session so UI can show results in real-time
        db.prepare(`
          UPDATE ai_agent_history
          SET sentence_analysis = ?,
              figure_table_analysis = ?,
              total_prompt_tokens = ?,
              total_completion_tokens = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify(sentenceAnalysis),
          JSON.stringify(figureTableAnalysis),
          totalPromptTokens,
          totalCompletionTokens,
          now,
          job.session_id
        );
      }
    }

    // Job completed successfully
    const completedAt = Math.floor(Date.now() / 1000);
    db.prepare(`
      UPDATE background_reading_jobs
      SET status = 'completed',
          current_page = ?,
          pages_completed = ?,
          sentence_analysis = ?,
          figure_table_analysis = ?,
          total_prompt_tokens = ?,
          total_completion_tokens = ?,
          completed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      parsedData.numPages,
      parsedData.numPages,
      JSON.stringify(sentenceAnalysis),
      JSON.stringify(figureTableAnalysis),
      totalPromptTokens,
      totalCompletionTokens,
      completedAt,
      completedAt,
      jobId
    );

    // Copy results to ai_agent_history session
    db.prepare(`
      UPDATE ai_agent_history
      SET sentence_analysis = ?,
          figure_table_analysis = ?,
          total_prompt_tokens = total_prompt_tokens + ?,
          total_completion_tokens = total_completion_tokens + ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(sentenceAnalysis),
      JSON.stringify(figureTableAnalysis),
      totalPromptTokens,
      totalCompletionTokens,
      completedAt,
      job.session_id
    );

    console.log(`[BackgroundWorker] Job ${jobId} completed successfully`);

  } catch (error: any) {
    console.error(`[BackgroundWorker] Job ${jobId} error:`, error);

    const retryCount = (job.retry_count || 0) + 1;
    const maxRetries = job.max_retries || 3;
    const now = Math.floor(Date.now() / 1000);

    if (retryCount < maxRetries) {
      // Schedule for retry
      db.prepare(`
        UPDATE background_reading_jobs
        SET status = 'pending',
            retry_count = ?,
            error_message = ?,
            last_error_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(retryCount, error.message, now, now, jobId);
      console.log(`[BackgroundWorker] Job ${jobId} will retry (attempt ${retryCount + 1}/${maxRetries})`);
    } else {
      // Mark as failed
      db.prepare(`
        UPDATE background_reading_jobs
        SET status = 'failed',
            error_message = ?,
            last_error_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(error.message, now, now, jobId);
      console.log(`[BackgroundWorker] Job ${jobId} failed after ${maxRetries} attempts`);
    }
  }
}

/**
 * Build prompts from workflow config
 */
function buildPromptsFromWorkflow(
  workflowConfig: any | null,
  paper: any,
  sentences: Sentence[],
  figureTables: any[],
  pageNumber: number,
  totalPages: number
): { systemPrompt: string; userPrompt: string } {
  // Default prompts if no workflow config
  const defaultSystemPrompt = `You are an AI research assistant analyzing an academic paper page by page.
Your task is to label each sentence with ONE of these categories:
- "background": Prior work, context, motivation
- "objective": Research goals, hypotheses
- "method": Methodology, approach, algorithm
- "result": Experimental results, findings
- "conclusion": Summary, takeaways
- "claim": Novel claims, contributions
- "limitation": Limitations, future work
- "definition": Definitions, terminology
- "example": Examples, illustrations
- "comparison": Comparisons with other work

Also identify any flags:
- novelty: true if the sentence describes a novel contribution
- correctnessIssue: true if there's a potential logical or factual issue
- consistencyIssue: true if it contradicts other parts of the paper

For figures/tables, use these labels:
- "architecture": System/model architecture diagram
- "results": Experimental results visualization
- "comparison": Comparison with baselines
- "ablation": Ablation study results
- "example": Example inputs/outputs
- "methodology": Method illustration
- "data": Dataset statistics

Respond with a JSON object:
{
  "sentences": {
    "1": { "label": "background", "comment": "Brief explanation if important", "flags": { "novelty": false } },
    ...
  },
  "figureTables": {
    "Figure 1": { "label": "results", "comment": "Description of what it shows", "flags": {} },
    ...
  }
}

Only output valid JSON, no other text.`;

  const sentenceList = sentences.map((s, i) =>
    `[${i + 1}] ${s.section ? `(${s.section.fullTitle || s.section.title}) ` : ''}${s.text}`
  ).join('\n');

  const figureTableList = figureTables.length > 0
    ? figureTables.map(ft => `[${ft.type.toUpperCase()}: ${ft.label}] ${ft.caption || 'No caption'}`).join('\n')
    : '';

  const defaultUserPrompt = `Paper: ${paper.title || 'Unknown'}
Page ${pageNumber} of ${totalPages}

=== SENTENCES ===
${sentenceList || 'No sentences on this page'}

${figureTableList ? `=== FIGURES/TABLES ===\n${figureTableList}` : ''}

Analyze each item and provide labels with brief comments for important points only.`;

  // If no workflow config, use defaults
  if (!workflowConfig) {
    return { systemPrompt: defaultSystemPrompt, userPrompt: defaultUserPrompt };
  }

  // Get level config (sentence level is most common for page-by-page analysis)
  const levelConfig = workflowConfig.levelConfigs?.sentence;

  // JSON output format requirement - always included
  const jsonFormatInstruction = `

IMPORTANT: You must respond with a valid JSON object only. No other text before or after.
The format must be:
{
  "sentences": {
    "1": { "label": "background|objective|method|result|conclusion|claim|limitation|definition|example|comparison", "comment": "Brief explanation if important", "flags": { "novelty": false } },
    ...
  },
  "figureTables": {
    "Figure 1": { "label": "architecture|results|comparison|ablation|example|methodology|data", "comment": "Description", "flags": {} },
    ...
  }
}`;

  // Build system prompt from workflow, adding JSON requirement
  let baseSystemPrompt = levelConfig?.systemPrompt || defaultSystemPrompt;
  // Only add JSON instruction if not already present
  let systemPrompt = baseSystemPrompt.includes('JSON') ? baseSystemPrompt : baseSystemPrompt + jsonFormatInstruction;

  // Build user prompt - handle template variables
  let userPrompt = levelConfig?.userPromptTemplate || defaultUserPrompt;

  // Replace template variables
  userPrompt = userPrompt
    .replace(/\{\{content\}\}/g, sentenceList || 'No sentences on this page')
    .replace(/\{\{context\}\}/g, `Page ${pageNumber} of ${totalPages} from "${paper.title}"`)
    .replace(/\{\{paperTitle\}\}/g, paper.title || 'Unknown')
    .replace(/\{\{pageNumber\}\}/g, String(pageNumber))
    .replace(/\{\{totalPages\}\}/g, String(totalPages));

  // Handle question-guided strategy
  if (workflowConfig.strategy === 'question_guided' && workflowConfig.strategyConfig?.questions) {
    const questions = workflowConfig.strategyConfig.questions;
    if (Array.isArray(questions) && questions.length > 0) {
      const questionsList = questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n');
      userPrompt = userPrompt.replace(/\{\{questions\}\}/g, questionsList);

      // If questions template wasn't in the prompt, append them
      if (!userPrompt.includes(questionsList)) {
        userPrompt += `\n\nQuestions to keep in mind while analyzing:\n${questionsList}\n\nNote if any sentence helps answer these questions.`;
      }
    }
  }

  // Add figures/tables if not already in the template
  if (figureTableList && !userPrompt.includes('FIGURES/TABLES')) {
    userPrompt += `\n\n=== FIGURES/TABLES ===\n${figureTableList}`;
  }

  return { systemPrompt, userPrompt };
}

/**
 * Analyze a page using AI
 */
interface AnalysisResult {
  sentences?: Record<string, any>;
  figureTables?: Record<string, any>;
  usage?: { promptTokens: number; completionTokens: number };
  debug?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    duration: number;
  };
}

async function analyzePageWithAI(
  paper: any,
  sentences: Sentence[],
  figureTables: any[],
  pageNumber: number,
  totalPages: number,
  modelId: string,
  apiKey: string,
  workflowConfig: any | null = null
): Promise<AnalysisResult> {
  const { systemPrompt, userPrompt } = buildPromptsFromWorkflow(
    workflowConfig,
    paper,
    sentences,
    figureTables,
    pageNumber,
    totalPages
  );

  // Get temperature and maxTokens from workflow config or use defaults
  const temperature = workflowConfig?.levelConfigs?.sentence?.temperature ?? 0.3;
  const maxTokens = workflowConfig?.levelConfigs?.sentence?.maxTokens ?? 4000;

  const startTime = Date.now();
  const response = await chatCompletion(
    {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens: maxTokens,
      temperature: temperature,
    },
    { apiKey }
  );
  const duration = Date.now() - startTime;

  // Parse response
  let analysis: any;
  const rawResponse = response.content;
  try {
    let content = response.content.trim();

    // Remove markdown code block markers
    if (content.startsWith('```json')) content = content.slice(7);
    if (content.startsWith('```')) content = content.slice(3);
    if (content.endsWith('```')) content = content.slice(0, -3);
    content = content.trim();

    // Try direct JSON parse first
    try {
      analysis = JSON.parse(content);
    } catch {
      // Try to find JSON object in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON object found');
      }
    }
  } catch (parseError: any) {
    console.warn('[BackgroundWorker] Failed to parse AI response as JSON:', parseError.message);
    // Log a sample of the response for debugging
    console.warn('[BackgroundWorker] Response preview:', rawResponse.substring(0, 200));
    analysis = { sentences: {}, figureTables: {} };
  }

  return {
    sentences: analysis.sentences || {},
    figureTables: analysis.figureTables || {},
    usage: response.usage,
    debug: {
      systemPrompt,
      userPrompt,
      rawResponse,
      duration,
    },
  };
}

/**
 * Cancel a background job
 */
export function cancelBackgroundJob(jobId: string): boolean {
  const control = activeJobs.get(jobId);
  if (control) {
    control.aborted = true;
    return true;
  }

  // If not actively running, mark as cancelled in DB
  const result = db.prepare(`
    UPDATE background_reading_jobs
    SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND status IN ('pending', 'paused')
  `).run(Math.floor(Date.now() / 1000), jobId);

  return result.changes > 0;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): any {
  return db.prepare('SELECT * FROM background_reading_jobs WHERE id = ?').get(jobId);
}
