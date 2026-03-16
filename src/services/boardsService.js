import { pool } from "../db.js";
import {
  slugifySubject,
  makeThreadToken,
  normalizeToken,
  isUniqueViolation,
} from "../lib/threadSlug.js";
import { DomainError } from "../lib/domainErrors.js";
import * as boardsRepo from "../repositories/boardsRepository.js";
import * as threadsRepo from "../repositories/threadsRepository.js";

export async function listBoards() {
  return boardsRepo.listBoards(pool);
}

export async function createThread({ boardSlug, subject, body }) {
  const subjectOrNull = subject ?? null;
  const subjectSlug = slugifySubject(subjectOrNull ?? "");

  const client = await pool.connect();
  try {
    await client.query("begin");

    const boardExists = await boardsRepo.existsBySlug(client, boardSlug);
    if (!boardExists) {
      throw new DomainError("board_not_found");
    }

    let thread = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const token = normalizeToken(makeThreadToken());

      try {
        thread = await threadsRepo.insertThread(client, {
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

    const row = await threadsRepo.findNextPostNumberForUpdateById(client, thread.id);
    if (!row) {
      throw new Error("thread_missing_after_insert");
    }

    const firstPost = await threadsRepo.insertPost(client, {
      threadId: thread.id,
      postNumber: row.next_post_number,
      body,
    });

    await threadsRepo.incrementNextPostNumber(client, thread.id);

    await client.query("commit");

    const canonicalPath = `/api/boards/${thread.board_slug}/${thread.subject_slug}/${thread.token}`;
    return { thread, firstPost, canonicalPath };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function listThreads({ boardSlug, limit = 20 }) {
  const boardExists = await boardsRepo.existsBySlug(pool, boardSlug);
  if (!boardExists) {
    throw new DomainError("board_not_found");
  }

  return threadsRepo.listByBoard(pool, { boardSlug, limit });
}

export async function getThreadDetailByPretty({ boardSlug, subjectSlug, token }) {
  const normalizedToken = normalizeToken(token);
  const thread = await threadsRepo.findByPretty(pool, {
    boardSlug,
    subjectSlug,
    token: normalizedToken,
  });

  if (!thread) {
    throw new DomainError("not_found");
  }

  const posts = await threadsRepo.listPostsByThreadId(pool, thread.id);
  return { thread, posts };
}

export async function createReplyByPretty({ boardSlug, subjectSlug, token, body }) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const normalizedToken = normalizeToken(token);
    const thread = await threadsRepo.findForUpdateByPretty(client, {
      boardSlug,
      subjectSlug,
      token: normalizedToken,
    });

    if (!thread) {
      throw new DomainError("not_found");
    }

    const post = await threadsRepo.insertPost(client, {
      threadId: thread.id,
      postNumber: thread.next_post_number,
      body,
    });

    await threadsRepo.bumpAndIncrementNextPostNumber(client, thread.id);

    await client.query("commit");
    return { post };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
