create table if not exists public.yixiaoer_account_cache (
  id text primary key,
  accounts jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

alter table public.yixiaoer_account_cache enable row level security;

revoke all on table public.yixiaoer_account_cache from anon, authenticated;
