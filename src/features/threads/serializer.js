export function serializePost(post) {
  return {
    id: post.id,
    thread_id: post.thread_id,
    post_number: post.post_number,
    created_at: post.created_at,
    body: post.body,
    image_url: post.image_url,
    image_mime_type: post.image_mime_type,
    image_size_bytes: post.image_size_bytes,
    image_width: post.image_width,
    image_height: post.image_height,
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

export function serializeThreadDetailResponse({ thread, posts }) {
  return {
    thread: serializeThread(thread),
    posts: posts.map(serializePost),
  };
}

export function serializeReplyResponse({ post }) {
  return {
    post: serializePost(post),
  };
}
