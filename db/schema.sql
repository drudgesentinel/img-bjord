create extension if not exists pgcrypto;

-- boards
create table if not exists boards (
  slug text primary key,
  name text,
  created_at timestamptz not null default now()
);

-- seed at least one board (idempotent)
insert into boards (slug, name)
values ('b', 'Random')
on conflict (slug) do nothing;

-- threads
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  board_slug text,
  subject text,
  created_at timestamptz not null default now(),
  bumped_at timestamptz not null default now(),
  next_post_number integer not null default 1
);

-- add board_slug if missing (in case table existed older)
alter table threads
  add column if not exists board_slug text;

-- backfill existing threads to default board (safe to re-run)
update threads
set board_slug = 'b'
where board_slug is null;

-- make board_slug required (guarded)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'threads'
      and column_name = 'board_slug'
      and is_nullable = 'YES'
  ) then
    alter table threads
      alter column board_slug set not null;
  end if;
end$$;

-- add next_post_number if missing
alter table threads
  add column if not exists next_post_number integer;

-- ensure next_post_number has a default
alter table threads
  alter column next_post_number set default 1;

-- backfill next_post_number if null
update threads
set next_post_number = 1
where next_post_number is null;

-- make next_post_number required (guarded)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'threads'
      and column_name = 'next_post_number'
      and is_nullable = 'YES'
  ) then
    alter table threads
      alter column next_post_number set not null;
  end if;
end$$;

-- FK to boards (idempotent via guard)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'threads_board_fk'
  ) then
    alter table threads
      add constraint threads_board_fk
      foreign key (board_slug) references boards(slug)
      on delete restrict;
  end if;
end$$;

-- posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  post_number integer,
  created_at timestamptz not null default now(),
  body text not null
);

-- add post_number if missing
alter table posts
  add column if not exists post_number integer;

-- backfill post_number for existing rows (deterministic by created_at, then id)
-- This is "best effort" for old data.
do $$
begin
  if exists (
    select 1
    from posts
    where post_number is null
  ) then
    with numbered as (
      select
        id,
        thread_id,
        row_number() over (partition by thread_id order by created_at asc, id asc) as rn
      from posts
      where post_number is null
    )
    update posts p
    set post_number = n.rn
    from numbered n
    where p.id = n.id;
  end if;
end$$;

-- make post_number required (guarded)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'posts'
      and column_name = 'post_number'
      and is_nullable = 'YES'
  ) then
    alter table posts
      alter column post_number set not null;
  end if;
end$$;

-- unique per thread (guarded)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_thread_post_number_uk'
  ) then
    alter table posts
      add constraint posts_thread_post_number_uk unique (thread_id, post_number);
  end if;
end$$;

-- indexes
create index if not exists posts_thread_id_created_at on posts(thread_id, created_at);
create index if not exists posts_thread_id_post_number on posts(thread_id, post_number);
create index if not exists threads_bumped_at on threads(bumped_at desc);
create index if not exists threads_board_bumped_idx on threads (board_slug, bumped_at desc);
