import { Router } from "express";
import { pool } from "../db.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { z } from "zod";

const router = Router();

// schema for validating reply
const replySchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

const threadIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

/**
 * GET /api/threads/:id
 * returns thread + posts
 */
router.get("/:id", async (req, res, next) => {
  try {
    const threadId = req.params.id;

    const t = await pool.query(
      `select id, board_slug, subject, created_at, bumped_at
       from threads
       where id = $1`,
      [threadId]
    );
    if (t.rowCount === 0) return res.status(404).json({ error: "not_found" });

    const p = await pool.query(
      `select id, thread_id, created_at, body
       from posts
       where thread_id = $1
       order by created_at asc`,
      [threadId]
    );

    res.json({ thread: t.rows[0], posts: p.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/threads/:id/replies
 * body: { body: string }
 */
router.post(
  "/:id/replies",
  validateParams(threadIdParamsSchema),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.validatedParams;
      const { body } = req.validatedBody;

      const client = await pool.connect();
      try {
        await client.query("begin");

        // Ensure thread exists (and lock it so this is consistent inside the tx)
        const exists = await client.query(
          `select 1 from threads where id = $1 for update`,
          [threadId]
        );
        if (exists.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "not_found" });
        }

        const p = await client.query(
          `insert into posts(thread_id, body) values ($1, $2)
           returning id, thread_id, created_at, body`,
          [threadId, body]
        );

        await client.query(
          `update threads set bumped_at = now()
           where id = $1`,
          [threadId]
        );

        await client.query("commit");
        res.status(201).json({ post: p.rows[0] });
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

export default router;
