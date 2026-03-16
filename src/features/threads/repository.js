export async function findThreadById(db, threadId) {
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

export async function findNextPostNumberForUpdateByThreadId(db, threadId) {
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

export async function bumpAndIncrementNextPostNumber(db, threadId) {
  await db.query(
    `update threads
     set bumped_at = now(),
         next_post_number = next_post_number + 1
     where id = $1`,
    [threadId],
  );
}
