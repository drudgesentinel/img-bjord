import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { getThreadDetailById, createReplyByThreadId } from "./service.js";
import { serializeReplyResponse, serializeThreadDetailResponse } from "./serializer.js";

const router = Router();

const threadIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

const replySchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
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
  validateBody(replySchema),
  async (req, res, next) => {
    try {
      const { id: threadId } = req.validatedParams;
      const { body } = req.validatedBody;

      const created = await createReplyByThreadId({ threadId, body });
      res.status(201).json(serializeReplyResponse(created));
    } catch (err) {
      if (isDomainError(err, "not_found")) {
        return res.status(404).json({ error: "not_found" });
      }

      next(err);
    }
  },
);

export default router;
