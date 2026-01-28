import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

// Import database (initializes tables)
import "./db.js";

// Import routes
import authRouter, { authMiddleware } from "./routes/auth.js";
import papersRouter from "./routes/papers.js";
import adminRouter from "./routes/admin.js";
import challengesRouter from "./routes/challenges.js";
import debatesRouter from "./routes/debates.js";
import agentLegoRouter from "./routes/agent-lego.js";
import categoriesRouter from "./routes/categories.js";
import feedbackRouter from "./routes/feedback.js";
import paperGroupsRouter from "./routes/paper-groups.js";
import backgroundReadingRouter from "./routes/background-reading.js";
import insightsRouter from "./routes/insights.js";

// Import background worker
import { startBackgroundWorker } from "./lib/background-worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Middleware - 50mb limit to handle multiple base64 images in feedback
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());
  app.use(authMiddleware);

  // Health check endpoint (for Docker/load balancers)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API routes
  app.use("/api/auth", authRouter);
  app.use("/api/papers", papersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/challenges", challengesRouter);
  app.use("/api/debates", debatesRouter);
  app.use("/api/agent-lego", agentLegoRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/feedback", feedbackRouter);
  app.use("/api/paper-groups", paperGroupsRouter);
  app.use("/api/background-reading", backgroundReadingRouter);
  app.use("/api/insights", insightsRouter);

  // Start background worker for AI reading jobs
  startBackgroundWorker();

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // In development, use port 3001 (Vite uses 3000 and proxies /api to 3001)
  // In production, use PORT env var or default to 3000
  const port = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 3001);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
