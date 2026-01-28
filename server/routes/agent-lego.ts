import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import db from "../db.js";
import { nanoid } from "nanoid";
import type {
  WorkflowMetadata,
  WorkflowTemplate,
  CreateWorkflowMetadataRequest,
  UpdateWorkflowMetadataRequest,
  WorkflowMetadataListResponse,
  WorkflowTemplateListResponse,
  CreateWorkflowTemplateRequest,
  User,
} from "../../shared/types.js";

const router = Router();

// Helper to get user from request
function getUser(req: Request): User | null {
  return (req as any).user || null;
}

// ============================================================================
// WORKFLOW METADATA ROUTES (Minimal - just for sync across devices)
// ============================================================================

// List user's workflow metadata
router.get("/workflows", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const workflows = db
      .prepare(
        `SELECT id, user_id, name, description, is_public, created_at, updated_at
         FROM agent_workflow_metadata
         WHERE user_id = ?
         ORDER BY updated_at DESC`
      )
      .all(user.id) as any[];

    const response: WorkflowMetadataListResponse = {
      workflows: workflows.map((w) => ({
        id: w.id,
        userId: w.user_id,
        name: w.name,
        description: w.description || "",
        isPublic: !!w.is_public,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
      total: workflows.length,
    };

    res.json(response);
  } catch (error) {
    console.error("Failed to list workflows:", error);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

// Create workflow metadata
router.post("/workflows", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { name, description } = req.body as CreateWorkflowMetadataRequest;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const id = `wf_${nanoid(12)}`;
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO agent_workflow_metadata (id, user_id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, user.id, name.trim(), description?.trim() || null, now, now);

    const metadata: WorkflowMetadata = {
      id,
      userId: user.id,
      name: name.trim(),
      description: description?.trim() || "",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    };

    res.status(201).json(metadata);
  } catch (error) {
    console.error("Failed to create workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

// Update workflow metadata
router.patch("/workflows/:id", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { id } = req.params;
    const { name, description, isPublic } = req.body as UpdateWorkflowMetadataRequest;

    // Check ownership
    const existing = db
      .prepare("SELECT user_id FROM agent_workflow_metadata WHERE id = ?")
      .get(id) as { user_id: string } | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized to modify this workflow" });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description.trim() || null);
    }
    if (isPublic !== undefined) {
      updates.push("is_public = ?");
      values.push(isPublic ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    updates.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    db.prepare(
      `UPDATE agent_workflow_metadata SET ${updates.join(", ")} WHERE id = ?`
    ).run(...values);

    // Get updated record
    const updated = db
      .prepare(
        `SELECT id, user_id, name, description, is_public, created_at, updated_at
         FROM agent_workflow_metadata WHERE id = ?`
      )
      .get(id) as any;

    const metadata: WorkflowMetadata = {
      id: updated.id,
      userId: updated.user_id,
      name: updated.name,
      description: updated.description || "",
      isPublic: !!updated.is_public,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };

    res.json(metadata);
  } catch (error) {
    console.error("Failed to update workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

// Delete workflow metadata
router.delete("/workflows/:id", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { id } = req.params;

    // Check ownership
    const existing = db
      .prepare("SELECT user_id FROM agent_workflow_metadata WHERE id = ?")
      .get(id) as { user_id: string } | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized to delete this workflow" });
    }

    db.prepare("DELETE FROM agent_workflow_metadata WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workflow:", error);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

// ============================================================================
// TEMPLATE ROUTES (Community Sharing)
// ============================================================================

// List templates
router.get("/templates", (req: Request, res: Response) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, author_id, author_name, name, description, category,
             blocks_json, connections_json, use_count, created_at
      FROM agent_workflow_templates
    `;
    const params: any[] = [];

    if (category) {
      query += " WHERE category = ?";
      params.push(category);
    }

    query += " ORDER BY use_count DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const templates = db.prepare(query).all(...params) as any[];

    // Get total count
    let countQuery = "SELECT COUNT(*) as count FROM agent_workflow_templates";
    const countParams: any[] = [];
    if (category) {
      countQuery += " WHERE category = ?";
      countParams.push(category);
    }
    const { count } = db.prepare(countQuery).get(...countParams) as { count: number };

    const response: WorkflowTemplateListResponse = {
      templates: templates.map((t) => ({
        id: t.id,
        authorId: t.author_id,
        authorName: t.author_name,
        name: t.name,
        description: t.description || "",
        category: t.category || "",
        blocksJson: t.blocks_json,
        connectionsJson: t.connections_json,
        useCount: t.use_count,
        createdAt: t.created_at,
      })),
      total: count,
    };

    res.json(response);
  } catch (error) {
    console.error("Failed to list templates:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

// Get single template
router.get("/templates/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const template = db
      .prepare(
        `SELECT id, author_id, author_name, name, description, category,
                blocks_json, connections_json, use_count, created_at
         FROM agent_workflow_templates WHERE id = ?`
      )
      .get(id) as any;

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Increment use count
    db.prepare(
      "UPDATE agent_workflow_templates SET use_count = use_count + 1 WHERE id = ?"
    ).run(id);

    const result: WorkflowTemplate = {
      id: template.id,
      authorId: template.author_id,
      authorName: template.author_name,
      name: template.name,
      description: template.description || "",
      category: template.category || "",
      blocksJson: template.blocks_json,
      connectionsJson: template.connections_json,
      useCount: template.use_count + 1,
      createdAt: template.created_at,
    };

    res.json(result);
  } catch (error) {
    console.error("Failed to get template:", error);
    res.status(500).json({ error: "Failed to get template" });
  }
});

// Create template (share workflow)
router.post("/templates", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { name, description, category, blocksJson, connectionsJson } =
      req.body as CreateWorkflowTemplateRequest;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!blocksJson) {
      return res.status(400).json({ error: "Blocks JSON is required" });
    }
    if (!connectionsJson) {
      return res.status(400).json({ error: "Connections JSON is required" });
    }

    // Validate JSON
    try {
      JSON.parse(blocksJson);
      JSON.parse(connectionsJson);
    } catch {
      return res.status(400).json({ error: "Invalid JSON format" });
    }

    const id = `tpl_${nanoid(12)}`;
    const now = Math.floor(Date.now() / 1000);

    db.prepare(
      `INSERT INTO agent_workflow_templates
       (id, author_id, author_name, name, description, category, blocks_json, connections_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      user.id,
      user.displayName,
      name.trim(),
      description?.trim() || null,
      category?.trim() || null,
      blocksJson,
      connectionsJson,
      now
    );

    const template: WorkflowTemplate = {
      id,
      authorId: user.id,
      authorName: user.displayName,
      name: name.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "",
      blocksJson,
      connectionsJson,
      useCount: 0,
      createdAt: now,
    };

    res.status(201).json(template);
  } catch (error) {
    console.error("Failed to create template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Delete template
router.delete("/templates/:id", (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { id } = req.params;

    // Check ownership
    const existing = db
      .prepare("SELECT author_id FROM agent_workflow_templates WHERE id = ?")
      .get(id) as { author_id: string } | undefined;

    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }

    if (existing.author_id !== user.id) {
      return res.status(403).json({ error: "Not authorized to delete this template" });
    }

    db.prepare("DELETE FROM agent_workflow_templates WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ============================================================================
// PYTHON CODE EXECUTION (Local kernel for testing research ideas)
// ============================================================================

interface PythonExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  returnCode: number | null;
  executionTime: number;
  error?: string;
}

// Find Python executable (handles Windows PATH issues)
function findPython(): string {
  if (process.platform !== "win32") {
    return "python3";
  }

  // Common Windows Python installation paths
  const homeDir = os.homedir();
  const commonPaths = [
    // User installations
    path.join(homeDir, "AppData", "Local", "Programs", "Python", "Python312", "python.exe"),
    path.join(homeDir, "AppData", "Local", "Programs", "Python", "Python311", "python.exe"),
    path.join(homeDir, "AppData", "Local", "Programs", "Python", "Python310", "python.exe"),
    path.join(homeDir, "AppData", "Local", "Programs", "Python", "Python39", "python.exe"),
    // System installations
    "C:\\Python312\\python.exe",
    "C:\\Python311\\python.exe",
    "C:\\Python310\\python.exe",
    "C:\\Program Files\\Python312\\python.exe",
    "C:\\Program Files\\Python311\\python.exe",
    // Fallback to PATH
    "python",
    "python3",
  ];

  for (const pythonPath of commonPaths) {
    try {
      if (pythonPath.includes("\\") || pythonPath.includes("/")) {
        // Check if file exists
        if (fs.existsSync(pythonPath)) {
          return pythonPath;
        }
      } else {
        // It's just "python" or "python3", return as-is
        return pythonPath;
      }
    } catch {
      continue;
    }
  }

  return "python"; // Fallback
}

// Cache the Python path
let cachedPythonPath: string | null = null;

function getPythonPath(): string {
  if (!cachedPythonPath) {
    cachedPythonPath = findPython();
    console.log(`Python path resolved to: ${cachedPythonPath}`);
  }
  return cachedPythonPath;
}

// Execute Python code in a subprocess
router.post("/python/execute", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { code, timeout = 30000 } = req.body as { code: string; timeout?: number };

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Code is required" });
    }

    // Create a temporary file for the Python code
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `agent_lego_${Date.now()}_${nanoid(6)}.py`);

    // Write code to temp file
    fs.writeFileSync(tempFile, code, "utf-8");

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let returnCode: number | null = null;

    try {
      const result = await new Promise<PythonExecutionResult>((resolve) => {
        const pythonCmd = getPythonPath();
        const proc = spawn(pythonCmd, [tempFile], {
          timeout: Math.min(timeout, 60000), // Max 60 seconds
          cwd: tempDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: "1", // Ensure real-time output
          },
        });

        proc.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          returnCode = code;
          resolve({
            success: code === 0,
            stdout,
            stderr,
            returnCode: code,
            executionTime: Date.now() - startTime,
          });
        });

        proc.on("error", (err) => {
          resolve({
            success: false,
            stdout,
            stderr: stderr + `\nProcess error: ${err.message}`,
            returnCode: null,
            executionTime: Date.now() - startTime,
            error: err.message,
          });
        });

        // Handle timeout
        setTimeout(() => {
          proc.kill("SIGTERM");
          resolve({
            success: false,
            stdout,
            stderr: stderr + "\nExecution timed out",
            returnCode: null,
            executionTime: Date.now() - startTime,
            error: "Execution timed out",
          });
        }, Math.min(timeout, 60000));
      });

      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      res.json(result);
    } catch (execError) {
      // Clean up temp file on error
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }

      res.json({
        success: false,
        stdout: "",
        stderr: execError instanceof Error ? execError.message : "Unknown execution error",
        returnCode: null,
        executionTime: Date.now() - startTime,
        error: execError instanceof Error ? execError.message : "Unknown error",
      });
    }
  } catch (error) {
    console.error("Python execution error:", error);
    res.status(500).json({
      error: "Failed to execute Python code",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Check if Python is available
router.get("/python/status", async (req: Request, res: Response) => {
  try {
    const pythonCmd = getPythonPath();

    const result = await new Promise<{ available: boolean; version?: string; error?: string; path?: string }>((resolve) => {
      const proc = spawn(pythonCmd, ["--version"], { timeout: 5000 });
      let output = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.stderr.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ available: true, version: output.trim(), path: pythonCmd });
        } else {
          resolve({ available: false, error: `Python exited with non-zero code. Tried: ${pythonCmd}` });
        }
      });

      proc.on("error", (err) => {
        resolve({ available: false, error: `${err.message}. Tried: ${pythonCmd}` });
      });
    });

    res.json(result);
  } catch (error) {
    res.json({
      available: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// ARXIV PROXY (CORS workaround for browser-based paper fetching)
// ============================================================================

router.get("/arxiv/search", async (req: Request, res: Response) => {
  try {
    const { query, maxResults = 10 } = req.query;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter is required" });
    }

    const encodedQuery = encodeURIComponent(query);
    const arxivUrl = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    const response = await fetch(arxivUrl);

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Return raw XML - let client parse it
    res.set("Content-Type", "application/xml");
    res.send(xmlText);
  } catch (error) {
    console.error("arXiv proxy error:", error);
    res.status(500).json({
      error: "Failed to fetch from arXiv",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
