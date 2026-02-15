import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * Liveness probe
 * GET /healthz
 * Does NOT hit database.
 */
router.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

/**
 *  DB connectivity readiness probe
 */
router.get("/readyz", async (req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({
      ok: false,
      error: "database_unavailable"
    });
  }
});

export default router;
