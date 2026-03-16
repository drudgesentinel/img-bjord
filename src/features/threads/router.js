import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { uploadOptionalImage } from "../../middleware/uploadImage.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { processImageUpload } from "../../lib/processImageUpload.js";
import { getThreadDetailById, createReplyByThreadId, deleteThreadById } from "./service.js";
import { serializeReplyResponse, serializeThreadDetailResponse } from "./serializer.js";

const router = Router();

const threadIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

const replySchema = z
  .object({
    body: z.string().trim().max(5000).optional().default(""),
  })
  .strict();

const deleteThreadQuerySchema = z
  .object({
    key: z.string().trim().min(1).max(128),
  })
  .strict();

router.get("/:id", validateParams(threadIdParamsSchema), async (req, res, next) => {
  try {
    const { id: threadId } = req.validatedParams;

    const detail = await getThreadDetailById(threadId);
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
  validateParams(threadIdParamsSchema),
  uploadOptionalImage("image"),
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.validatedParams;
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

      const created = await createReplyByThreadId({ threadId, body, image });
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

router.delete("/:id", validateParams(threadIdParamsSchema), validateQuery(deleteThreadQuerySchema), async (req, res, next) => {
  try {
    const { id: threadId } = req.validatedParams;
    const { key } = req.validatedQuery;
    await deleteThreadById({ threadId, deleteKey: key });
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

    if (isDomainError(err, "invalid_delete_key")) {
      return res.status(403).json({ error: "invalid_delete_key" });
    }

    if (isDomainError(err, "not_found")) {
      return res.status(404).json({ error: "not_found" });
    }

    next(err);
  }
});

export default router;
