create extension if not exists pgcrypto;

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  subject text,
  created_at timestamptz not null default now(),
  bumped_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  body text not null
);

create index if not exists posts_thread_id_created_at on posts(thread_id, created_at);
create index if not exists threads_bumped_at on threads(bumped_at desc);

-- boards
create table if not exists boards (
  slug text primary key,
  name text,
  created_at timestamptz not null default now()
);

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

-- backfill existing rows to a default board (so NOT NULL can be added safely)
update threads
set board_slug = 'b'
where board_slug is null;

-- make it required
alter table threads
  alter column board_slug set not null;

-- -- FK to boards
-- alter table threads
--   add constraint if not exists threads_board_fk
--   foreign key (board_slug) references boards(slug)
--   on delete restrict;

-- helpful index for board catalogs
create index if not exists threads_board_bumped_idx
  on threads (board_slug, bumped_at desc);

-- Seed at least one board (idempotent)
insert into boards (slug, name)
values ('b', 'Random')
on conflict (slug) do nothing;
