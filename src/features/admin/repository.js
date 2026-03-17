export async function listUsers(db) {
  const r = await db.query(
    `select id, username, activation_code, is_approved, is_admin, tags, created_at
     from users
     order by created_at asc`,
  );

  return r.rows;
}

export async function findUserById(db, userId) {
  const r = await db.query(
    `select id, username, activation_code, is_approved, is_admin, tags, created_at
     from users
     where id = $1`,
    [userId],
  );

  return r.rows[0] ?? null;
}

export async function countAdmins(db) {
  const r = await db.query(`select count(*)::int as c from users where is_admin = true`);
  return r.rows[0]?.c ?? 0;
}

export async function deleteUserById(db, userId) {
  const r = await db.query(`delete from users where id = $1`, [userId]);
  return r.rowCount > 0;
}

export async function updateUserTags(db, { userId, tags }) {
  const r = await db.query(
    `update users
     set tags = $2
     where id = $1
     returning id, username, activation_code, is_approved, is_admin, tags, created_at`,
    [userId, tags],
  );

  return r.rows[0] ?? null;
}

export async function approveUserById(db, userId) {
  const r = await db.query(
    `update users
     set is_approved = true
     where id = $1
     returning id, username, activation_code, is_approved, is_admin, tags, created_at`,
    [userId],
  );

  return r.rows[0] ?? null;
}

export async function listBoards(db) {
  const r = await db.query(
    `select slug, name, created_at
     from boards
     order by slug asc`,
  );

  return r.rows;
}

export async function insertBoard(db, { slug, name }) {
  const r = await db.query(
    `insert into boards (slug, name)
     values ($1, $2)
     returning slug, name, created_at`,
    [slug, name],
  );

  return r.rows[0] ?? null;
}

export async function deleteBoardBySlug(db, slug) {
  const r = await db.query(`delete from boards where slug = $1`, [slug]);
  return r.rowCount > 0;
}
