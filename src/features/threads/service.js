import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import { hashDeleteKey } from "../../lib/deleteKey.js";
import { withTransaction } from "../../lib/withTransaction.js";
import * as repo from "./repository.js";

export async function getThreadDetailById(threadId) {
  const thread = await repo.findThreadById(pool, threadId);
  if (!thread) {
    throw new DomainError("not_found");
  }

  const posts = await repo.listPostsByThreadId(pool, threadId);
  return { thread, posts };
}

export async function createReplyByThreadId({ threadId, body, media = null, authorUserId }) {
  return withTransaction(pool, async (client) => {
    const row = await repo.findNextPostNumberForUpdateByThreadId(client, threadId);
    if (!row) {
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

export async function deleteThreadById({ threadId, deleteKey }) {
  const normalizedDeleteKey = deleteKey?.trim();
  if (!normalizedDeleteKey) {
    throw new DomainError("validation_error", "delete key is required");
  }

  const thread = await repo.findThreadDeleteAuthById(pool, threadId);
  if (!thread) {
    throw new DomainError("not_found");
  }

  if (thread.delete_key_hash !== hashDeleteKey(normalizedDeleteKey)) {
    throw new DomainError("invalid_delete_key");
  }

  await repo.deleteThreadById(pool, threadId);
}
