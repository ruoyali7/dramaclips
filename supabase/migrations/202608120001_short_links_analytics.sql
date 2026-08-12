create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{4,12}$'),
  drama_slug text not null,
  source text not null,
  account text not null default 'main',
  campaign text not null default 'organic',
  clip text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tracking_events (
  id bigint generated always as identity primary key,
  name text not null,
  occurred_at timestamptz not null default now(),
  session_id text not null,
  drama_id text,
  drama_slug text,
  short_code text,
  source text not null default 'direct',
  account text not null default 'unknown',
  campaign text not null default 'unknown',
  clip text not null default 'unknown',
  device text not null default 'unknown',
  metadata jsonb not null default '{}'
);

create index if not exists short_links_code_idx on public.short_links(code) where enabled = true;
create index if not exists tracking_events_occurred_idx on public.tracking_events(occurred_at desc);
create index if not exists tracking_events_dimensions_idx on public.tracking_events(source, account, campaign, clip);
create index if not exists tracking_events_drama_idx on public.tracking_events(drama_slug, occurred_at desc);

alter table public.short_links enable row level security;
alter table public.tracking_events enable row level security;
-- No anonymous policies: server-only service role access is used for reads/writes.
