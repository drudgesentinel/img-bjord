import { z } from "zod";

function badRequest(res, error) {
  return res.status(400).json({
    error: "validation_error",
    details: error.flatten(),
  });
}

/**
 * Validates req.body against a Zod schema.
 * On success: puts the parsed data in req.validatedBody
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error);
    req.validatedBody = parsed.data;
    next();
  };
}

/**
 * Validates req.query against a Zod schema.
 * On success: puts parsed data in req.validatedQuery
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return badRequest(res, parsed.error);
    req.validatedQuery = parsed.data;
    next();
  };
}

/**
 * Validates req.params against a Zod schema.
 * On success: puts parsed data in req.validatedParams
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) return badRequest(res, parsed.error);
    req.validatedParams = parsed.data;
    next();
  };
}
