create or replace function public.lease_yixiaoer_publish_job(p_worker_id text, p_lease_seconds integer default 600)
returns setof public.publish_packages language plpgsql security definer set search_path=public as $$
declare picked public.publish_packages%rowtype;
begin
  select * into picked from public.publish_packages
  where yixiaoer_action is not null
    and coalesce((yixiaoer_results->'_control'->>'cancelRequested')::boolean, false) = false
    and (status in ('validating','publishing','submitted','reconciling') or (status='scheduled' and scheduled_at is not null and scheduled_at <= now()))
    and (yixiaoer_lease_expires_at is null or yixiaoer_lease_expires_at < now())
  order by case when status='scheduled' then scheduled_at else yixiaoer_updated_at end nulls first, created_at
  for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.publish_packages set status=case when picked.status='scheduled' then 'publishing' else picked.status end,
    yixiaoer_lease_owner=p_worker_id,yixiaoer_lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)),yixiaoer_updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;
revoke all on function public.lease_yixiaoer_publish_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_yixiaoer_publish_job(text,integer) to service_role;
