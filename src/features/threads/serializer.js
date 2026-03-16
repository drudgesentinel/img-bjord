export function serializePost(post) {
  return {
    id: post.id,
    thread_id: post.thread_id,
    post_number: post.post_number,
    created_at: post.created_at,
    body: post.body,
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
