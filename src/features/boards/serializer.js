export function serializeBoard(board) {
  return {
    slug: board.slug,
    name: board.name,
    visible_to_tags: board.visible_to_tags ?? [],
    announcement: board.announcement ?? "",
    created_at: board.created_at,
  };
}

export function serializePost(post) {
  const mediaType = post.media_type ?? (post.image_url ? "image" : null);
  const mediaUrl = post.media_url ?? post.image_url ?? null;
  const mediaMimeType = post.media_mime_type ?? post.image_mime_type ?? null;
  const mediaSizeBytes = post.media_size_bytes ?? post.image_size_bytes ?? null;
  const mediaWidth = post.media_width ?? post.image_width ?? null;
  const mediaHeight = post.media_height ?? post.image_height ?? null;

  return {
    id: post.id,
    thread_id: post.thread_id,
    author_user_id: post.author_user_id ?? null,
    author_username: post.author_username ?? null,
    author_is_admin: post.author_is_admin ?? false,
    author_tags: post.author_tags ?? [],
    post_number: post.post_number,
    created_at: post.created_at,
    body: post.body,
    media_type: mediaType,
    media_url: mediaUrl,
    media_mime_type: mediaMimeType,
    media_size_bytes: mediaSizeBytes,
    media_width: mediaWidth,
    media_height: mediaHeight,
    media_duration_sec: post.media_duration_sec ?? null,
    image_url: mediaType === "image" ? mediaUrl : null,
    image_mime_type: mediaType === "image" ? mediaMimeType : null,
    image_size_bytes: mediaType === "image" ? mediaSizeBytes : null,
    image_width: mediaType === "image" ? mediaWidth : null,
    image_height: mediaType === "image" ? mediaHeight : null,
  };
}

export function serializeThread(thread) {
  return {
    id: thread.id,
    board_slug: thread.board_slug,
    subject: thread.subject,
    subject_slug: thread.subject_slug,
    token: thread.token,
    created_at: thread.created_at,
    bumped_at: thread.bumped_at,
  };
}

export function serializeBoardsResponse(boards) {
  return {
    boards: boards.map(serializeBoard),
  };
}

export function serializeThreadListResponse(threads) {
  return {
    threads: threads.map(serializeThread),
  };
}

export function serializeThreadDetailResponse({ thread, posts }) {
  return {
    thread: serializeThread(thread),
    posts: posts.map(serializePost),
  };
}

export function serializeCreateThreadResponse({ thread, firstPost, canonicalPath }) {
  return {
    thread: serializeThread(thread),
    firstPost: serializePost(firstPost),
    canonicalPath,
  };
}

export function serializeReplyResponse({ post }) {
  return {
    post: serializePost(post),
  };
}
