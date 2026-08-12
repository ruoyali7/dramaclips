create table if not exists public.publish_packages (
  id uuid primary key default gen_random_uuid(),
  drama_slug text not null,
  episode_number integer not null check (episode_number > 0),
  video_url text not null,
  account text not null default 'main',
  campaign text not null default 'organic',
  scheduled_at timestamptz,
  status text not null default 'ready' check (status in ('draft','ready','scheduled','published','failed')),
  platforms jsonb not null default '[]',
  metricool_post_ids jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publish_packages_created_idx on public.publish_packages(created_at desc);
create index if not exists publish_packages_status_idx on public.publish_packages(status, scheduled_at);
alter table public.publish_packages enable row level security;
-- Server-only service role access. No anonymous policies.
