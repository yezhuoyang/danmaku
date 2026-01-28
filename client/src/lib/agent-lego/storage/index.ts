import { openDB, IDBPDatabase } from 'idb';
import type {
  Workflow,
  WorkflowAgentSession,
  ExecutionLog,
  EncryptedApiKey,
  LocalKernelConfig,
  Artifact,
  WorkflowEvent,
  AgentTask,
  Blackboard,
  MergeRequest,
  Workspace,
  ArtifactType,
  DEFAULT_MERGE_RULES,
  PrivateMemoryLog,
  PrivateMemoryLogEntry,
  PublicMemoryLog,
  PublicMemoryLogEntry,
  AgentRole,
} from '@shared/types';

const DB_NAME = 'agent-lego';
const DB_VERSION = 3;  // Bumped for memory log stores

// Block memory entry type
interface BlockMemoryEntry {
  id: string;  // `${workflowId}:${blockId}`
  workflowId: string;
  blockId: string;
  memory: Record<string, unknown>;
  updatedAt: number;
}

// Agent session entry type
interface AgentSessionEntry {
  id: string;  // `${workflowId}:${blockId}`
  workflowId: string;
  blockId: string;
  session: WorkflowAgentSession;
  updatedAt: number;
}

class AgentLegoStorage {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Workflows store - full workflow definitions
        if (!db.objectStoreNames.contains('workflows')) {
          db.createObjectStore('workflows', { keyPath: 'id' });
        }

        // Block memory store - per-block persistent memory
        if (!db.objectStoreNames.contains('blockMemory')) {
          const memoryStore = db.createObjectStore('blockMemory', { keyPath: 'id' });
          memoryStore.createIndex('byWorkflow', 'workflowId');
        }

        // Agent sessions store - conversation history per agent block
        if (!db.objectStoreNames.contains('agentSessions')) {
          const sessionStore = db.createObjectStore('agentSessions', { keyPath: 'id' });
          sessionStore.createIndex('byWorkflow', 'workflowId');
        }

        // Execution logs store - detailed logs (auto-pruned)
        if (!db.objectStoreNames.contains('executionLogs')) {
          const logsStore = db.createObjectStore('executionLogs', { keyPath: 'id' });
          logsStore.createIndex('byWorkflow', 'workflowId');
          logsStore.createIndex('byTimestamp', 'timestamp');
        }

        // API keys store - encrypted API keys
        if (!db.objectStoreNames.contains('apiKeys')) {
          db.createObjectStore('apiKeys', { keyPath: 'id' });
        }

        // Local kernel config
        if (!db.objectStoreNames.contains('localKernelConfig')) {
          db.createObjectStore('localKernelConfig', { keyPath: 'id' });
        }

        // ================================================================
        // V2: Multi-agent collaboration stores
        // ================================================================

        // Artifacts store - typed objects agents produce and consume
        if (!db.objectStoreNames.contains('artifacts')) {
          const artifactsStore = db.createObjectStore('artifacts', { keyPath: 'id' });
          artifactsStore.createIndex('byWorkflow', 'workflowId');
          artifactsStore.createIndex('byType', 'type');
          artifactsStore.createIndex('byStatus', 'status');
          artifactsStore.createIndex('byCreator', 'metadata.createdBy');
        }

        // Workflow events store - append-only provenance log
        if (!db.objectStoreNames.contains('workflowEvents')) {
          const eventsStore = db.createObjectStore('workflowEvents', { keyPath: 'id' });
          eventsStore.createIndex('byWorkflow', 'workflowId');
          eventsStore.createIndex('byTimestamp', 'timestamp');
          eventsStore.createIndex('byType', 'eventType');
          eventsStore.createIndex('byAgent', 'agentId');
        }

