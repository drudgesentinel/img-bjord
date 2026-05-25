export async function listBoards(db) {
  const r = await db.query(
    `select slug, name, visible_to_tags, announcement, created_at
     from boards
     order by slug asc`,
  );

  return r.rows;
}

export async function existsBoardBySlug(db, boardSlug) {
  const r = await db.query(`select 1 from boards where slug = $1`, [boardSlug]);
  return r.rowCount > 0;
}

export async function findBoardBySlug(db, boardSlug) {
  const r = await db.query(
    `select slug, name, visible_to_tags, announcement, created_at
     from boards
     where slug = $1`,
    [boardSlug],
  );

  return r.rows[0] ?? null;
}

export async function updateBoardAnnouncementBySlug(db, { slug, announcement }) {
  const r = await db.query(
    `update boards
     set announcement = $2
     where slug = $1
     returning slug, name, visible_to_tags, announcement, created_at`,
    [slug, announcement],
  );

  return r.rows[0] ?? null;
}

export async function findViewerById(db, userId) {
  const r = await db.query(
    `select is_admin, tags
     from users
     where id = $1`,
    [userId],
  );

  return r.rows[0] ?? null;
}

export async function insertThread(db, { boardSlug, subject, subjectSlug, token, deleteKeyHash }) {
  const r = await db.query(
    `insert into threads (board_slug, subject, subject_slug, token, delete_key_hash)
     values ($1, $2, $3, $4, $5)
     returning id, board_slug, subject, subject_slug, token, created_at, bumped_at`,
    [boardSlug, subject, subjectSlug, token, deleteKeyHash],
  );

  return r.rows[0];
}

export async function listThreadsByBoard(db, { boardSlug, limit, offset = 0 }) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where board_slug = $1
     order by bumped_at desc
     limit $2
     offset $3`,
    [boardSlug, limit, offset],
  );

  return r.rows;
}

export async function listThreadsAcrossBoards(db, { limit }) {
  const r = await db.query(
    `select t.id,
            t.board_slug,
            t.subject,
            t.subject_slug,
            t.token,
            t.created_at,
            t.bumped_at,
            b.visible_to_tags
     from threads t
     join boards b on b.slug = t.board_slug
     order by t.bumped_at desc
     limit $1`,
    [limit],
  );

  return r.rows;
}

export async function listLatestPosts(db, { limit }) {
  const r = await db.query(
    `select p.id,
            p.thread_id,
            p.author_user_id,
            p.post_number,
            p.created_at,
            p.body,
            p.image_url,
            p.image_mime_type,
            p.image_size_bytes,
            p.image_width,
            p.image_height,
            p.media_type,
            p.media_url,
            p.media_mime_type,
            p.media_size_bytes,
            p.media_width,
            p.media_height,
            p.media_duration_sec,
            u.username as author_username,
            coalesce(u.is_admin, false) as author_is_admin,
            coalesce(u.tags, '{}'::text[]) as author_tags,
            t.board_slug,
            t.subject,
            t.subject_slug,
            t.token,
            b.visible_to_tags
     from posts p
     join threads t on t.id = p.thread_id
     join boards b on b.slug = t.board_slug
     left join users u on u.id = p.author_user_id
     where p.post_number = 1
     order by t.bumped_at desc, p.created_at desc
     limit $1`,
    [limit],
  );

  return r.rows;
}

export async function findThreadByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `select id, board_slug, subject, subject_slug, token, created_at, bumped_at
     from threads
     where board_slug = $1 and subject_slug = $2 and token = $3`,
    [boardSlug, subjectSlug, token],
  );

  return r.rows[0] ?? null;
}

export async function deleteThreadByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `delete from threads
     where board_slug = $1 and subject_slug = $2 and token = $3`,
    [boardSlug, subjectSlug, token],
  );

  return r.rowCount > 0;
}

export async function findThreadDeleteAuthByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `select id, delete_key_hash
     from threads
     where board_slug = $1 and subject_slug = $2 and token = $3`,
    [boardSlug, subjectSlug, token],
  );

  return r.rows[0] ?? null;
}

export async function deleteThreadById(db, threadId) {
  const r = await db.query(`delete from threads where id = $1`, [threadId]);
  return r.rowCount > 0;
}

export async function findThreadForUpdateByPretty(db, { boardSlug, subjectSlug, token }) {
  const r = await db.query(
    `select id, next_post_number
     from threads
     where board_slug = $1 and subject_slug = $2 and token = $3
     for update`,
    [boardSlug, subjectSlug, token],
  );

  return r.rows[0] ?? null;
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

export async function listPostsByThreadId(db, threadId) {
  const r = await db.query(
    `select p.id, p.thread_id, p.author_user_id, p.post_number, p.created_at, p.body,
            p.image_url, p.image_mime_type, p.image_size_bytes, p.image_width, p.image_height,
            p.media_type, p.media_url, p.media_mime_type, p.media_size_bytes, p.media_width, p.media_height, p.media_duration_sec,
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

export async function insertPost(
  db,
  {
    threadId,
    authorUserId = null,
    postNumber,
    body,
    mediaType = null,
    mediaUrl = null,
    mediaMimeType = null,
    mediaSizeBytes = null,
    mediaWidth = null,
    mediaHeight = null,
    mediaDurationSec = null,
  },
) {
  const isImage = mediaType === "image";
  const imageUrl = isImage ? mediaUrl : null;
  const imageMimeType = isImage ? mediaMimeType : null;
  const imageSizeBytes = isImage ? mediaSizeBytes : null;
  const imageWidth = isImage ? mediaWidth : null;
  const imageHeight = isImage ? mediaHeight : null;

  const r = await db.query(
    `insert into posts (
       thread_id, author_user_id, post_number, body,
       image_url, image_mime_type, image_size_bytes, image_width, image_height,
       media_type, media_url, media_mime_type, media_size_bytes, media_width, media_height, media_duration_sec
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     returning id, thread_id, author_user_id, post_number, created_at, body,
               image_url, image_mime_type, image_size_bytes, image_width, image_height,
               media_type, media_url, media_mime_type, media_size_bytes, media_width, media_height, media_duration_sec`,
    [
      threadId,
      authorUserId,
      postNumber,
      body,
      imageUrl,
      imageMimeType,
      imageSizeBytes,
      imageWidth,
      imageHeight,
      mediaType,
      mediaUrl,
      mediaMimeType,
      mediaSizeBytes,
      mediaWidth,
      mediaHeight,
      mediaDurationSec,
    ],
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

export async function findPostDeleteCandidateByPretty(db, { boardSlug, subjectSlug, token, postId }) {
  const r = await db.query(
    `select p.id, p.thread_id, p.author_user_id, p.post_number, p.media_url, p.image_url
     from threads t
     join posts p on p.thread_id = t.id
     where t.board_slug = $1
       and t.subject_slug = $2
       and t.token = $3
       and p.id = $4`,
    [boardSlug, subjectSlug, token, postId],
  );

  return r.rows[0] ?? null;
}

export async function deletePostById(db, postId) {
  const r = await db.query(`delete from posts where id = $1`, [postId]);
  return r.rowCount > 0;
}
