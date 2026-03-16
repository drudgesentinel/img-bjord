export async function withTransaction(pool, fn) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback failures and preserve original error
    }
    throw err;
  } finally {
    client.release();
  }
}
