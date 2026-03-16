import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
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

export async function createReplyByThreadId({ threadId, body, image = null }) {
  return withTransaction(pool, async (client) => {
    const row = await repo.findNextPostNumberForUpdateByThreadId(client, threadId);
    if (!row) {
      throw new DomainError("not_found");
    }

    const post = await repo.insertPost(client, {
      threadId,
      postNumber: row.next_post_number,
      body,
      imageUrl: image?.imageUrl ?? null,
      imageMimeType: image?.imageMimeType ?? null,
      imageSizeBytes: image?.imageSizeBytes ?? null,
      imageWidth: image?.imageWidth ?? null,
      imageHeight: image?.imageHeight ?? null,
    });

    await repo.bumpAndIncrementNextPostNumber(client, threadId);

    return { post };
  });
}
