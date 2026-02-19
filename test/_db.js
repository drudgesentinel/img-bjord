import "dotenv/config";
import { pool } from "../src/db.js";

let closed = false;

export async function dbPing() {
  await pool.query("select 1");
}

export async function dbReset() {
  // posts depends on threads; cascade makes it easy
  await pool.query("truncate table posts, threads restart identity cascade");
}

export async function ensureBoard(slug = "b", name = "Random") {
  await pool.query(
    `insert into boards (slug, name)
     values ($1, $2)
     on conflict (slug) do nothing`,
    [slug, name]
  );
}

// export async function dbClose() {
//   if (closed) return;
//   closed = true;
//   await pool.end();
// }
