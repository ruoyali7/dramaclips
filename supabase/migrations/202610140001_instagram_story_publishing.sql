create table if not exists public.instagram_story_jobs (
  id uuid primary key default gen_random_uuid(),
  schedule_date date not null,
  drama_slug text not null,
  drama_title text not null,
  image_url text not null,
  content_code text not null,
  target_url text not null,
  selection_source text not null check (selection_source in ('daily_post','library','manual')),
  status text not null default 'scheduled' check (status in ('scheduled','publishing','published','failed','outcome_unknown')),
  scheduled_at timestamptz not null,
  started_at timestamptz,
  published_at timestamptz,
  story_result jsonb not null default '{}',
  error text,
  lease_owner text,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_date, drama_slug)
);

create index if not exists instagram_story_jobs_queue_idx
  on public.instagram_story_jobs(status, scheduled_at);
create index if not exists instagram_story_jobs_drama_history_idx
  on public.instagram_story_jobs(drama_slug, published_at desc);

alter table public.instagram_story_jobs enable row level security;
revoke all on table public.instagram_story_jobs from anon, authenticated;
grant select, insert, update on table public.instagram_story_jobs to service_role;

create or replace function public.get_instagram_story_session()
returns jsonb language sql security definer set search_path = public, vault as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets
  where name = 'dramaclips_instagram_story_session'
  order by updated_at desc limit 1;
$$;

create or replace function public.save_instagram_story_session(p_session jsonb)
returns void language plpgsql security definer set search_path = public, vault as $$
declare secret_id uuid;
begin
  if p_session is null or jsonb_typeof(p_session) <> 'object' then raise exception 'Instagram session must be a JSON object'; end if;
  select id into secret_id from vault.secrets where name = 'dramaclips_instagram_story_session';
  if secret_id is null then
    perform vault.create_secret(p_session::text, 'dramaclips_instagram_story_session', 'instagrapi session settings for Story publishing');
  else
    perform vault.update_secret(secret_id, p_session::text, 'instagrapi session settings for Story publishing');
  end if;
end;
$$;

create or replace function public.lease_instagram_story_job(p_worker_id text, p_lease_seconds integer default 300)
returns setof public.instagram_story_jobs language plpgsql security definer set search_path = public as $$
declare picked public.instagram_story_jobs%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('lease_instagram_story_job'));
  update public.instagram_story_jobs set status='outcome_unknown', error='Worker stopped after Story upload may have started; verify Instagram before retrying', lease_owner=null, lease_expires_at=null, updated_at=now()
  where status='publishing' and lease_expires_at < now();
  select * into picked from public.instagram_story_jobs
  where status='scheduled' and scheduled_at <= now()
    and (lease_expires_at is null or lease_expires_at < now())
  order by scheduled_at for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.instagram_story_jobs set status='publishing', lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)), started_at=coalesce(started_at,now()), error=null, updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;

create or replace function public.update_instagram_story_job(p_id uuid,p_worker_id text,p_status text,p_result jsonb default null,p_error text default null)
returns setof public.instagram_story_jobs language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('publishing','published','failed','outcome_unknown') then raise exception 'Invalid Instagram Story status'; end if;
  return query update public.instagram_story_jobs as job set status=p_status, story_result=coalesce(p_result,job.story_result), error=p_error,
    published_at=case when p_status='published' then coalesce(job.published_at,now()) else job.published_at end,
    lease_owner=case when p_status in ('published','failed','outcome_unknown') then null else job.lease_owner end,
    lease_expires_at=case when p_status in ('published','failed','outcome_unknown') then null else now()+interval '5 minutes' end,
    updated_at=now()
  where job.id=p_id and job.lease_owner=p_worker_id returning job.*;
end $$;

revoke all on function public.get_instagram_story_session() from public,anon,authenticated;
revoke all on function public.save_instagram_story_session(jsonb) from public,anon,authenticated;
revoke all on function public.lease_instagram_story_job(text,integer) from public,anon,authenticated;
revoke all on function public.update_instagram_story_job(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_instagram_story_session() to service_role;
grant execute on function public.save_instagram_story_session(jsonb) to service_role;
grant execute on function public.lease_instagram_story_job(text,integer) to service_role;
grant execute on function public.update_instagram_story_job(uuid,text,text,jsonb,text) to service_role;
