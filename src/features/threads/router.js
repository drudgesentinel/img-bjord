import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { uploadOptionalMedia } from "../../middleware/uploadImage.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { processMediaUpload } from "../../lib/processMediaUpload.js";
import {
  getThreadDetailById,
  createReplyByThreadId,
  deleteReplyByThreadId,
  deleteThreadById,
} from "./service.js";
import { serializeReplyResponse, serializeThreadDetailResponse } from "./serializer.js";

const router = Router();

const threadIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
const replyDeleteParamsSchema = z
  .object({
    id: z.string().uuid(),
    postId: z.string().uuid(),
  })
  .strict();

const replySchema = z
  .object({
    body: z.string().trim().max(5000).optional().default(""),
  })
  .strict();

router.get("/:id", validateParams(threadIdParamsSchema), async (req, res, next) => {
  try {
    const { id: threadId } = req.validatedParams;

    const detail = await getThreadDetailById(threadId, req.session?.userId ?? null);
    res.json(serializeThreadDetailResponse(detail));
  } catch (err) {
    if (isDomainError(err, "not_found")) {
      return res.status(404).json({ error: "not_found" });
    }

    next(err);
  }
});

router.post(
  "/:id/replies",
  requireAuth,
  validateParams(threadIdParamsSchema),
  uploadOptionalMedia("image"),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.validatedParams;
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

      const created = await createReplyByThreadId({ threadId, body, media, authorUserId });
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

router.delete("/:id", requireAdmin, validateParams(threadIdParamsSchema), async (req, res, next) => {
  try {
    const { id: threadId } = req.validatedParams;
    await deleteThreadById({ threadId });
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
});

router.delete(
  "/:id/replies/:postId",
  requireAuth,
  validateParams(replyDeleteParamsSchema),
  async (req, res, next) => {
    try {
      const { id: threadId, postId } = req.validatedParams;
      const actorUserId = req.session.userId;
      await deleteReplyByThreadId({ threadId, postId, actorUserId });
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

export default router;
