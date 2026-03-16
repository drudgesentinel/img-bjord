export async function listBoards(db) {
  const r = await db.query(
    `select slug, name, created_at
     from boards
     order by slug asc`,
  );

  return r.rows;
}

export async function existsBySlug(db, boardSlug) {
  const r = await db.query(`select 1 from boards where slug = $1`, [boardSlug]);
  return r.rowCount > 0;
}
