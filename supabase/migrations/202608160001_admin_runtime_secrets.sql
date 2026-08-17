create table if not exists public.admin_runtime_secrets (
  name text primary key,
  encrypted_value text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_runtime_secrets enable row level security;
revoke all on public.admin_runtime_secrets from anon, authenticated;
