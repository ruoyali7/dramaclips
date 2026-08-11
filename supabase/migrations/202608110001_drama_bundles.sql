create table if not exists public.drama_bundles (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft','published','paused','archived')),
  title text not null,
  slug text not null unique,
  public_code text not null unique,
  promo_code text not null,
  language text not null default 'en',
  tags text[] not null default '{}',
  description text not null,
  cover_url text not null,
  episodes jsonb not null default '[]' check (jsonb_typeof(episodes) = 'array'),
  cps_url_encrypted text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.drama_bundles enable row level security;
-- No anonymous policies: the server-only service role owns all bundle access.
create index if not exists drama_bundles_status_idx on public.drama_bundles(status, published_at desc);
