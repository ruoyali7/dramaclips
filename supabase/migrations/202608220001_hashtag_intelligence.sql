create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  external_id text not null,
  url text not null,
  creator text,
  caption text,
  hashtags jsonb not null default '[]',
  drama_id uuid references public.dramas(id) on delete set null,
  published_at timestamptz,
  source text not null,
  crawled_at timestamptz not null default now(),
  unique(platform, external_id)
);
create index if not exists social_posts_drama_idx on public.social_posts(drama_id, published_at desc);
create table if not exists public.social_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  captured_at timestamptz not null default now(),
  unique(post_id, captured_at)
);
create index if not exists social_metric_snapshots_post_idx on public.social_metric_snapshots(post_id, captured_at desc);
create table if not exists public.hashtag_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  hashtag text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  usage_count integer not null default 0,
  average_views numeric,
  median_views numeric,
  engagement_rate numeric,
  viral_rate numeric,
  relevance_score numeric,
  competition_score numeric,
  score numeric,
  source text not null,
  computed_at timestamptz not null default now(),
  unique(platform, hashtag, window_start, window_end)
);
create index if not exists hashtag_performance_rank_idx on public.hashtag_performance_snapshots(platform, score desc, window_end desc);
