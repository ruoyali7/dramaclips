create table if not exists public.yixiaoer_credential_notifications (
  credential_updated_at timestamptz primary key,
  upcoming_sent_at timestamptz,
  expired_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.yixiaoer_credential_notifications enable row level security;
revoke all on public.yixiaoer_credential_notifications from anon, authenticated;
