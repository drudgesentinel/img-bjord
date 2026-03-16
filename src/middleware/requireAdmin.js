import { pool } from "../db.js";

export async function requireAdmin(req, res, next) {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const r = await pool.query(`select is_admin from users where id = $1`, [userId]);
    if (r.rowCount === 0) {
      req.session?.destroy(() => {});
      return res.status(401).json({ error: "unauthorized" });
    }

    if (!r.rows[0].is_admin) {
      return res.status(403).json({ error: "forbidden" });
    }

    next();
  } catch (err) {
    next(err);
  }
}
