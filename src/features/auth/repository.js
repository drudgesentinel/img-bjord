export async function countUsers(db) {
  const r = await db.query(`select count(*)::int as c from users`);
  return r.rows[0]?.c ?? 0;
}

export async function markUsernameConsumed(db, username) {
  await db.query(
    `insert into consumed_usernames (username)
     values ($1)`,
    [username],
  );
}

export async function listUnavailableUsernames(db) {
  const r = await db.query(
    `select username from consumed_usernames
     union
     select username from users`,
  );

  return r.rows.map((row) => row.username);
}

export async function insertUser(db, { username, passwordHash, isAdmin = false }) {
  const r = await db.query(
    `insert into users (username, password_hash, is_admin)
     values ($1, $2, $3)
     returning id, username, is_admin, tags, created_at`,
    [username, passwordHash, isAdmin],
  );

  return r.rows[0];
}

export async function findUserAuthByUsername(db, username) {
  const r = await db.query(
    `select id, username, password_hash, is_admin, tags, created_at
     from users
     where username = $1`,
    [username],
  );

  return r.rows[0] ?? null;
}

export async function existsUserByUsername(db, username) {
  const r = await db.query(`select 1 from users where username = $1`, [username]);
  return r.rowCount > 0;
}

export async function findUserAuthByDisplayUsername(db, displayUsername) {
  const r = await db.query(
    `select id, username, password_hash, is_admin, tags, created_at
     from users
     where username like $1 || '\\_%' escape '\\'
       and length(username) = length($1) + 5
       and substring(username from length($1) + 2 for 4) ~ '^[0-9]{4}$'
     order by created_at asc`,
    [displayUsername],
  );

  return r.rows;
}

export async function findUserPublicById(db, userId) {
  const r = await db.query(
    `select id, username, is_admin, tags, created_at
     from users
     where id = $1`,
    [userId],
  );

  return r.rows[0] ?? null;
}
