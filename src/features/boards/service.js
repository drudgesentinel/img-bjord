import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import { withTransaction } from "../../lib/withTransaction.js";
import {
  slugifySubject,
  makeThreadToken,
  normalizeToken,
  isUniqueViolation,
} from "../../lib/threadSlug.js";
import * as repo from "./repository.js";

export async function listBoards() {
  return repo.listBoards(pool);
}

export async function createThread({ boardSlug, subject, body }) {
  const subjectOrNull = subject ?? null;
  const subjectSlug = slugifySubject(subjectOrNull ?? "");

  return withTransaction(pool, async (client) => {
    const boardExists = await repo.existsBoardBySlug(client, boardSlug);
    if (!boardExists) {
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
      postNumber: row.next_post_number,
      body,
    });

    await repo.incrementNextPostNumber(client, thread.id);

    const canonicalPath = `/api/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`;
    return { thread, firstPost, canonicalPath };
  });
}

export async function listThreads({ boardSlug, limit = 20 }) {
  const boardExists = await repo.existsBoardBySlug(pool, boardSlug);
  if (!boardExists) {
    throw new DomainError("board_not_found");
  }

  return repo.listThreadsByBoard(pool, { boardSlug, limit });
}

export async function getThreadDetailByPretty({ boardSlug, subjectSlug, token }) {
  const thread = await repo.findThreadByPretty(pool, {
    boardSlug,
    subjectSlug,
    token: normalizeToken(token),
  });

  if (!thread) {
    throw new DomainError("not_found");
  }

  const posts = await repo.listPostsByThreadId(pool, thread.id);
  return { thread, posts };
}

export async function createReplyByPretty({ boardSlug, subjectSlug, token, body }) {
  return withTransaction(pool, async (client) => {
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
      postNumber: thread.next_post_number,
      body,
    });

    await repo.bumpAndIncrementNextPostNumber(client, thread.id);

    return { post };
  });
}
