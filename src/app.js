import express from "express";
import helmet from "helmet";
import pino from "pino-http";

import healthRouter from "./routes/health.js";
import threadsRouter from "./routes/threads.js";
import boardsRouter from "./routes/boards.js";


// moved the app logic here so it can be imported for tests
export function createApp() {
  const app = express();

  const DEBUG = process.env.DEBUG === "true";

  if (DEBUG) {
    app.use((req, res, next) => {
      console.log(`[DEBUG] ${req.method} ${req.url}`);
      console.log(`[DEBUG] headers:`, req.headers);

      const start = Date.now();
      res.on("finish", () => {
        const ms = Date.now() - start;
        console.log(`[DEBUG] ${req.method} ${req.url} -> ${res.statusCode} (${ms}ms)`);
      });

      next();
    });
  }
 
  app.use(helmet());
  app.use(pino());
  app.use(express.json({ limit: "64kb" }));

  app.use(healthRouter);
  app.use("/api/boards", boardsRouter);
  app.use("/api/threads", threadsRouter);

  app.use((err, req, res, next) => {
    req.log?.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
