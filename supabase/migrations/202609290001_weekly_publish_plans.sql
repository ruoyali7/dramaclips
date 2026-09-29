create table if not exists public.publish_weekly_plans (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('planning', 'paused', 'scheduled', 'failed')),
  start_date date not null,
  end_date date not null,
  required_videos integer not null default 70,
  available_videos integer not null default 0,
  missing_videos integer not null default 0,
  scheduled_videos integer not null default 0,
  next_drama_slug text,
  next_episode_number integer,
  error_message text,
  telegram_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists publish_weekly_plans_status_idx
  on public.publish_weekly_plans(status, created_at desc);
create unique index if not exists publish_weekly_plans_one_active
  on public.publish_weekly_plans ((true)) where status in ('planning', 'paused');

alter table public.publish_weekly_plans enable row level security;
revoke all on public.publish_weekly_plans from anon, authenticated;
grant all on public.publish_weekly_plans to service_role;
