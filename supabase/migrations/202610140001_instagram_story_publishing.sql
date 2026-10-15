alter table public.drama_cover_posts
  add column if not exists target_url text,
  add column if not exists story_result jsonb not null default '{}',
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists started_at timestamptz;

alter table public.drama_cover_posts drop constraint if exists drama_cover_posts_status_check;
alter table public.drama_cover_posts add constraint drama_cover_posts_status_check
  check (status in ('draft','ready','scheduled','publishing','published','failed','outcome_unknown'));

create index if not exists drama_cover_posts_story_queue_idx
  on public.drama_cover_posts(status, scheduled_at, updated_at)
  where platform = 'instagram';

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
    perform vault.update_secret(secret_id, p_session::text, 'dramaclips_instagram_story_session', 'instagrapi session settings for Story publishing');
  end if;
end;
$$;

create or replace function public.lease_instagram_story_job(p_worker_id text, p_lease_seconds integer default 300)
returns setof public.drama_cover_posts language plpgsql security definer set search_path = public as $$
declare picked public.drama_cover_posts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('lease_instagram_story_job'));
  update public.drama_cover_posts set status='outcome_unknown', error='Worker stopped after Story upload may have started; verify Instagram before retrying', lease_owner=null, lease_expires_at=null, updated_at=now()
  where platform='instagram' and status='publishing' and lease_expires_at < now();
  select * into picked from public.drama_cover_posts
  where platform='instagram' and target_url is not null
    and (status='ready' or (status='scheduled' and scheduled_at <= now()))
    and (lease_expires_at is null or lease_expires_at < now())
  order by coalesce(scheduled_at, updated_at), updated_at for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.drama_cover_posts set status='publishing', lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)), started_at=coalesce(started_at,now()), error=null, updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;

create or replace function public.update_instagram_story_job(p_id uuid,p_worker_id text,p_status text,p_result jsonb default null,p_error text default null)
returns setof public.drama_cover_posts language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('publishing','published','failed','outcome_unknown') then raise exception 'Invalid Instagram Story status'; end if;
  return query update public.drama_cover_posts as post set status=p_status, story_result=coalesce(p_result,post.story_result), error=p_error,
    published_at=case when p_status='published' then coalesce(post.published_at,now()) else post.published_at end,
    platform_post_id=case when p_status='published' then coalesce(p_result->>'storyPk',post.platform_post_id) else post.platform_post_id end,
    lease_owner=case when p_status in ('published','failed','outcome_unknown') then null else post.lease_owner end,
    lease_expires_at=case when p_status in ('published','failed','outcome_unknown') then null else now()+interval '5 minutes' end,
    updated_at=now()
  where post.id=p_id and post.lease_owner=p_worker_id returning post.*;
end $$;

revoke all on function public.get_instagram_story_session() from public,anon,authenticated;
revoke all on function public.save_instagram_story_session(jsonb) from public,anon,authenticated;
revoke all on function public.lease_instagram_story_job(text,integer) from public,anon,authenticated;
revoke all on function public.update_instagram_story_job(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.get_instagram_story_session() to service_role;
grant execute on function public.save_instagram_story_session(jsonb) to service_role;
grant execute on function public.lease_instagram_story_job(text,integer) to service_role;
grant execute on function public.update_instagram_story_job(uuid,text,text,jsonb,text) to service_role;
