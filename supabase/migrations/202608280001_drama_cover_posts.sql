create table if not exists public.drama_cover_posts (
  id uuid primary key default gen_random_uuid(),
  drama_slug text not null,
  platform text not null check (platform in ('facebook','instagram')),
  image_url text not null,
  content_code text not null,
  caption text not null default '',
  status text not null default 'draft' check (status in ('draft','ready','scheduled','published','failed')),
  scheduled_at timestamptz,
  published_at timestamptz,
  platform_post_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drama_cover_posts_drama_idx on public.drama_cover_posts(drama_slug, created_at desc);
alter table public.drama_cover_posts enable row level security;
