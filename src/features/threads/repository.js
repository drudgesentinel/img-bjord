export async function findThreadById(db, threadId) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where id = $1`,
    [threadId],
  );

  return r.rows[0] ?? null;
}

export async function findThreadDeleteAuthById(db, threadId) {
  const r = await db.query(
    `select id, delete_key_hash
     from threads
     where id = $1`,
    [threadId],
  );

  return r.rows[0] ?? null;
}

export async function deleteThreadById(db, threadId) {
  const r = await db.query(`delete from threads where id = $1`, [threadId]);
  return r.rowCount > 0;
}

export async function listPostsByThreadId(db, threadId) {
  const r = await db.query(
    `select p.id, p.thread_id, p.author_user_id, p.post_number, p.created_at, p.body,
            p.image_url, p.image_mime_type, p.image_size_bytes, p.image_width, p.image_height,
            u.username as author_username,
            coalesce(u.is_admin, false) as author_is_admin,
            coalesce(u.tags, '{}'::text[]) as author_tags
     from posts p
     left join users u on u.id = p.author_user_id
     where p.thread_id = $1
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

export async function insertPost(
  db,
  {
    threadId,
    authorUserId = null,
    postNumber,
    body,
    imageUrl = null,
    imageMimeType = null,
    imageSizeBytes = null,
    imageWidth = null,
    imageHeight = null,
  },
) {
  const r = await db.query(
    `insert into posts (thread_id, author_user_id, post_number, body, image_url, image_mime_type, image_size_bytes, image_width, image_height)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, thread_id, author_user_id, post_number, created_at, body,
               image_url, image_mime_type, image_size_bytes, image_width, image_height`,
    [threadId, authorUserId, postNumber, body, imageUrl, imageMimeType, imageSizeBytes, imageWidth, imageHeight],
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
