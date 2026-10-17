create table if not exists public.instagram_story_reconnect_attempts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'requested' check (status in ('requested','connecting','waiting_for_approval','connected','failed','expired')),
  error text,
  requested_at timestamptz not null default now(),
  approval_confirmed_at timestamptz,
  connected_at timestamptz,
  expires_at timestamptz not null default now() + interval '5 minutes',
  lease_owner text,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists instagram_story_reconnect_queue_idx
  on public.instagram_story_reconnect_attempts(status, requested_at);

alter table public.instagram_story_reconnect_attempts enable row level security;
revoke all on table public.instagram_story_reconnect_attempts from anon, authenticated;
grant select, insert, update on table public.instagram_story_reconnect_attempts to service_role;

create or replace function public.lease_instagram_story_reconnect(p_worker_id text,p_lease_seconds integer default 240)
returns setof public.instagram_story_reconnect_attempts language plpgsql security definer set search_path = public as $$
declare picked public.instagram_story_reconnect_attempts%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('lease_instagram_story_reconnect'));
  update public.instagram_story_reconnect_attempts
    set status='expired', error='Reconnect window expired', lease_owner=null, lease_expires_at=null, updated_at=now()
  where status in ('requested','connecting','waiting_for_approval') and expires_at <= now();
  select * into picked from public.instagram_story_reconnect_attempts
  where status='requested' and expires_at > now()
  order by requested_at for update skip locked limit 1;
  if picked.id is null then return; end if;
  update public.instagram_story_reconnect_attempts
    set status='connecting', lease_owner=p_worker_id,
        lease_expires_at=now()+make_interval(secs=>greatest(120,p_lease_seconds)), updated_at=now()
  where id=picked.id returning * into picked;
  return next picked;
end $$;

create or replace function public.update_instagram_story_reconnect(
  p_id uuid,
  p_worker_id text,
  p_status text,
  p_error text default null
)
returns setof public.instagram_story_reconnect_attempts language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('connecting','waiting_for_approval','connected','failed','expired') then
    raise exception 'Invalid Instagram reconnect status';
  end if;
  return query update public.instagram_story_reconnect_attempts as attempt set
    status=p_status,
    error=p_error,
    connected_at=case when p_status='connected' then now() else attempt.connected_at end,
    lease_owner=case when p_status in ('connected','failed','expired') then null else attempt.lease_owner end,
    lease_expires_at=case when p_status in ('connected','failed','expired') then null else now()+interval '4 minutes' end,
    updated_at=now()
  where attempt.id=p_id and attempt.lease_owner=p_worker_id
  returning attempt.*;
end $$;

revoke all on function public.lease_instagram_story_reconnect(text,integer) from public,anon,authenticated;
revoke all on function public.update_instagram_story_reconnect(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.lease_instagram_story_reconnect(text,integer) to service_role;
grant execute on function public.update_instagram_story_reconnect(uuid,text,text,text) to service_role;
