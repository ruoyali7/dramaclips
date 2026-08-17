alter table public.publish_packages
  add column if not exists yixiaoer_action text check (yixiaoer_action in ('validate','publish')),
  add column if not exists yixiaoer_accounts jsonb not null default '{}',
  add column if not exists yixiaoer_progress integer not null default 0 check (yixiaoer_progress between 0 and 100),
  add column if not exists yixiaoer_error text,
  add column if not exists yixiaoer_lease_owner text,
  add column if not exists yixiaoer_lease_expires_at timestamptz,
  add column if not exists yixiaoer_updated_at timestamptz;

create or replace function public.lease_yixiaoer_publish_job(p_worker_id text, p_lease_seconds integer default 600)
returns setof public.publish_packages language plpgsql security definer set search_path=public as $$
declare picked public.publish_packages%rowtype;
begin
  select * into picked from public.publish_packages
  where yixiaoer_action is not null
    and status in ('validating','publishing')
    and (yixiaoer_lease_expires_at is null or yixiaoer_lease_expires_at < now())
  order by yixiaoer_updated_at nulls first, created_at
  for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.publish_packages set
    yixiaoer_lease_owner=p_worker_id,
    yixiaoer_lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)),
    yixiaoer_updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;

revoke all on function public.lease_yixiaoer_publish_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_yixiaoer_publish_job(text,integer) to service_role;
