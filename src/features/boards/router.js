import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { uploadOptionalMedia } from "../../middleware/uploadImage.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { processMediaUpload } from "../../lib/processMediaUpload.js";
import {
  listBoards,
  listLatestPostsForViewer,
  createThread,
  getBoardAnnouncementForViewer,
  setBoardAnnouncement,
  listThreadsForViewer,
  listThreadsAcrossBoardsForViewer,
  getThreadDetailByPretty,
  createReplyByPretty,
  deleteReplyByPretty,
  deleteThreadByPretty,
} from "./service.js";
import {
  serializeBoardsResponse,
  serializeLatestPostListResponse,
  serializeCreateThreadResponse,
  serializeThreadListResponse,
  serializeBoardRssResponse,
  serializeGlobalRssResponse,
  serializeThreadDetailResponse,
  serializeReplyResponse,
} from "./serializer.js";

const router = Router();

const boardParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

const announcementBodySchema = z
  .object({
    announcement: z.string().trim().max(5000).default(""),
  })
  .strict();

const threadPrettyParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
    subjectSlug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
    token: z.string().trim().min(3).max(80),
  })
  .strict();

const replyDeleteParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
    subjectSlug: z.string().trim().regex(/^[a-z0-9-]{1,80}$/),
    token: z.string().trim().min(3).max(80),
    postId: z.string().uuid(),
  })
  .strict();

const listThreadsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .strict();

const listLatestPostsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const createThreadSchema = z
  .object({
    subject: z.string().trim().min(1).max(100).optional(),
    body: z.string().trim().max(5000).optional().default(""),
  })
  .strict();

const replySchema = z
  .object({
    body: z.string().trim().max(5000).optional().default(""),
  })
  .strict();

router.get("/", async (req, res, next) => {
  try {
    const boards = await listBoards({ viewerUserId: req.session?.userId ?? null });
    res.json(serializeBoardsResponse(boards));
  } catch (err) {
    next(err);
  }
});

router.get("/latest-posts", validateQuery(listLatestPostsQuerySchema), async (req, res, next) => {
  try {
    const limit = req.validatedQuery.limit ?? 20;
    const posts = await listLatestPostsForViewer({
      viewerUserId: req.session?.userId ?? null,
      limit,
    });
    res.json(serializeLatestPostListResponse(posts));
  } catch (err) {
    next(err);
  }
});

router.get("/rss.xml", validateQuery(listThreadsQuerySchema), async (req, res, next) => {
  try {
    const limit = req.validatedQuery.limit ?? 20;

    const threads = await listThreadsAcrossBoardsForViewer({
      viewerUserId: req.session?.userId ?? null,
      limit,
    });

    const forwardedProto = req.get("x-forwarded-proto");
    const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;
    const host = req.get("host") || "localhost";
    const siteUrl = `${protocol}://${host}`;
    const selfUrl = `${siteUrl}${req.originalUrl}`;

    const xml = serializeGlobalRssResponse({
      threads,
      siteUrl,
      selfUrl,
    });

    res.set("content-type", "application/rss+xml; charset=utf-8");
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:slug/threads",
  requireAuth,
  validateParams(boardParamsSchema),
  uploadOptionalMedia("image"),
  validateBody(createThreadSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const { subject, body } = req.validatedBody;
      const authorUserId = req.session.userId;
      const media = await processMediaUpload(req.file);

      if (!body && !media) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: ["body or media is required"],
            fieldErrors: {},
          },
        });
      }

      const created = await createThread({ boardSlug, subject, body, media, authorUserId });
      res.status(201).json(serializeCreateThreadResponse(created));
    } catch (err) {
      if (isDomainError(err, "validation_error")) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: [err.message],
            fieldErrors: {},
          },
        });
      }

      if (isDomainError(err, "board_not_found")) {
        return res.status(404).json({ error: "board_not_found" });
      }

      if (isDomainError(err, "slug_generation_failed")) {
        return res.status(500).json({ error: "slug_generation_failed" });
      }

      next(err);
    }
  },
);

router.get(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  validateQuery(listThreadsQuerySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const limit = req.validatedQuery.limit ?? 20;
      const page = req.validatedQuery.page ?? 1;

      const threads = await listThreadsForViewer({
        boardSlug,
        viewerUserId: req.session?.userId ?? null,
        limit,
        page,
      });
      res.json(serializeThreadListResponse(threads));
    } catch (err) {
      if (isDomainError(err, "board_not_found")) {
        return res.status(404).json({ error: "board_not_found" });
      }

      next(err);
    }
  },
);

