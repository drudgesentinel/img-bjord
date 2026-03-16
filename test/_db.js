import "dotenv/config";
import { pool } from "../src/db.js";

let closed = false;

export async function dbPing() {
  await pool.query("select 1");
  await pool.query(`create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now()
  )`);
  await pool.query("alter table threads add column if not exists delete_key_hash text");
  await pool.query("update threads set delete_key_hash = encode(gen_random_bytes(32), 'hex') where delete_key_hash is null");
  await pool.query("alter table threads alter column delete_key_hash set not null");
  await pool.query("alter table posts add column if not exists image_url text");
  await pool.query("alter table posts add column if not exists image_mime_type text");
  await pool.query("alter table posts add column if not exists image_size_bytes integer");
  await pool.query("alter table posts add column if not exists image_width integer");
  await pool.query("alter table posts add column if not exists image_height integer");
}

export async function ensureBoard(slug = "b", name = "Random") {
  await pool.query(
    `insert into boards (slug, name)
     values ($1, $2)
     on conflict (slug) do nothing`,
    [slug, name],
  );
}

export async function dbReset() {
  // threads -> posts; cascade handles posts
  await pool.query("truncate table posts, threads, users restart identity cascade");
  // ensure default board exists after reset
  await ensureBoard("b", "Random");
}

export async function dbClose() {
  if (closed) return;
  closed = true;
  await pool.end();
}
