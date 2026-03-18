import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import { deleteMediaByUrl } from "../../lib/mediaStorage.js";
import { withTransaction } from "../../lib/withTransaction.js";
import * as repo from "./repository.js";

function canViewerAccessBoardTags(boardTags, viewer) {
  const tags = Array.isArray(boardTags) ? boardTags : [];
  if (viewer?.is_admin) return true;
  if (tags.length === 0) return true;

  const viewerTags = new Set(Array.isArray(viewer?.tags) ? viewer.tags : []);
  return tags.some((tag) => viewerTags.has(tag));
}

async function getViewerById(userId, db = pool) {
  if (!userId) return null;
  const viewer = await repo.findViewerById(db, userId);
  if (!viewer) throw new DomainError("not_found");
  return viewer;
}

export async function getThreadDetailById(threadId, viewerUserId = null) {
  const thread = await repo.findThreadById(pool, threadId);
  const viewer = await getViewerById(viewerUserId).catch((err) => {
    if (err instanceof DomainError && err.code === "not_found") return null;
    throw err;
  });

  if (!thread || !canViewerAccessBoardTags(thread.visible_to_tags, viewer)) {
    throw new DomainError("not_found");
  }

  const posts = await repo.listPostsByThreadId(pool, threadId);
  return { thread, posts };
}

export async function createReplyByThreadId({ threadId, body, media = null, authorUserId }) {
  return withTransaction(pool, async (client) => {
    const [row, viewer] = await Promise.all([
      repo.findNextPostNumberForUpdateByThreadId(client, threadId),
      getViewerById(authorUserId, client),
    ]);

    if (!row || !canViewerAccessBoardTags(row.visible_to_tags, viewer)) {
      throw new DomainError("not_found");
    }

    const post = await repo.insertPost(client, {
      threadId,
      authorUserId,
      postNumber: row.next_post_number,
      body,
      mediaType: media?.mediaType ?? null,
      mediaUrl: media?.mediaUrl ?? null,
      mediaMimeType: media?.mediaMimeType ?? null,
      mediaSizeBytes: media?.mediaSizeBytes ?? null,
      mediaWidth: media?.mediaWidth ?? null,
      mediaHeight: media?.mediaHeight ?? null,
      mediaDurationSec: media?.mediaDurationSec ?? null,
    });

    await repo.bumpAndIncrementNextPostNumber(client, threadId);

    return { post };
  });
}

export async function deleteThreadById({ threadId }) {
  const deleted = await repo.deleteThreadById(pool, threadId);
  if (!deleted) {
    throw new DomainError("not_found");
  }
}

export async function deleteReplyByThreadId({ threadId, postId, actorUserId }) {
  const mediaUrls = await withTransaction(pool, async (client) => {
    const [row, viewer] = await Promise.all([
      repo.findNextPostNumberForUpdateByThreadId(client, threadId),
      getViewerById(actorUserId, client),
    ]);

    if (!row || !canViewerAccessBoardTags(row.visible_to_tags, viewer)) {
      throw new DomainError("not_found");
    }

    const post = await repo.findPostDeleteCandidateByThreadId(client, { threadId, postId });
    if (!post) {
      throw new DomainError("not_found");
    }

    if (post.post_number === 1) {
      throw new DomainError("validation_error", "cannot_delete_original_post");
    }

    const isOwner = post.author_user_id === actorUserId;
    if (!viewer.is_admin && !isOwner) {
      throw new DomainError("forbidden");
    }

    const deleted = await repo.deletePostById(client, post.id);
    if (!deleted) {
      throw new DomainError("not_found");
    }

    return [...new Set([post.media_url, post.image_url].filter(Boolean))];
  });

  for (const url of mediaUrls) {
    await deleteMediaByUrl(url).catch((err) => {
      console.warn("failed_to_delete_media", { url, message: err?.message ?? String(err) });
    });
  }
}
