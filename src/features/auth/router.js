import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../../middleware/validate.js";
import { isDomainError } from "../../lib/domainErrors.js";
import { getSessionUser, loginUser, registerUserWithGeneratedUsername } from "./service.js";

const router = Router();

const registerSchema = z
  .object({
    password: z.string().min(8).max(200),
  })
  .strict();

const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(200),
  })
  .strict();

router.get("/me", async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const user = await getSessionUser(userId);
    res.json({ user });
  } catch (err) {
    if (isDomainError(err, "not_found")) {
      req.session?.destroy(() => {});
      return res.status(401).json({ error: "unauthorized" });
    }

    next(err);
  }
});

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { password } = req.validatedBody;
    const user = await registerUserWithGeneratedUsername({ password });
    req.session.userId = user.id;

    res.status(201).json({ user });
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

    if (isDomainError(err, "username_generation_failed")) {
      return res.status(500).json({ error: "username_generation_failed" });
    }

    next(err);
  }
});

router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await loginUser(req.validatedBody);
    req.session.userId = user.id;
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

    if (isDomainError(err, "invalid_credentials")) {
      return res.status(401).json({ error: "invalid_credentials" });
    }

    next(err);
  }
});

router.post("/logout", (req, res) => {
  req.session?.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "internal_error" });
    }

    res.clearCookie("bjord.sid");
    return res.status(204).end();
  });
});

export default router;
