alter table public.publish_packages drop constraint if exists publish_packages_status_check;
alter table public.publish_packages add constraint publish_packages_status_check
  check (status in ('draft','ready','validating','publishing','submitted','reconciling','scheduled','published','failed','outcome_unknown'));

create table if not exists public.publish_platform_attempts (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references public.publish_packages(id) on delete cascade,
  platform text not null, account_id text not null, idempotency_key text not null unique,
  state text not null default 'prepared' check (state in ('prepared','submitting','submitted','processing','published','failed','outcome_unknown')),
  provider_request_id text, platform_post_id text, provider_response jsonb not null default '{}', error_message text,
  submitted_at timestamptz, reconciled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(package_id, platform)
);
create index if not exists publish_platform_attempts_package_idx on public.publish_platform_attempts(package_id,platform);
alter table public.publish_platform_attempts enable row level security;

create or replace function public.lease_yixiaoer_publish_job(p_worker_id text, p_lease_seconds integer default 600)
returns setof public.publish_packages language plpgsql security definer set search_path=public as $$
declare picked public.publish_packages%rowtype;
begin
  select * into picked from public.publish_packages where yixiaoer_action is not null
    and (status in ('validating','publishing','submitted','reconciling') or (status='scheduled' and scheduled_at is not null and scheduled_at <= now()))
    and (yixiaoer_lease_expires_at is null or yixiaoer_lease_expires_at < now())
  order by case when status='scheduled' then scheduled_at else yixiaoer_updated_at end nulls first, created_at for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.publish_packages set status=case when picked.status='scheduled' then 'publishing' else picked.status end,
    yixiaoer_lease_owner=p_worker_id,yixiaoer_lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)),yixiaoer_updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;
revoke all on function public.lease_yixiaoer_publish_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_yixiaoer_publish_job(text,integer) to service_role;
