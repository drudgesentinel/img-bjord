import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import { withTransaction } from "../../lib/withTransaction.js";
import {
  slugifySubject,
  makeThreadToken,
  normalizeToken,
  isUniqueViolation,
} from "../../lib/threadSlug.js";
import { generateDeleteKey, hashDeleteKey } from "../../lib/deleteKey.js";
import { deleteMediaByUrl } from "../../lib/mediaStorage.js";
import * as repo from "./repository.js";

function canViewerAccessBoard(board, viewer) {
  const boardTags = Array.isArray(board?.visible_to_tags) ? board.visible_to_tags : [];
  if (viewer?.is_admin) return true;
  if (boardTags.length === 0) return true;

  const viewerTags = new Set(Array.isArray(viewer?.tags) ? viewer.tags : []);
  return boardTags.some((tag) => viewerTags.has(tag));
}

async function getViewerById(userId, db = pool) {
  if (!userId) return null;

  const viewer = await repo.findViewerById(db, userId);
  return viewer ?? null;
}

export async function listBoards({ viewerUserId = null } = {}) {
  const [boards, viewer] = await Promise.all([repo.listBoards(pool), getViewerById(viewerUserId)]);

  return boards.filter((board) => canViewerAccessBoard(board, viewer));
}

export async function createThread({ boardSlug, subject, body, media = null, authorUserId }) {
  const subjectOrNull = subject ?? null;
  const subjectSlug = slugifySubject(subjectOrNull ?? "");
  const deleteKey = generateDeleteKey();
  const deleteKeyHash = hashDeleteKey(deleteKey);

  return withTransaction(pool, async (client) => {
    const [board, viewer] = await Promise.all([
      repo.findBoardBySlug(client, boardSlug),
      getViewerById(authorUserId, client),
    ]);

    if (!viewer || !board || !canViewerAccessBoard(board, viewer)) {
      throw new DomainError("board_not_found");
    }

    let thread = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const token = normalizeToken(makeThreadToken());

      try {
        thread = await repo.insertThread(client, {
          boardSlug,
          subject: subjectOrNull,
          subjectSlug: subjectSlug || "thread",
          token,
          deleteKeyHash,
        });
        break;
      } catch (err) {
        if (isUniqueViolation(err)) continue;
        throw err;
      }
    }

    if (!thread) {
      throw new DomainError("slug_generation_failed");
    }

    const row = await repo.findNextPostNumberForUpdateByThreadId(client, thread.id);
    if (!row) {
      throw new Error("thread_missing_after_insert");
    }

    const firstPost = await repo.insertPost(client, {
      threadId: thread.id,
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

    await repo.incrementNextPostNumber(client, thread.id);

    const canonicalPath = `/api/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`;
    return { thread, firstPost, canonicalPath, deleteKey };
  });
}

export async function listThreadsForViewer({ boardSlug, viewerUserId = null, limit = 20 }) {
  const [board, viewer] = await Promise.all([repo.findBoardBySlug(pool, boardSlug), getViewerById(viewerUserId)]);

  if (!board || !canViewerAccessBoard(board, viewer)) {
    throw new DomainError("board_not_found");
  }

  return repo.listThreadsByBoard(pool, { boardSlug, limit });
}

export async function getThreadDetailByPretty({ boardSlug, subjectSlug, token, viewerUserId = null }) {
  const [thread, board, viewer] = await Promise.all([
    repo.findThreadByPretty(pool, {
      boardSlug,
      subjectSlug,
      token: normalizeToken(token),
    }),
    repo.findBoardBySlug(pool, boardSlug),
    getViewerById(viewerUserId),
  ]);

  if (!thread || !board || !canViewerAccessBoard(board, viewer)) {
    throw new DomainError("not_found");
  }

  const posts = await repo.listPostsByThreadId(pool, thread.id);
  return { thread, posts };
}

export async function createReplyByPretty({ boardSlug, subjectSlug, token, body, media = null, authorUserId }) {
  return withTransaction(pool, async (client) => {
    const [board, viewer] = await Promise.all([
      repo.findBoardBySlug(client, boardSlug),
      getViewerById(authorUserId, client),
    ]);

    if (!viewer || !board || !canViewerAccessBoard(board, viewer)) {
      throw new DomainError("not_found");
    }

    const thread = await repo.findThreadForUpdateByPretty(client, {
      boardSlug,
      subjectSlug,
      token: normalizeToken(token),
    });

    if (!thread) {
      throw new DomainError("not_found");
    }

    const post = await repo.insertPost(client, {
      threadId: thread.id,
      authorUserId,
      postNumber: thread.next_post_number,
      body,
      mediaType: media?.mediaType ?? null,
      mediaUrl: media?.mediaUrl ?? null,
      mediaMimeType: media?.mediaMimeType ?? null,
      mediaSizeBytes: media?.mediaSizeBytes ?? null,
      mediaWidth: media?.mediaWidth ?? null,
      mediaHeight: media?.mediaHeight ?? null,
      mediaDurationSec: media?.mediaDurationSec ?? null,
    });

    await repo.bumpAndIncrementNextPostNumber(client, thread.id);

    return { post };
  });
}

export async function deleteThreadByPretty({ boardSlug, subjectSlug, token }) {
  const normalizedToken = normalizeToken(token);

  const thread = await repo.findThreadByPretty(pool, {
    boardSlug,
    subjectSlug,
    token: normalizedToken,
  });

  if (!thread) {
    throw new DomainError("not_found");
  }

  await repo.deleteThreadById(pool, thread.id);
}

export async function deleteReplyByPretty({ boardSlug, subjectSlug, token, postId, actorUserId }) {
  const mediaUrls = await withTransaction(pool, async (client) => {
    const [board, viewer] = await Promise.all([
      repo.findBoardBySlug(client, boardSlug),
      getViewerById(actorUserId, client),
    ]);

    if (!viewer || !board || !canViewerAccessBoard(board, viewer)) {
      throw new DomainError("not_found");
    }

    const post = await repo.findPostDeleteCandidateByPretty(client, {
      boardSlug,
      subjectSlug,
      token: normalizeToken(token),
      postId,
    });

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
