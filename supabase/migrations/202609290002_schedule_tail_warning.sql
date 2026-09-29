alter table public.publish_weekly_plans
  add column if not exists schedule_tail_warning_notified_at timestamptz;
