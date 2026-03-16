import { pool } from "../db.js";
import { DomainError } from "../lib/domainErrors.js";
import * as threadsRepo from "../repositories/threadsRepository.js";

export async function getThreadDetailById(threadId) {
  const thread = await threadsRepo.findById(pool, threadId);
  if (!thread) {
    throw new DomainError("not_found");
  }

  const posts = await threadsRepo.listPostsByThreadId(pool, threadId);
  return { thread, posts };
}

export async function createReplyByThreadId({ threadId, body }) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const row = await threadsRepo.findNextPostNumberForUpdateById(client, threadId);
    if (!row) {
      throw new DomainError("not_found");
    }

    const post = await threadsRepo.insertPost(client, {
      threadId,
      postNumber: row.next_post_number,
      body,
    });

    await threadsRepo.bumpAndIncrementNextPostNumber(client, threadId);

    await client.query("commit");
    return { post };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
