import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import crypto from "node:crypto";

// ~12 chars, URL-safe, no deps
function makeThreadSlug() {
  return crypto.randomBytes(9).toString("base64url");
}

function isUniqueViolation(err) {
  // pg unique_violation
  return err && err.code === "23505";
}

const router = Router();

const boardParamsSchema = z
  .object({
    // only lowercase letters + digits, 1..20 chars
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

const createThreadSchema = z
  .object({
    subject: z.string().trim().min(1).max(100).optional(),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

const listThreadsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

/**
 * POST /api/boards/:slug/threads
 * body: { subject?: string, body: string }
 */
router.post(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  validateBody(createThreadSchema),
  async (req, res, next) => {
    try {
      const { slug } = req.validatedParams;
      const { subject, body } = req.validatedBody;
      const subjectOrNull = subject ?? null;

      const client = await pool.connect();
      try {
        await client.query("begin");

        const b = await client.query(`select 1 from boards where slug = $1`, [slug]);
        if (b.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "board_not_found" });
        }

        const t = await client.query(
          `insert into threads(board_slug, subject)
           values ($1, $2)
           returning id, board_slug, subject, created_at, bumped_at`,
          [slug, subjectOrNull]
        );

        const thread = t.rows[0];

        const p = await client.query(
          `insert into posts(thread_id, body)
           values ($1, $2)
           returning id, thread_id, created_at, body`,
          [thread.id, body]
        );

        await client.query("commit");
        res.status(201).json({ thread, firstPost: p.rows[0] });
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/boards/:slug/threads?limit=...
 * list latest bumped threads for a board
 */
router.get(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  validateQuery(listThreadsQuerySchema),
  async (req, res, next) => {
    try {
      const { slug } = req.validatedParams;
      const limit = req.validatedQuery.limit ?? 20;

      const b = await pool.query(`select 1 from boards where slug = $1`, [slug]);
      if (b.rowCount === 0) return res.status(404).json({ error: "board_not_found" });

      // IMPORTANT: no joins; include id
      const r = await pool.query(
        `select id, board_slug, subject, created_at, bumped_at
         from threads
         where board_slug = $1
         order by bumped_at desc
         limit $2`,
        [slug, limit]
      );

      res.json({ threads: r.rows });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
