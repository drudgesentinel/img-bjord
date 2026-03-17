import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

let closed = false;
let schemaReady = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, "../db/schema.sql");

async function ensureSchema() {
  if (schemaReady) return;

  const schemaSql = await readFile(schemaPath, "utf8");
  await pool.query(schemaSql);
  schemaReady = true;
}

export async function dbPing() {
  await ensureSchema();
  await pool.query("select 1");
  await pool.query(`create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    password_hash text not null,
    is_admin boolean not null default false,
    tags text[] not null default '{}',
    created_at timestamptz not null default now()
  )`);
  await pool.query("alter table users add column if not exists is_admin boolean not null default false");
  await pool.query("alter table users add column if not exists tags text[] not null default '{}'");
  await pool.query(`create table if not exists consumed_usernames (
    username text primary key,
    consumed_at timestamptz not null default now()
  )`);
  await pool.query(`insert into consumed_usernames (username)
    select username from users
    on conflict (username) do nothing`);
  await pool.query("alter table threads add column if not exists delete_key_hash text");
  await pool.query("update threads set delete_key_hash = encode(gen_random_bytes(32), 'hex') where delete_key_hash is null");
  await pool.query("alter table threads alter column delete_key_hash set not null");
  await pool.query("alter table posts add column if not exists image_url text");
  await pool.query("alter table posts add column if not exists image_mime_type text");
  await pool.query("alter table posts add column if not exists image_size_bytes integer");
  await pool.query("alter table posts add column if not exists image_width integer");
  await pool.query("alter table posts add column if not exists image_height integer");
  await pool.query("alter table posts add column if not exists author_user_id uuid");
  await pool.query(`do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_author_user_fk') then
    alter table posts
      add constraint posts_author_user_fk
      foreign key (author_user_id) references users(id)
      on delete set null;
  end if;
end$$;`);
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
  // Clean full app state used by tests, including boards created by admin tests.
  await pool.query("truncate table posts, threads, users, consumed_usernames, boards restart identity cascade");
  // Ensure default board exists after reset.
  await ensureBoard("b", "Random");
}

export async function dbClose() {
  if (closed) return;
  closed = true;
  await pool.end();
}
