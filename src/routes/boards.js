import { Router } from "express";
import { pool } from "../db.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import { z } from "zod";

const router = Router();

const boardParamsSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

const listThreadsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const createThreadSchema = z
  .object({
    subject: z.string().trim().min(1).max(100).optional(),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

/**
 * POST /api/boards/:slug/threads
 * body: { subject?: string, body: string }
 * creates a thread + first post (#1)
 */
router.post(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  validateBody(createThreadSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const { subject, body } = req.validatedBody;
      const subjectOrNull = subject ?? null;

      const client = await pool.connect();
      try {
        await client.query("begin");

        // ensure board exists
        const b = await client.query(`select 1 from boards where slug = $1`, [
          boardSlug,
        ]);
        if (b.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "board_not_found" });
        }

        // create thread (next_post_number starts at 1)
        const t = await client.query(
          `insert into threads(board_slug, subject)
           values ($1, $2)
           returning id, board_slug, subject, created_at, bumped_at`,
          [boardSlug, subjectOrNull],
        );

        const thread = t.rows[0];

        // lock thread row, take next_post_number (should be 1)
        const n = await client.query(
          `select next_post_number
           from threads
           where id = $1
           for update`,
          [thread.id],
        );
        const postNumber = n.rows[0].next_post_number;

        // insert OP post
        const p = await client.query(
          `insert into posts(thread_id, post_number, body)
           values ($1, $2, $3)
           returning id, thread_id, post_number, created_at, body`,
          [thread.id, postNumber, body],
        );

        // increment counter (and bump is already now)
        await client.query(
          `update threads
           set next_post_number = next_post_number + 1
           where id = $1`,
          [thread.id],
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
  },
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

      const b = await pool.query(`select 1 from boards where slug = $1`, [
        slug,
      ]);
      if (b.rowCount === 0)
        return res.status(404).json({ error: "board_not_found" });

      const r = await pool.query(
        `select id, board_slug, subject, created_at, bumped_at
         from threads
         where board_slug = $1
         order by bumped_at desc
         limit $2`,
        [slug, limit],
      );

      res.json({ threads: r.rows });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
