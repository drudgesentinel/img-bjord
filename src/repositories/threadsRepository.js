export async function insertThread(db, { boardSlug, subject, subjectSlug, token }) {
  const r = await db.query(
    `insert into threads (board_slug, subject, subject_slug, token)
     values ($1, $2, $3, $4)
     returning id, board_slug, subject, subject_slug, token, created_at, bumped_at`,
    [boardSlug, subject, subjectSlug, token],
  );

  return r.rows[0];
}

export async function listByBoard(db, { boardSlug, limit }) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where board_slug = $1
     order by bumped_at desc
     limit $2`,
    [boardSlug, limit],
  );

  return r.rows;
}

export async function findByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where board_slug = $1 and subject_slug = $2 and token = $3`,
    [boardSlug, subjectSlug, token],
  );

  return r.rows[0] ?? null;
}

export async function findById(db, threadId) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where id = $1`,
    [threadId],
  );

  return r.rows[0] ?? null;
}

export async function listPostsByThreadId(db, threadId) {
  const r = await db.query(
    `select id, thread_id, post_number, created_at, body
     from posts
     where thread_id = $1
     order by post_number asc`,
    [threadId],
  );

  return r.rows;
}

export async function findForUpdateByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `select id, next_post_number
     from threads
     where board_slug = $1 and subject_slug = $2 and token = $3
     for update`,
    [boardSlug, subjectSlug, token],
  );

  return r.rows[0] ?? null;
}

export async function findNextPostNumberForUpdateById(db, threadId) {
  const r = await db.query(
    `select next_post_number
     from threads
     where id = $1
     for update`,
    [threadId],
  );

  return r.rows[0] ?? null;
}

export async function insertPost(db, { threadId, postNumber, body }) {
  const r = await db.query(
    `insert into posts (thread_id, post_number, body)
     values ($1, $2, $3)
     returning id, thread_id, post_number, created_at, body`,
    [threadId, postNumber, body],
  );

  return r.rows[0];
}

export async function incrementNextPostNumber(db, threadId) {
  await db.query(
    `update threads
     set next_post_number = next_post_number + 1
     where id = $1`,
    [threadId],
  );
}

export async function bumpAndIncrementNextPostNumber(db, threadId) {
  await db.query(
    `update threads
     set bumped_at = now(),
         next_post_number = next_post_number + 1
     where id = $1`,
    [threadId],
  );
}
