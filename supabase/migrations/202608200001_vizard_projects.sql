create table if not exists public.vizard_projects (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null,
  drama_slug text not null,
  episode_number integer not null check (episode_number > 0),
  project_name text not null,
  vizard_project_id text not null unique,
  source_video_url text not null,
  settings jsonb not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','editing','ready','archived','failed')),
  final_video_url text,
  final_object_key text,
  final_label text,
  edit_info jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vizard_projects_drama_idx on public.vizard_projects(drama_slug, episode_number, submitted_at desc);
alter table public.vizard_projects enable row level security;
