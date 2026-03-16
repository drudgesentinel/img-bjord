import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { uploadOptionalImage } from "../../middleware/uploadImage.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { processImageUpload } from "../../lib/processImageUpload.js";
import {
  listBoards,
  createThread,
  listThreads,
  getThreadDetailByPretty,
  createReplyByPretty,
} from "./service.js";
import {
  serializeBoardsResponse,
  serializeCreateThreadResponse,
  serializeThreadListResponse,
  serializeThreadDetailResponse,
  serializeReplyResponse,
} from "./serializer.js";

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
    const boards = await listBoards();
    res.json(serializeBoardsResponse(boards));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/:slug/threads",
  validateParams(boardParamsSchema),
  uploadOptionalImage("image"),
  validateBody(createThreadSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug } = req.validatedParams;
      const { subject, body } = req.validatedBody;
      const image = await processImageUpload(req.file);

      if (!body && !image) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: ["body or image is required"],
            fieldErrors: {},
          },
        });
      }

      const created = await createThread({ boardSlug, subject, body, image });
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

      const threads = await listThreads({ boardSlug, limit });
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
  "/:slug/:subjectSlug/:token",
  validateParams(threadPrettyParamsSchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      const detail = await getThreadDetailByPretty({ boardSlug, subjectSlug, token });
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
  validateParams(threadPrettyParamsSchema),
  uploadOptionalImage("image"),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { slug: boardSlug, subjectSlug, token } = req.validatedParams;
      const { body } = req.validatedBody;
      const image = await processImageUpload(req.file);

      if (!body && !image) {
        return res.status(400).json({
          error: "validation_error",
          details: {
            formErrors: ["body or image is required"],
            fieldErrors: {},
          },
        });
      }

      const created = await createReplyByPretty({ boardSlug, subjectSlug, token, body, image });
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

export default router;
