import { Router } from "express";
import { pool } from "../db.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import { slugifySubject, makeThreadToken, normalizeToken, isUniqueViolation } from "../lib/threadSlug.js";
import { z } from "zod";

const router = Router();

const boardParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

const threadPrettyParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
    subjectSlug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
    token: z.string().trim().min(3).max(80),
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

const replySchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

  // GET /api/boarsd
  router.get("/", async (req, res, next) => {
  try {
    const r = await pool.query(
      `select slug, name, created_at
       from boards
       order by slug asc`
    );

    res.json({ boards: r.rows });
  } catch (err) {
    next(err);
  }
});
/**
 * POST /api/boards/:slug/threads
 * creates a thread + OP post (#1)
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
      const subjectSlug = slugifySubject(subjectOrNull ?? "");

      const client = await pool.connect();
      try {
        await client.query("begin");

        // ensure board exists
        const b = await client.query(`select 1 from boards where slug = $1`, [boardSlug]);
        if (b.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "board_not_found" });
        }

        // Generate token & retry on collisions
        let threadRow = null;

        for (let attempt = 0; attempt < 8; attempt++) {
          const rawToken = makeThreadToken();         // e.g. "bangus_enchilada"
          const token = normalizeToken(rawToken);     // normalize (upper/lower, separators, etc)

          try {
            const t = await client.query(
              `insert into threads (board_slug, subject, subject_slug, token)
               values ($1, $2, $3, $4)
               returning id, board_slug, subject, subject_slug, token, created_at, bumped_at`,
              [boardSlug, subjectOrNull, subjectSlug || "thread", token]
            );
            threadRow = t.rows[0];
            break;
          } catch (e) {
            if (isUniqueViolation(e)) continue;
            throw e;
          }
        }

        if (!threadRow) {
          await client.query("rollback");
          return res.status(500).json({ error: "slug_generation_failed" });
        }

        // lock thread row, take next_post_number (should be 1)
        const n = await client.query(
          `select next_post_number
           from threads
           where id = $1
           for update`,
          [threadRow.id]
        );
        const postNumber = n.rows[0].next_post_number;

        const p = await client.query(
          `insert into posts (thread_id, post_number, body)
           values ($1, $2, $3)
           returning id, thread_id, post_number, created_at, body`,
          [threadRow.id, postNumber, body]
        );

        await client.query(
          `update threads
           set next_post_number = next_post_number + 1
           where id = $1`,
          [threadRow.id]
        );

        await client.query("commit");

        const canonicalPath = `/api/boards/${threadRow.board_slug}/${threadRow.subject_slug}/${threadRow.token}`;
        res.status(201).json({ thread: threadRow, firstPost: p.rows[0], canonicalPath });
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
 */
router.get(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  validateQuery(listThreadsQuerySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const limit = req.validatedQuery.limit ?? 20;

      const b = await pool.query(`select 1 from boards where slug = $1`, [boardSlug]);
      if (b.rowCount === 0) return res.status(404).json({ error: "board_not_found" });

      const r = await pool.query(
        `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
         from threads
         where board_slug = $1
         order by bumped_at desc
         limit $2`,
        [boardSlug, limit]
      );

      res.json({ threads: r.rows });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/boards/:slug/:subjectSlug/:token
 * view thread by board + pretty subjectSlug + token
 */
router.get(
  "/:slug/:subjectSlug/:token",
  validateParams(threadPrettyParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;

      const t = await pool.query(
        `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
         from threads
         where board_slug = $1 and subject_slug = $2 and token = $3`,
        [boardSlug, subjectSlug, normalizeToken(token)]
      );

      if (t.rowCount === 0) return res.status(404).json({ error: "not_found" });

      const thread = t.rows[0];

      const p = await pool.query(
        `select id, thread_id, post_number, created_at, body
         from posts
         where thread_id = $1
         order by post_number asc`,
        [thread.id]
      );

      res.json({ thread, posts: p.rows });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/boards/:slug/:subjectSlug/:token/replies
 */
router.post(
  "/:slug/:subjectSlug/:token/replies",
  validateParams(threadPrettyParamsSchema),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      const { body } = req.validatedBody;

      const client = await pool.connect();
      try {
        await client.query("begin");

        const t = await client.query(
          `select id, next_post_number
           from threads
           where board_slug = $1 and subject_slug = $2 and token = $3
           for update`,
          [boardSlug, subjectSlug, normalizeToken(token)]
        );

        if (t.rowCount === 0) {
          await client.query("rollback");
          return res.status(404).json({ error: "not_found" });
        }

        const threadId = t.rows[0].id;
        const postNumber = t.rows[0].next_post_number;

        const p = await client.query(
          `insert into posts(thread_id, post_number, body)
           values ($1, $2, $3)
           returning id, thread_id, post_number, created_at, body`,
          [threadId, postNumber, body]
        );

        await client.query(
          `update threads
           set bumped_at = now(),
               next_post_number = next_post_number + 1
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