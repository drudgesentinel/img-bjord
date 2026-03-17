import { Router } from "express";
import { z } from "zod";
import { validateBody, validateParams } from "../../middleware/validate.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { approveUser, createBoard, deleteBoard, deleteUser, listBoards, listUsers, setUserTags } from "./service.js";

const router = Router();

const userParamsSchema = z.object({ id: z.string().uuid() }).strict();

const tagsSchema = z
  .object({
    tags: z.array(z.string()).max(32),
  })
  .strict();

const boardSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
    name: z.string().trim().min(1).max(100),
  })
  .strict();

const boardParamsSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]{1,20}$/),
  })
  .strict();

router.get("/users", requireAdmin, async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get("/boards", requireAdmin, async (req, res, next) => {
  try {
    const boards = await listBoards();
    res.json({ boards });
  } catch (err) {
    next(err);
  }
});

router.post("/boards", requireAdmin, validateBody(boardSchema), async (req, res, next) => {
  try {
    const board = await createBoard(req.validatedBody);
    res.status(201).json({ board });
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

    if (isDomainError(err, "already_exists")) {
      return res.status(409).json({ error: "already_exists" });
    }

    next(err);
  }
});

router.delete("/boards/:slug", requireAdmin, validateParams(boardParamsSchema), async (req, res, next) => {
  try {
    const { slug } = req.validatedParams;
    await deleteBoard({ slug });
    res.status(204).end();
  } catch (err) {
    if (isDomainError(err, "not_found")) {
      return res.status(404).json({ error: "not_found" });
    }

    if (isDomainError(err, "board_not_empty")) {
      return res.status(409).json({ error: "board_not_empty" });
    }

    next(err);
  }
});

router.delete("/users/:id", requireAdmin, validateParams(userParamsSchema), async (req, res, next) => {
  try {
    const { id: userId } = req.validatedParams;
    const actorUserId = req.session.userId;
    const result = await deleteUser({ userId, actorUserId });

    if (result.deletedSelf) {
      req.session?.destroy(() => {});
      res.clearCookie("bjord.sid");
    }

    res.status(204).end();
  } catch (err) {
    if (isDomainError(err, "not_found")) {
      return res.status(404).json({ error: "not_found" });
    }

    if (isDomainError(err, "last_admin")) {
      return res.status(400).json({ error: "last_admin" });
    }

    next(err);
  }
});

router.post("/users/:id/approve", requireAdmin, validateParams(userParamsSchema), async (req, res, next) => {
  try {
    const { id: userId } = req.validatedParams;
    await approveUser({ userId });
    res.status(204).end();
  } catch (err) {
    if (isDomainError(err, "not_found")) {
      return res.status(404).json({ error: "not_found" });
    }

    next(err);
  }
});

router.put(
  "/users/:id/tags",
  requireAdmin,
  validateParams(userParamsSchema),
  validateBody(tagsSchema),
  async (req, res, next) => {
    try {
      const { id: userId } = req.validatedParams;
      const { tags } = req.validatedBody;
      const user = await setUserTags({ userId, tags });
      res.json({ user });
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
