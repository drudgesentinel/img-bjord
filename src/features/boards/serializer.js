export function serializeBoard(board) {
  return {
    slug: board.slug,
    name: board.name,
    visible_to_tags: board.visible_to_tags ?? [],
    announcement: board.announcement ?? "",
    created_at: board.created_at,
  };
}

export function serializeLatestPost(post) {
  return {
    ...serializePost(post),
    board_slug: post.board_slug,
    subject: post.subject,
    subject_slug: post.subject_slug,
    token: post.token,
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

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toAbsoluteUrl(siteUrl, pathname) {
  return new URL(pathname, siteUrl).toString();
}

function toRfc822Date(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
}

export function serializeBoardRssResponse({ boardSlug, threads, siteUrl, selfUrl }) {
  const channelTitle = `/${boardSlug}/ - Krepost`;
  const channelLink = toAbsoluteUrl(siteUrl, `/boards/${boardSlug}`);
  const channelDescription = `Latest threads from /${boardSlug}/`;
  const lastBuildDate = threads[0]?.bumped_at ?? new Date().toISOString();

  const itemsXml = threads
    .map((thread) => {
      const subject = thread.subject?.trim() || "(untitled)";
      const threadPath = `/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`;
      const threadUrl = toAbsoluteUrl(siteUrl, threadPath);
      const pubDate = toRfc822Date(thread.bumped_at ?? thread.created_at);

      return [
        "    <item>",
        `      <title>${escapeXml(subject)}</title>`,
        `      <link>${escapeXml(threadUrl)}</link>`,
        `      <guid isPermaLink=\"true\">${escapeXml(threadUrl)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\">",
    "  <channel>",
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(channelDescription)}</description>`,
    `    <lastBuildDate>${escapeXml(toRfc822Date(lastBuildDate))}</lastBuildDate>`,
    `    <docs>${escapeXml("https://www.rssboard.org/rss-specification")}</docs>`,
    `    <generator>${escapeXml("img-bjord")}</generator>`,
    `    <atom:link xmlns:atom=\"http://www.w3.org/2005/Atom\" href=\"${escapeXml(selfUrl)}\" rel=\"self\" type=\"application/rss+xml\" />`,
    itemsXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function serializeGlobalRssResponse({ threads, siteUrl, selfUrl }) {
  const channelTitle = "All boards - Krepost";
  const channelLink = toAbsoluteUrl(siteUrl, "/");
  const channelDescription = "Latest threads across all boards";
  const lastBuildDate = threads[0]?.bumped_at ?? new Date().toISOString();

  const itemsXml = threads
    .map((thread) => {
      const subject = thread.subject?.trim() || "(untitled)";
      const threadPath = `/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`;
      const threadUrl = toAbsoluteUrl(siteUrl, threadPath);
      const pubDate = toRfc822Date(thread.bumped_at ?? thread.created_at);
      const itemTitle = `/${thread.board_slug}/ ${subject}`;

      return [
        "    <item>",
        `      <title>${escapeXml(itemTitle)}</title>`,
        `      <link>${escapeXml(threadUrl)}</link>`,
        `      <guid isPermaLink=\"true\">${escapeXml(threadUrl)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\">",
    "  <channel>",
    `    <title>${escapeXml(channelTitle)}</title>`,
    `    <link>${escapeXml(channelLink)}</link>`,
    `    <description>${escapeXml(channelDescription)}</description>`,
    `    <lastBuildDate>${escapeXml(toRfc822Date(lastBuildDate))}</lastBuildDate>`,
    `    <docs>${escapeXml("https://www.rssboard.org/rss-specification")}</docs>`,
    `    <generator>${escapeXml("img-bjord")}</generator>`,
    `    <atom:link xmlns:atom=\"http://www.w3.org/2005/Atom\" href=\"${escapeXml(selfUrl)}\" rel=\"self\" type=\"application/rss+xml\" />`,
    itemsXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function serializeLatestPostListResponse(posts) {
  return {
    posts: posts.map(serializeLatestPost),
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
