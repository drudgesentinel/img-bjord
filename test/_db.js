import "dotenv/config";
import { pool } from "../src/db.js";

export async function dbPing() {
  await pool.query("select 1");
}

export async function dbReset() {
  // Order matters because of FK; truncate both.
  await pool.query("truncate table posts, threads restart identity cascade");
}

export async function dbClose() {
  await pool.end();
}
