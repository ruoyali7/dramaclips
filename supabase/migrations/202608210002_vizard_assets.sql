create table if not exists public.vizard_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.vizard_projects(id) on delete cascade,
  drama_slug text not null,
  episode_number integer not null,
  vizard_video_id text not null unique,
  title text not null,
  video_url text not null,
  object_key text not null,
  duration_seconds numeric(8,2) not null default 0,
  transcript text,
  viral_score text,
  viral_reason text,
  clip_editor_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists vizard_assets_drama_idx on public.vizard_assets(drama_slug, created_at desc);
alter table public.vizard_assets enable row level security;
