import "dotenv/config";
import { pool } from "../src/db.js";

export async function dbPing() {
  await pool.query("select 1");
}

export async function dbReset() {
  // reset everything we currently use
  await pool.query("truncate table posts, threads, boards restart identity cascade");
}

export async function ensureBoard(slug = "b", name = "Random") {
  await pool.query(
    `insert into boards (slug, name)
     values ($1, $2)
     on conflict (slug) do nothing`,
    [slug, name]
  );
}

// NOTE: don't call pool.end() from individual test files; it can break other suites.
export async function dbClose() {
  // no-op on purpose
}
