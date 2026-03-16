import express from "express";
import helmet from "helmet";
import pino from "pino-http";
import session from "express-session";
import { getUploadDir, isLocalMediaStorage } from "./lib/mediaStorage.js";

import healthRouter from "./routes/health.js";
import authRouter from "./features/auth/router.js";
import boardsRouter from "./features/boards/router.js";
import threadsRouter from "./features/threads/router.js";


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

  const sessionSecret = process.env.SESSION_SECRET || "dev-only-insecure-session-secret";
  app.use(
    session({
      name: "bjord.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(express.json({ limit: "64kb" }));

  if (isLocalMediaStorage()) {
    app.use("/api/uploads", express.static(getUploadDir()));
  }

  app.use(healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/boards", boardsRouter);
  app.use("/api/threads", threadsRouter);

  app.use((err, req, res, next) => {
    req.log?.error(err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
