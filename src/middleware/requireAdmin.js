import { pool } from "../db.js";

function addAuthDebug(req, res, reason) {
  if (process.env.AUTH_DEBUG !== "true") return;

  const hasCookieHeader = Boolean(req.headers?.cookie);
  const hasSession = Boolean(req.session);
  const hasUserId = Boolean(req.session?.userId);

  const debugValue = `${reason};cookie=${hasCookieHeader};session=${hasSession};userId=${hasUserId}`;
  res.setHeader("x-bjord-auth-debug", debugValue);
  req.log?.warn?.({ authDebug: { reason, hasCookieHeader, hasSession, hasUserId } }, "admin auth check failed");
}

export async function requireAdmin(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      addAuthDebug(req, res, "missing_session_userId");
      return res.status(401).json({ error: "unauthorized" });
    }

    const r = await pool.query(`select is_admin from users where id = $1`, [userId]);
    if (r.rowCount === 0) {
      req.session?.destroy(() => {});
      addAuthDebug(req, res, "session_user_missing");
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!r.rows[0].is_admin) {
      addAuthDebug(req, res, "not_admin");
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  } catch (err) {
    next(err);
  }
}
