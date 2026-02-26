import { Router } from "express";
import { pool } from "../db.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import { z } from "zod";
import crypto from "node:crypto";

const router = Router();

const boardParamsSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

const threadSlugParamsSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]{1,20}$/),
    threadSlug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{3,80}$/),
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

function slugifySubject(subject) {
  // Keep it simple & predictable: lowercase, alnum -> dash, collapse dashes
  // We also cap length to keep URLs sane.
  const base = subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);

  return base;
}

function randomSlugPart(bytes = 4) {
  // 4 bytes -> 8 hex chars; good enough + super simple
  return crypto.randomBytes(bytes).toString("hex");
}

function makeThreadSlug(subject) {
  const s = subject ? slugifySubject(subject) : "";
  const rand = randomSlugPart(4);
  return s ? `${s}-${rand}` : rand;
}

function isUniqueViolation(err) {
  // Postgres unique violation
  return err && typeof err === "object" && err.code === "23505";
}

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

        // Generate slug & retry on collisions
        let threadRow = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          const threadSlug = makeThreadSlug(subjectOrNull ?? "");

          try {
            const t = await client.query(
              `insert into threads(board_slug, slug, subject)
               values ($1, $2, $3)
               returning id, board_slug, slug, subject, created_at, bumped_at`,
              [boardSlug, threadSlug, subjectOrNull],
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
          [threadRow.id],
        );
        const postNumber = n.rows[0].next_post_number;

        const p = await client.query(
          `insert into posts(thread_id, post_number, body)
           values ($1, $2, $3)
           returning id, thread_id, post_number, created_at, body`,
          [threadRow.id, postNumber, body],
        );

        await client.query(
          `update threads
           set next_post_number = next_post_number + 1
           where id = $1`,
          [threadRow.id],
        );

        await client.query("commit");
        res.status(201).json({ thread: threadRow, firstPost: p.rows[0] });
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
        `select id, board_slug, slug, subject, created_at, bumped_at
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

/**
 * GET /api/boards/:slug/threads/:threadSlug
 * view thread by board+slug
 */
router.get(
  "/:slug/threads/:threadSlug",
  validateParams(threadSlugParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, threadSlug } = req.validatedParams;

      const t = await pool.query(
        `select id, board_slug, slug, subject, created_at, bumped_at
         from threads
         where board_slug = $1 and slug = $2`,
        [boardSlug, threadSlug],
      );

      if (t.rowCount === 0) return res.status(404).json({ error: "not_found" });

      const thread = t.rows[0];

      const p = await pool.query(
        `select id, thread_id, post_number, created_at, body
         from posts
         where thread_id = $1
         order by post_number asc`,
        [thread.id],
      );

      res.json({ thread, posts: p.rows });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/boards/:slug/threads/:threadSlug/replies
 * reply via board+thread slug (more frontend friendly)
 */
router.post(
  "/:slug/threads/:threadSlug/replies",
  validateParams(threadSlugParamsSchema),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, threadSlug } = req.validatedParams;
      const { body } = req.validatedBody;

      const client = await pool.connect();
      try {
        await client.query("begin");

        // find thread id + lock row
        const t = await client.query(
          `select id, next_post_number
           from threads
           where board_slug = $1 and slug = $2
           for update`,
          [boardSlug, threadSlug],
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
          [threadId, postNumber, body],
        );

        await client.query(
          `update threads
           set bumped_at = now(),
               next_post_number = next_post_number + 1
           where id = $1`,
          [threadId],
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
  },
);

export default router;
