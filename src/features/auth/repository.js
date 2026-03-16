export async function insertUser(db, { username, passwordHash }) {
  const r = await db.query(
    `insert into users (username, password_hash)
     values ($1, $2)
     returning id, username, created_at`,
    [username, passwordHash],
  );

  return r.rows[0];
}

export async function findUserAuthByUsername(db, username) {
  const r = await db.query(
    `select id, username, password_hash, created_at
     from users
     where username = $1`,
    [username],
  );

  return r.rows[0] ?? null;
}

export async function findUserPublicById(db, userId) {
  const r = await db.query(
    `select id, username, created_at
     from users
     where id = $1`,
    [userId],
  );

  return r.rows[0] ?? null;
}
