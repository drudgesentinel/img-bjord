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
