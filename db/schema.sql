create extension if not exists pgcrypto;

-- boards
create table if not exists boards (
  slug text primary key,
  name text,
  created_at timestamptz not null default now()
);

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
  post_number integer not null,
  created_at timestamptz not null default now(),
  body text not null,
  image_url text,
  image_mime_type text,
  image_size_bytes integer,
  image_width integer,
  image_height integer
);

alter table posts add column if not exists image_url text;
alter table posts add column if not exists image_mime_type text;
alter table posts add column if not exists image_size_bytes integer;
alter table posts add column if not exists image_width integer;
alter table posts add column if not exists image_height integer;

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
