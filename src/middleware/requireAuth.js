function addAuthDebug(req, res, reason) {
  if (process.env.AUTH_DEBUG !== "true") return;

  const hasCookieHeader = Boolean(req.headers?.cookie);
  const hasSession = Boolean(req.session);
  const hasUserId = Boolean(req.session?.userId);

  const debugValue = `${reason};cookie=${hasCookieHeader};session=${hasSession};userId=${hasUserId}`;
  res.setHeader("x-bjord-auth-debug", debugValue);
  req.log?.warn?.({ authDebug: { reason, hasCookieHeader, hasSession, hasUserId } }, "auth check failed");
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    addAuthDebug(req, res, "missing_session_userId");
    return res.status(401).json({ error: "unauthorized" });
  }

  next();
}
