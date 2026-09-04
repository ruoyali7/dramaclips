alter table public.vizard_submission_jobs
  drop constraint if exists vizard_submission_jobs_status_check;
alter table public.vizard_submission_jobs
  add constraint vizard_submission_jobs_status_check
  check (status in ('queued','submitting','submitted','rate_limited','failed','canceled'));

create table if not exists public.vizard_rate_limit_state (
  singleton boolean primary key default true check (singleton),
  next_submission_at timestamptz not null default now(),
  blocked_until timestamptz not null default now(),
  last_response_code text,
  last_error text,
  updated_at timestamptz not null default now()
);
insert into public.vizard_rate_limit_state(singleton) values(true)
on conflict(singleton) do nothing;
alter table public.vizard_rate_limit_state enable row level security;

create or replace function public.lease_vizard_submission_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns setof public.vizard_submission_jobs
language plpgsql security definer set search_path=public as $$
declare
  v_job public.vizard_submission_jobs;
  v_gate public.vizard_rate_limit_state;
begin
  select * into v_gate from public.vizard_rate_limit_state
  where singleton=true for update;
  if greatest(v_gate.next_submission_at,v_gate.blocked_until)>now() then return; end if;

  select * into v_job from public.vizard_submission_jobs
  where status in ('queued','rate_limited') and next_attempt_at<=now()
  order by next_attempt_at,created_at
  for update skip locked limit 1;
  if v_job.id is null then return; end if;

  update public.vizard_rate_limit_state
  set next_submission_at=now()+interval '35 seconds',updated_at=now()
  where singleton=true;
  update public.vizard_submission_jobs
  set status='submitting',lease_owner=p_worker_id,
      lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)),
      attempt_count=attempt_count+1,updated_at=now()
  where id=v_job.id returning * into v_job;
  return next v_job;
end;
$$;

revoke all on function public.lease_vizard_submission_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_vizard_submission_job(text,integer) to service_role;
