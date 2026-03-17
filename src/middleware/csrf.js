import crypto from "node:crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function csrfEnabled() {
  if (process.env.CSRF_PROTECTION === "false") return false;
  return process.env.NODE_ENV !== "test";
}

export function ensureCsrfToken(req) {
  if (!req.session) return null;

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

export function csrfTokenRoute(req, res) {
  const csrfToken = ensureCsrfToken(req);
  return res.json({ csrfToken });
}

export function requireCsrf(req, res, next) {
  if (!csrfEnabled()) return next();

  const method = String(req.method ?? "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return next();

  const path = req.path ?? "";
  if (path === "/api/auth/csrf") return next();
  if (!path.startsWith("/api/")) return next();

  const expected = ensureCsrfToken(req);
  const provided = req.get("x-csrf-token");

  if (!expected || !provided || provided !== expected) {
    return res.status(403).json({ error: "csrf_invalid" });
  }

  return next();
}
