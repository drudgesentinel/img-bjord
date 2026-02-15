import express from "express";
import helmet from "helmet";
import pino from "pino-http";
import "dotenv/config";
import healthRouter from "./routes/health.js";
import threadsRouter from "./routes/threads.js";

const app = express();
app.use(helmet());
app.use(pino());
app.use(express.json());

app.use(healthRouter);

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use("/api/threads", threadsRouter);

// minimal error handler
app.use((err, req, res, next) => {
  req.log?.error(err);
  res.status(500).json({ error: "internal_error" });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`http://localhost:${port}`));
