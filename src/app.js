import express from "express";
import helmet from "helmet";
import pino from "pino-http";

import healthRouter from "./routes/health.js";
import threadsRouter from "./routes/threads.js";

// moved the app logic here so it can be imported for tests
export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(pino());
  app.use(express.json({ limit: "64kb" }));

  app.use(healthRouter);
  app.use("/api/threads", threadsRouter);

  // error handler
  app.use((err, req, res, next) => {
    req.log?.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