router.get(
  "/:slug/rss.xml",
  validateParams(boardParamsSchema),
  validateQuery(listThreadsQuerySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const limit = req.validatedQuery.limit ?? 20;

      const threads = await listThreadsForViewer({
        boardSlug,
        viewerUserId: req.session?.userId ?? null,
        limit,
      });

      const forwardedProto = req.get("x-forwarded-proto");
      const protocol = forwardedProto?.split(",")[0]?.trim() || req.protocol;
      const host = req.get("host") || "localhost";
      const siteUrl = `${protocol}://${host}`;
      const selfUrl = `${siteUrl}${req.originalUrl}`;

      const xml = serializeBoardRssResponse({
        boardSlug,
        threads,
        siteUrl,
        selfUrl,
      });

      res.set("content-type", "application/rss+xml; charset=utf-8");
      res.send(xml);
    } catch (err) {
      if (isDomainError(err, "board_not_found")) {
        return res.status(404).json({ error: "board_not_found" });
      }

      next(err);
    }
  },
);

router.get("/:slug/announcement", validateParams(boardParamsSchema), async (req, res, next) => {
  try {
    const { slug: boardSlug } = req.validatedParams;
    const result = await getBoardAnnouncementForViewer({
      boardSlug,
      viewerUserId: req.session?.userId ?? null,
    });
    res.json(result);
  } catch (err) {
    if (isDomainError(err, "board_not_found")) {
      return res.status(404).json({ error: "board_not_found" });
    }

    next(err);
  }
});

router.put(
  "/:slug/announcement",
  requireAdmin,
  validateParams(boardParamsSchema),
  validateBody(announcementBodySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const { announcement } = req.validatedBody;
      const result = await setBoardAnnouncement({ boardSlug, announcement });
      res.json(result);
    } catch (err) {
      if (isDomainError(err, "validation_error")) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: [err.message],
            fieldErrors: {},
          },
        });
      }

      if (isDomainError(err, "board_not_found")) {
        return res.status(404).json({ error: "board_not_found" });
      }

      next(err);
    }
  },
);

router.get(
  "/:slug/:subjectSlug/:token",
  validateParams(threadPrettyParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      const detail = await getThreadDetailByPretty({
        boardSlug,
        subjectSlug,
        token,
        viewerUserId: req.session?.userId ?? null,
      });
      res.json(serializeThreadDetailResponse(detail));
    } catch (err) {
      if (isDomainError(err, "not_found")) {
        return res.status(404).json({ error: "not_found" });
      }

      next(err);
    }
  },
);

router.post(
  "/:slug/:subjectSlug/:token/replies",
  requireAuth,
  validateParams(threadPrettyParamsSchema),
  uploadOptionalMedia("image"),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      const { body } = req.validatedBody;
      const authorUserId = req.session.userId;
      const media = await processMediaUpload(req.file);

      if (!body && !media) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: ["body or media is required"],
            fieldErrors: {},
          },
        });
      }

      const created = await createReplyByPretty({ boardSlug, subjectSlug, token, body, media, authorUserId });
      res.status(201).json(serializeReplyResponse(created));
    } catch (err) {
      if (isDomainError(err, "validation_error")) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: [err.message],
            fieldErrors: {},
          },
        });
      }

      if (isDomainError(err, "not_found")) {
        return res.status(404).json({ error: "not_found" });
      }

      next(err);
    }
  },
);

router.delete(
  "/:slug/:subjectSlug/:token/replies/:postId",
  requireAuth,
  validateParams(replyDeleteParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token, postId } = req.validatedParams;
      const actorUserId = req.session.userId;
      await deleteReplyByPretty({ boardSlug, subjectSlug, token, postId, actorUserId });
      res.status(204).end();
    } catch (err) {
      if (isDomainError(err, "validation_error")) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: [err.message],
            fieldErrors: {},
          },
        });
      }

      if (isDomainError(err, "forbidden")) {
        return res.status(403).json({ error: "forbidden" });
      }

      if (isDomainError(err, "not_found")) {
        return res.status(404).json({ error: "not_found" });
      }

      next(err);
    }
  },
);

router.delete(
  "/:slug/:subjectSlug/:token",
  requireAdmin,
  validateParams(threadPrettyParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      await deleteThreadByPretty({ boardSlug, subjectSlug, token });
      res.status(204).end();
    } catch (err) {
      if (isDomainError(err, "validation_error")) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: [err.message],
            fieldErrors: {},
          },
        });
      }

      if (isDomainError(err, "not_found")) {
        return res.status(404).json({ error: "not_found" });
      }

      next(err);
    }
  },
);

export default router;
