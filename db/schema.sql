create extension if not exists pgcrypto;

-- boards
create table if not exists boards (
  slug text primary key,
  name text,
  created_at timestamptz not null default now()
);

-- users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  is_admin boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists consumed_usernames (
  username text primary key,
  consumed_at timestamptz not null default now()
);

insert into consumed_usernames (username)
select username from users
on conflict (username) do nothing;

alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists tags text[] not null default '{}';

-- threads (no legacy support)
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),

  board_slug text not null references boards(slug) on delete restrict,

  subject text,
  subject_slug text not null,
  token text not null,
  delete_key_hash text,

  created_at timestamptz not null default now(),
  bumped_at timestamptz not null default now(),

  next_post_number integer not null default 1
);

-- token must be unique per board
create unique index if not exists threads_board_token_uq
  on threads (board_slug, token);

alter table threads add column if not exists delete_key_hash text;
update threads set delete_key_hash = encode(gen_random_bytes(32), 'hex') where delete_key_hash is null;
alter table threads alter column delete_key_hash set not null;

create index if not exists threads_board_bumped_idx
  on threads (board_slug, bumped_at desc);

-- posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  post_number integer not null,
  created_at timestamptz not null default now(),
  body text not null,
  media_type text,
  media_url text,
  media_mime_type text,
  media_size_bytes integer,
  media_width integer,
  media_height integer,
  media_duration_sec numeric,
  image_url text,
  image_mime_type text,
  image_size_bytes integer,
  image_width integer,
  image_height integer
);

alter table posts add column if not exists media_type text;
alter table posts add column if not exists media_url text;
alter table posts add column if not exists media_mime_type text;
alter table posts add column if not exists media_size_bytes integer;
alter table posts add column if not exists media_width integer;
alter table posts add column if not exists media_height integer;
alter table posts add column if not exists media_duration_sec numeric;

alter table posts add column if not exists image_url text;
alter table posts add column if not exists image_mime_type text;
alter table posts add column if not exists image_size_bytes integer;
alter table posts add column if not exists image_width integer;
alter table posts add column if not exists image_height integer;
alter table posts add column if not exists author_user_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_author_user_fk') then
    alter table posts
      add constraint posts_author_user_fk
      foreign key (author_user_id) references users(id)
      on delete set null;
  end if;
end$$;

-- FK threads.board_slug -> boards.slug (idempotent)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'threads_board_fk') then
    alter table threads
      add constraint threads_board_fk
      foreign key (board_slug) references boards(slug)
      on delete restrict;
  end if;
end$$;

-- unique token per board (idempotent)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'threads_board_token_uk') then
    alter table threads
      add constraint threads_board_token_uk unique (board_slug, token);
  end if;
end$$;

-- indexes
create index if not exists posts_thread_id_post_number
  on posts(thread_id, post_number);

create index if not exists threads_board_bumped_idx
  on threads (board_slug, bumped_at desc);

create index if not exists threads_board_token_idx
  on threads (board_slug, token);

-- Seed default board
insert into boards (slug, name)
values ('b', 'Random')
on conflict (slug) do nothing;