        // Tasks store - agent inbox/outbox
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('byWorkflow', 'workflowId');
          tasksStore.createIndex('byAgent', 'assignedAgentId');
          tasksStore.createIndex('byStatus', 'status');
          tasksStore.createIndex('byPriority', 'priority');
        }

        // Blackboard store - current truth / working memory
        if (!db.objectStoreNames.contains('blackboards')) {
          const blackboardStore = db.createObjectStore('blackboards', { keyPath: 'id' });
          blackboardStore.createIndex('byWorkflow', 'workflowId');
        }

        // Merge requests store - controlled blackboard updates
        if (!db.objectStoreNames.contains('mergeRequests')) {
          const mrStore = db.createObjectStore('mergeRequests', { keyPath: 'id' });
          mrStore.createIndex('byWorkflow', 'workflowId');
          mrStore.createIndex('byStatus', 'status');
          mrStore.createIndex('byProposer', 'proposedBy');
        }

        // Workspaces store - top-level container
        if (!db.objectStoreNames.contains('workspaces')) {
          const workspaceStore = db.createObjectStore('workspaces', { keyPath: 'id' });
          workspaceStore.createIndex('byWorkflow', 'workflowId');
        }

        // ================================================================
        // V3: Memory Log stores
        // ================================================================

        // Private memory logs - per agent personal memory
        if (!db.objectStoreNames.contains('privateMemoryLogs')) {
          const privateStore = db.createObjectStore('privateMemoryLogs', { keyPath: 'id' });
          privateStore.createIndex('byWorkflow', 'workflowId');
          privateStore.createIndex('byAgent', 'agentId');
        }

        // Public memory logs - shared workflow-wide memory
        if (!db.objectStoreNames.contains('publicMemoryLogs')) {
          const publicStore = db.createObjectStore('publicMemoryLogs', { keyPath: 'workflowId' });
        }
      }
    });
  }

  private ensureDb(): IDBPDatabase {
    if (!this.db) {
      throw new Error('AgentLegoStorage not initialized. Call init() first.');
    }
    return this.db;
  }

  // ============================================================================
  // WORKFLOW OPERATIONS
  // ============================================================================

  async saveWorkflow(workflow: Workflow): Promise<void> {
    const db = this.ensureDb();
    await db.put('workflows', {
      ...workflow,
      updatedAt: Date.now(),
    });
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const db = this.ensureDb();
    return db.get('workflows', id);
  }

  async listWorkflows(): Promise<Workflow[]> {
    const db = this.ensureDb();
    const workflows = await db.getAll('workflows');
    // Sort by updatedAt descending
    return workflows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteWorkflow(id: string): Promise<void> {
    const db = this.ensureDb();

    // Delete the workflow
    await db.delete('workflows', id);

    // Delete associated block memory
    const memoryKeys = await db.getAllKeysFromIndex('blockMemory', 'byWorkflow', id);
    for (const key of memoryKeys) {
      await db.delete('blockMemory', key);
    }

    // Delete associated agent sessions
    const sessionKeys = await db.getAllKeysFromIndex('agentSessions', 'byWorkflow', id);
    for (const key of sessionKeys) {
      await db.delete('agentSessions', key);
    }

    // Delete associated logs
    const logKeys = await db.getAllKeysFromIndex('executionLogs', 'byWorkflow', id);
    for (const key of logKeys) {
      await db.delete('executionLogs', key);
    }
  }

  // ============================================================================
  // BLOCK MEMORY OPERATIONS
  // ============================================================================

  async saveBlockMemory(workflowId: string, blockId: string, memory: Record<string, unknown>): Promise<void> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    const entry: BlockMemoryEntry = {
      id,
      workflowId,
      blockId,
      memory,
      updatedAt: Date.now(),
    };
    await db.put('blockMemory', entry);
  }

  async getBlockMemory(workflowId: string, blockId: string): Promise<Record<string, unknown> | undefined> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    const entry = await db.get('blockMemory', id) as BlockMemoryEntry | undefined;
    return entry?.memory;
  }

  async clearBlockMemory(workflowId: string, blockId: string): Promise<void> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    await db.delete('blockMemory', id);
  }

  // ============================================================================
  // AGENT SESSION OPERATIONS
  // ============================================================================

  async saveAgentSession(workflowId: string, blockId: string, session: WorkflowAgentSession): Promise<void> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    const entry: AgentSessionEntry = {
      id,
      workflowId,
      blockId,
      session,
      updatedAt: Date.now(),
    };
    await db.put('agentSessions', entry);
  }

  async getAgentSession(workflowId: string, blockId: string): Promise<WorkflowAgentSession | undefined> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    const entry = await db.get('agentSessions', id) as AgentSessionEntry | undefined;
    return entry?.session;
  }

  async clearAgentSession(workflowId: string, blockId: string): Promise<void> {
    const db = this.ensureDb();
    const id = `${workflowId}:${blockId}`;
    await db.delete('agentSessions', id);
  }

  // ============================================================================
  // EXECUTION LOG OPERATIONS
  // ============================================================================

  async addLog(log: Omit<ExecutionLog, 'id'>): Promise<void> {
    const db = this.ensureDb();
    const fullLog: ExecutionLog = {
      ...log,
      id: `${log.workflowId}:${log.timestamp}:${Math.random().toString(36).slice(2, 9)}`,
    };
    await db.add('executionLogs', fullLog);
  }

  async getLogs(workflowId: string, limit: number = 100): Promise<ExecutionLog[]> {
    const db = this.ensureDb();
    const logs = await db.getAllFromIndex('executionLogs', 'byWorkflow', workflowId);
    // Sort by timestamp descending and limit
    return logs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async pruneOldLogs(olderThanDays: number = 7): Promise<number> {
    const db = this.ensureDb();
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

    // Get all logs older than cutoff
    const tx = db.transaction('executionLogs', 'readwrite');
    const index = tx.store.index('byTimestamp');
    const range = IDBKeyRange.upperBound(cutoffTime);

    let deletedCount = 0;
    let cursor = await index.openCursor(range);

    while (cursor) {
      await cursor.delete();
      deletedCount++;
      cursor = await cursor.continue();
    }

    await tx.done;
    return deletedCount;
  }

  // ============================================================================
  // API KEY OPERATIONS (Encrypted)
  // ============================================================================

  async saveApiKey(provider: string, encryptedKey: string, iv: string): Promise<void> {
    const db = this.ensureDb();
    const entry: EncryptedApiKey = {
      id: provider,
      encryptedKey,
      iv,
      createdAt: Date.now(),
    };
    await db.put('apiKeys', entry);
  }

  async getApiKey(provider: string): Promise<EncryptedApiKey | undefined> {
    const db = this.ensureDb();
    return db.get('apiKeys', provider);
  }

  async deleteApiKey(provider: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('apiKeys', provider);
  }

  async listApiKeyProviders(): Promise<string[]> {
    const db = this.ensureDb();
    const keys = await db.getAllKeys('apiKeys');
    return keys as string[];
  }

  // Simple API key storage for demo (uses localStorage, not encrypted)
  // For production, use the encrypted methods above
  async saveApiKeys(keys: Record<string, string>): Promise<void> {
    localStorage.setItem('agent-lego-api-keys', JSON.stringify(keys));
  }

  async getApiKeys(): Promise<Record<string, string>> {
    const stored = localStorage.getItem('agent-lego-api-keys');
    return stored ? JSON.parse(stored) : {};
  }

  // ============================================================================
  // LOCAL KERNEL CONFIG
  // ============================================================================

  async saveLocalKernelConfig(config: Omit<LocalKernelConfig, 'id'>): Promise<void> {
    const db = this.ensureDb();
    await db.put('localKernelConfig', { ...config, id: 'default' });
  }

  async getLocalKernelConfig(): Promise<LocalKernelConfig | undefined> {
    const db = this.ensureDb();
    return db.get('localKernelConfig', 'default');
  }

  // ============================================================================
  // EXPORT / IMPORT
  // ============================================================================

  async exportWorkflow(id: string): Promise<Blob> {
    const workflow = await this.getWorkflow(id);
    if (!workflow) {
      throw new Error(`Workflow ${id} not found`);
    }

    // Get all associated data
    const db = this.ensureDb();

    // Get block memory for all blocks
    const blockMemoryEntries = await db.getAllFromIndex('blockMemory', 'byWorkflow', id);
    const blockMemory: Record<string, Record<string, unknown>> = {};
    for (const entry of blockMemoryEntries as BlockMemoryEntry[]) {
      blockMemory[entry.blockId] = entry.memory;
    }

    // Get agent sessions for all blocks
    const sessionEntries = await db.getAllFromIndex('agentSessions', 'byWorkflow', id);
    const agentSessions: Record<string, WorkflowAgentSession> = {};
    for (const entry of sessionEntries as AgentSessionEntry[]) {
      agentSessions[entry.blockId] = entry.session;
    }

    const exportData = {
      version: 1,
      exportedAt: Date.now(),
      workflow,
      blockMemory,
      agentSessions,
    };

    const json = JSON.stringify(exportData, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  async importWorkflow(file: File): Promise<Workflow> {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.version || !data.workflow) {
      throw new Error('Invalid workflow export file');
    }

    const workflow = data.workflow as Workflow;

    // Generate new ID to avoid conflicts
    const newId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const oldId = workflow.id;
    workflow.id = newId;
    workflow.createdAt = Date.now();
    workflow.updatedAt = Date.now();
    workflow.lastSyncedAt = undefined;

    // Update block IDs to avoid conflicts
    const blockIdMap: Record<string, string> = {};
    for (const block of workflow.blocks) {
      const newBlockId = `blk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      blockIdMap[block.id] = newBlockId;
      block.id = newBlockId;
    }

    // Update connection references
    for (const conn of workflow.connections) {
      conn.id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      conn.sourceBlockId = blockIdMap[conn.sourceBlockId] || conn.sourceBlockId;
      conn.targetBlockId = blockIdMap[conn.targetBlockId] || conn.targetBlockId;
    }

    // Save workflow
    await this.saveWorkflow(workflow);

    // Import block memory
    if (data.blockMemory) {
      for (const [oldBlockId, memory] of Object.entries(data.blockMemory)) {
        const newBlockId = blockIdMap[oldBlockId] || oldBlockId;
        await this.saveBlockMemory(newId, newBlockId, memory as Record<string, unknown>);
      }
    }

    // Import agent sessions
    if (data.agentSessions) {
      for (const [oldBlockId, session] of Object.entries(data.agentSessions)) {
        const newBlockId = blockIdMap[oldBlockId] || oldBlockId;
        await this.saveAgentSession(newId, newBlockId, session as WorkflowAgentSession);
      }
    }

    return workflow;
  }

  // ============================================================================
  // ARTIFACT OPERATIONS
  // ============================================================================

  async saveArtifact(artifact: Artifact): Promise<void> {
    const db = this.ensureDb();
    await db.put('artifacts', {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        updatedAt: Date.now(),
      },
    });
  }

  async getArtifact(id: string): Promise<Artifact | undefined> {
    const db = this.ensureDb();
    return db.get('artifacts', id);
  }

  async getArtifactsByWorkflow(workflowId: string): Promise<Artifact[]> {
    const db = this.ensureDb();
    return db.getAllFromIndex('artifacts', 'byWorkflow', workflowId);
  }

  async getArtifactsByType(workflowId: string, type: ArtifactType): Promise<Artifact[]> {
    const db = this.ensureDb();
    const all = await db.getAllFromIndex('artifacts', 'byWorkflow', workflowId);
    return all.filter(a => a.type === type);
  }

  async deleteArtifact(id: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('artifacts', id);
  }

  async searchArtifacts(workflowId: string, query: string): Promise<Artifact[]> {
    const artifacts = await this.getArtifactsByWorkflow(workflowId);
    const lowerQuery = query.toLowerCase();
    return artifacts.filter(a =>
      a.title.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(a.content).toLowerCase().includes(lowerQuery) ||
      a.metadata.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  // ============================================================================
  // WORKFLOW EVENT OPERATIONS
  // ============================================================================

  async addEvent(event: Omit<WorkflowEvent, 'id'>): Promise<string> {
    const db = this.ensureDb();
    const id = `evt_${event.workflowId}_${event.timestamp}_${Math.random().toString(36).slice(2, 9)}`;
    const fullEvent: WorkflowEvent = { ...event, id };
    await db.add('workflowEvents', fullEvent);
    return id;
  }

  async getEvents(workflowId: string, options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    agentId?: string;
    since?: number;
  }): Promise<WorkflowEvent[]> {
    const db = this.ensureDb();
    let events = await db.getAllFromIndex('workflowEvents', 'byWorkflow', workflowId);

    // Apply filters
    if (options?.eventType) {
      events = events.filter(e => e.eventType === options.eventType);
    }
    if (options?.agentId) {
      events = events.filter(e => e.agentId === options.agentId);
    }
    if (options?.since) {
      const sinceTimestamp = options.since;
      events = events.filter(e => e.timestamp >= sinceTimestamp);
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return events.slice(offset, offset + limit);
  }

  async getEventsSince(workflowId: string, timestamp: number): Promise<WorkflowEvent[]> {
    return this.getEvents(workflowId, { since: timestamp });
  }

  // ============================================================================
  // TASK OPERATIONS
  // ============================================================================

  async saveTask(task: AgentTask): Promise<void> {
    const db = this.ensureDb();
    await db.put('tasks', task);
  }

  async getTask(id: string): Promise<AgentTask | undefined> {
    const db = this.ensureDb();
    return db.get('tasks', id);
  }

  async getTasksByWorkflow(workflowId: string): Promise<AgentTask[]> {
    const db = this.ensureDb();
    return db.getAllFromIndex('tasks', 'byWorkflow', workflowId);
  }

  async getTasksForAgent(agentId: string): Promise<AgentTask[]> {
    const db = this.ensureDb();
    return db.getAllFromIndex('tasks', 'byAgent', agentId);
  }

  async getPendingTasks(workflowId: string): Promise<AgentTask[]> {
    const tasks = await this.getTasksByWorkflow(workflowId);
    return tasks.filter(t => t.status === 'pending' || t.status === 'assigned');
  }

  async deleteTask(id: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('tasks', id);
  }

  // ============================================================================
  // BLACKBOARD OPERATIONS
  // ============================================================================

  async saveBlackboard(blackboard: Blackboard): Promise<void> {
    const db = this.ensureDb();
    await db.put('blackboards', {
      ...blackboard,
      lastUpdatedAt: Date.now(),
      version: (blackboard.version || 0) + 1,
    });
  }

  async getBlackboard(workflowId: string): Promise<Blackboard | undefined> {
    const db = this.ensureDb();
    // Blackboard ID is always 'workspace' per workflow
    const id = `workspace:${workflowId}`;
    return db.get('blackboards', id);
  }

  async createBlackboard(workflowId: string, problemStatement: string = ''): Promise<Blackboard> {
    const blackboard: Blackboard = {
      id: `workspace:${workflowId}`,
      workflowId,
      problemStatement,
      assumptions: [],
      constraints: [],
      claims: [],
      openQuestions: [],
      hypotheses: [],
      experimentQueue: [],
      draftOutline: [],
      lastUpdatedAt: Date.now(),
      version: 1,
    };
    await this.saveBlackboard(blackboard);
    return blackboard;
  }

  // ============================================================================
  // MERGE REQUEST OPERATIONS
  // ============================================================================

  async saveMergeRequest(mr: MergeRequest): Promise<void> {
    const db = this.ensureDb();
    await db.put('mergeRequests', mr);
  }

  async getMergeRequest(id: string): Promise<MergeRequest | undefined> {
    const db = this.ensureDb();
    return db.get('mergeRequests', id);
  }

  async getPendingMergeRequests(workflowId: string): Promise<MergeRequest[]> {
    const db = this.ensureDb();
    const all = await db.getAllFromIndex('mergeRequests', 'byWorkflow', workflowId);
    return all.filter(mr => mr.status === 'pending');
  }

  async getMergeRequestsByWorkflow(workflowId: string): Promise<MergeRequest[]> {
    const db = this.ensureDb();
    return db.getAllFromIndex('mergeRequests', 'byWorkflow', workflowId);
  }

  async deleteMergeRequest(id: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('mergeRequests', id);
  }

  // ============================================================================
  // WORKSPACE OPERATIONS
  // ============================================================================

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const db = this.ensureDb();
    // Convert Map to object if needed
    const toSave = {
      ...workspace,
      artifacts: workspace.artifacts instanceof Map
        ? Object.fromEntries(workspace.artifacts)
        : workspace.artifacts,
      lastActivityAt: Date.now(),
    };
    await db.put('workspaces', toSave);
  }

  async getWorkspace(workflowId: string): Promise<Workspace | undefined> {
    const db = this.ensureDb();
    return db.get('workspaces', workflowId);
  }

  async createWorkspace(workflowId: string, name: string): Promise<Workspace> {
    // First create the blackboard
    const blackboard = await this.createBlackboard(workflowId);

    const workspace: Workspace = {
      id: workflowId,
      workflowId,
      name,
      blackboard,
      artifacts: {},
      events: [],
      taskQueue: [],
      agentMailboxes: {},
      pendingMergeRequests: [],
      mergeRules: {
        claimRequiresCitation: true,
        claimMinConfidence: 0.5,
        experimentRequiresMetrics: true,
        experimentRequiresStoppingRule: true,
        draftRequiresVerifiedClaims: true,
        draftMaxUnreviewedCitations: 3,
        autoMergeMinConfidence: 0.8,
        autoMergeRequiresAllChecksPassed: true,
        requireHumanReviewFor: ['hypothesis', 'decision', 'draft_final', 'constraint_change'],
      },
      supervisorState: {
        workflowId,
        currentPhase: 'research',
        activeTasks: [],
        pendingDecisions: [],
        progressMetrics: {
          tasksCompleted: 0,
          tasksTotal: 0,
          claimsVerified: 0,
          sectionsComplete: 0,
          overallProgress: 0,
        },
      },
      contextAssemblyRules: {
        maxTokensPerTier: {
          global: 2000,
          task: 4000,
          agent_local: 1000,
          long_term: 500,
        },
        priorityWeights: {
          source: 1.0,
          note: 1.2,
          hypothesis: 1.5,
          experiment_spec: 1.3,
          run: 1.1,
          draft: 1.0,
          decision: 1.4,
          code: 0.8,
          data: 0.7,
          citation: 0.9,
          constraint: 1.5,
          summary: 0.6,
        },
        recencyWeight: 0.3,
      },
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await this.saveWorkspace(workspace);
    return workspace;
  }

  async deleteWorkspace(workflowId: string): Promise<void> {
    const db = this.ensureDb();

    // Delete workspace
    await db.delete('workspaces', workflowId);

    // Delete associated blackboard
    await db.delete('blackboards', `workspace:${workflowId}`);

    // Delete associated artifacts
    const artifactKeys = await db.getAllKeysFromIndex('artifacts', 'byWorkflow', workflowId);
    for (const key of artifactKeys) {
      await db.delete('artifacts', key);
    }

    // Delete associated events
    const eventKeys = await db.getAllKeysFromIndex('workflowEvents', 'byWorkflow', workflowId);
    for (const key of eventKeys) {
      await db.delete('workflowEvents', key);
    }

    // Delete associated tasks
    const taskKeys = await db.getAllKeysFromIndex('tasks', 'byWorkflow', workflowId);
    for (const key of taskKeys) {
      await db.delete('tasks', key);
    }

    // Delete associated merge requests
    const mrKeys = await db.getAllKeysFromIndex('mergeRequests', 'byWorkflow', workflowId);
    for (const key of mrKeys) {
      await db.delete('mergeRequests', key);
    }
  }

  // ============================================================================
  // PRIVATE MEMORY LOG OPERATIONS
  // ============================================================================

  /**
   * Get or create a private memory log for an agent.
   */
  async getPrivateMemoryLog(workflowId: string, agentId: string): Promise<PrivateMemoryLog | undefined> {
    const db = this.ensureDb();
    const id = `${workflowId}:${agentId}`;
    return db.get('privateMemoryLogs', id);
  }

  /**
   * Create a new private memory log for an agent.
   */
  async createPrivateMemoryLog(
    workflowId: string,
    agentId: string,
    identity: PrivateMemoryLog['identity']
  ): Promise<PrivateMemoryLog> {
    const log: PrivateMemoryLog = {
      agentId,
      workflowId,
      identity,
      entries: [],
      lastUpdated: Date.now(),
      currentStatus: 'idle',
    };
    const db = this.ensureDb();
    await db.put('privateMemoryLogs', { ...log, id: `${workflowId}:${agentId}` });
    return log;
  }

  /**
   * Update an agent's private memory log identity (skills, values, goals).
   */
  async updatePrivateMemoryIdentity(
    workflowId: string,
    agentId: string,
    identity: Partial<PrivateMemoryLog['identity']>
  ): Promise<void> {
    const log = await this.getPrivateMemoryLog(workflowId, agentId);
    if (log) {
      log.identity = { ...log.identity, ...identity };
      log.lastUpdated = Date.now();
      const db = this.ensureDb();
      await db.put('privateMemoryLogs', { ...log, id: `${workflowId}:${agentId}` });
    }
  }

  /**
   * Add an entry to an agent's private memory log.
   */
  async addPrivateMemoryEntry(
    workflowId: string,
    agentId: string,
    entry: Omit<PrivateMemoryLogEntry, 'id' | 'timestamp'>
  ): Promise<string> {
    let log = await this.getPrivateMemoryLog(workflowId, agentId);

    if (!log) {
      // Create with default identity
      log = await this.createPrivateMemoryLog(workflowId, agentId, {
        skills: [],
        values: [],
        goals: [],
        constraints: [],
      });
    }

    const fullEntry: PrivateMemoryLogEntry = {
      ...entry,
      id: `priv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    log.entries.push(fullEntry);
    log.lastUpdated = Date.now();

    const db = this.ensureDb();
    await db.put('privateMemoryLogs', { ...log, id: `${workflowId}:${agentId}` });

    return fullEntry.id;
  }

  /**
   * Update agent's current task and status in private memory.
   */
  async updatePrivateMemoryStatus(
    workflowId: string,
    agentId: string,
    status: PrivateMemoryLog['currentStatus'],
    currentTask?: string
  ): Promise<void> {
    const log = await this.getPrivateMemoryLog(workflowId, agentId);
    if (log) {
      log.currentStatus = status;
      log.currentTask = currentTask;
      log.lastUpdated = Date.now();
      const db = this.ensureDb();
      await db.put('privateMemoryLogs', { ...log, id: `${workflowId}:${agentId}` });
    }
  }

  /**
   * Get all private memory logs for a workflow.
   */
  async getAllPrivateMemoryLogs(workflowId: string): Promise<PrivateMemoryLog[]> {
    const db = this.ensureDb();
    return db.getAllFromIndex('privateMemoryLogs', 'byWorkflow', workflowId);
  }

  /**
   * Delete private memory log for an agent.
   */
  async deletePrivateMemoryLog(workflowId: string, agentId: string): Promise<void> {
    const db = this.ensureDb();
    const id = `${workflowId}:${agentId}`;
    await db.delete('privateMemoryLogs', id);
  }

  // ============================================================================
  // PUBLIC MEMORY LOG OPERATIONS
  // ============================================================================

  /**
   * Get the public memory log for a workflow.
   */
  async getPublicMemoryLog(workflowId: string): Promise<PublicMemoryLog | undefined> {
    const db = this.ensureDb();
    return db.get('publicMemoryLogs', workflowId);
  }

  /**
   * Create a new public memory log for a workflow.
   */
  async createPublicMemoryLog(workflowId: string, mainGoal: string): Promise<PublicMemoryLog> {
    const log: PublicMemoryLog = {
      workflowId,
      mainGoal,
      subGoals: [],
      roleReminders: [],
      milestones: [],
      activeProblems: [],
      entries: [],
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };
    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
    return log;
  }

  /**
   * Update the main goal of the public memory log.
   */
  async updatePublicMemoryGoal(workflowId: string, mainGoal: string, subGoals?: string[]): Promise<void> {
    let log = await this.getPublicMemoryLog(workflowId);
    if (!log) {
      log = await this.createPublicMemoryLog(workflowId, mainGoal);
    }
    log.mainGoal = mainGoal;
    if (subGoals) log.subGoals = subGoals;
    log.lastUpdated = Date.now();
    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
  }

  /**
   * Add or update a role reminder in the public memory.
   */
  async addRoleReminder(workflowId: string, role: AgentRole, reminder: string): Promise<void> {
    let log = await this.getPublicMemoryLog(workflowId);
    if (!log) {
      log = await this.createPublicMemoryLog(workflowId, '');
    }

    const existingIndex = log.roleReminders.findIndex(r => r.role === role);
    if (existingIndex >= 0) {
      log.roleReminders[existingIndex] = { role, reminder, lastEmphasized: Date.now() };
    } else {
      log.roleReminders.push({ role, reminder, lastEmphasized: Date.now() });
    }
    log.lastUpdated = Date.now();

    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
  }

  /**
   * Add a milestone to the public memory.
   */
  async addMilestone(
    workflowId: string,
    title: string,
    description: string,
    status: 'pending' | 'in_progress' | 'achieved' | 'blocked' = 'pending'
  ): Promise<string> {
    let log = await this.getPublicMemoryLog(workflowId);
    if (!log) {
      log = await this.createPublicMemoryLog(workflowId, '');
    }

    const id = `milestone_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    log.milestones.push({
      id,
      title,
      description,
      status,
      achievedAt: status === 'achieved' ? Date.now() : undefined,
    });
    log.lastUpdated = Date.now();

    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
    return id;
  }

  /**
   * Update a milestone status.
   */
  async updateMilestoneStatus(
    workflowId: string,
    milestoneId: string,
    status: 'pending' | 'in_progress' | 'achieved' | 'blocked'
  ): Promise<void> {
    const log = await this.getPublicMemoryLog(workflowId);
    if (!log) return;

    const milestone = log.milestones.find(m => m.id === milestoneId);
    if (milestone) {
      milestone.status = status;
      if (status === 'achieved') milestone.achievedAt = Date.now();
      log.lastUpdated = Date.now();
      const db = this.ensureDb();
      await db.put('publicMemoryLogs', log);
    }
  }

  /**
   * Report a problem to the public memory.
   */
  async reportProblem(
    workflowId: string,
    reportedBy: AgentRole,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<string> {
    let log = await this.getPublicMemoryLog(workflowId);
    if (!log) {
      log = await this.createPublicMemoryLog(workflowId, '');
    }

    const id = `problem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    log.activeProblems.push({
      id,
      reportedBy,
      description,
      severity,
      reportedAt: Date.now(),
    });
    log.lastUpdated = Date.now();

    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
    return id;
  }

  /**
   * Resolve a problem in the public memory.
   */
  async resolveProblem(workflowId: string, problemId: string): Promise<void> {
    const log = await this.getPublicMemoryLog(workflowId);
    if (!log) return;

    const problem = log.activeProblems.find(p => p.id === problemId);
    if (problem) {
      problem.resolvedAt = Date.now();
      log.lastUpdated = Date.now();
      const db = this.ensureDb();
      await db.put('publicMemoryLogs', log);
    }
  }

  /**
   * Add an entry to the public memory log.
   */
  async addPublicMemoryEntry(
    workflowId: string,
    entry: Omit<PublicMemoryLogEntry, 'id' | 'timestamp'>
  ): Promise<string> {
    let log = await this.getPublicMemoryLog(workflowId);
    if (!log) {
      log = await this.createPublicMemoryLog(workflowId, '');
    }

    const fullEntry: PublicMemoryLogEntry = {
      ...entry,
      id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    log.entries.push(fullEntry);
    log.lastUpdated = Date.now();

    const db = this.ensureDb();
    await db.put('publicMemoryLogs', log);
    return fullEntry.id;
  }

  /**
   * Delete the public memory log for a workflow.
   */
  async deletePublicMemoryLog(workflowId: string): Promise<void> {
    const db = this.ensureDb();
    await db.delete('publicMemoryLogs', workflowId);
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  async clearAllData(): Promise<void> {
    const db = this.ensureDb();
    await db.clear('workflows');
    await db.clear('blockMemory');
    await db.clear('agentSessions');
    await db.clear('executionLogs');
    await db.clear('artifacts');
    await db.clear('workflowEvents');
    await db.clear('tasks');
    await db.clear('blackboards');
    await db.clear('mergeRequests');
    await db.clear('workspaces');
    // Clear memory logs
    if (db.objectStoreNames.contains('privateMemoryLogs')) {
      await db.clear('privateMemoryLogs');
    }
    if (db.objectStoreNames.contains('publicMemoryLogs')) {
      await db.clear('publicMemoryLogs');
    }
    // Note: We don't clear apiKeys or localKernelConfig here as they're user settings
  }
}

// Singleton instance
export const storage = new AgentLegoStorage();
