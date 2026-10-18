alter table public.instagram_story_jobs
  add column if not exists reconnected_at timestamptz;

create or replace function public.lease_instagram_story_job(p_worker_id text,p_lease_seconds integer default 300)
returns setof public.instagram_story_jobs language plpgsql security definer set search_path = public as $$
declare picked public.instagram_story_jobs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('lease_instagram_story_job'));
  update public.instagram_story_jobs set status='outcome_unknown', error='Worker stopped after Story upload may have started; verify Instagram before retrying', lease_owner=null, lease_expires_at=null, updated_at=now()
  where status='publishing' and lease_expires_at < now();
  select * into picked from public.instagram_story_jobs
  where status='scheduled' and scheduled_at <= now() and reconnected_at is not null
    and (lease_expires_at is null or lease_expires_at < now())
  order by scheduled_at for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.instagram_story_jobs set status='publishing', lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)), started_at=coalesce(started_at,now()), error=null, updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;

revoke all on function public.lease_instagram_story_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_instagram_story_job(text,integer) to service_role;
