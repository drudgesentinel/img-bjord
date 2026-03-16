import { pool } from "../../db.js";
import { DomainError } from "../../lib/domainErrors.js";
import * as repo from "./repository.js";

export async function getThreadDetailById(threadId) {
  const thread = await repo.findThreadById(pool, threadId);
  if (!thread) {
    throw new DomainError("not_found");
  }

  const posts = await repo.listPostsByThreadId(pool, threadId);
  return { thread, posts };
}

export async function createReplyByThreadId({ threadId, body }) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const row = await repo.findNextPostNumberForUpdateByThreadId(client, threadId);
    if (!row) {
      throw new DomainError("not_found");
    }

    const post = await repo.insertPost(client, {
      threadId,
      postNumber: row.next_post_number,
      body,
    });

    await repo.bumpAndIncrementNextPostNumber(client, threadId);

    await client.query("commit");
    return { post };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
