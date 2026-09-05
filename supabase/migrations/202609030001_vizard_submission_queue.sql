create table if not exists public.vizard_submission_jobs (
  id uuid primary key default gen_random_uuid(),
  drama_id uuid not null,
  drama_slug text not null,
  episode_number integer not null,
  project_name text not null,
  video_url text not null,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','submitting','submitted','failed','canceled')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  error_message text,
  vizard_project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drama_id, episode_number, project_name)
);

create index if not exists vizard_submission_jobs_queue_idx
  on public.vizard_submission_jobs(status, next_attempt_at, created_at);

alter table public.vizard_submission_jobs enable row level security;

create or replace function public.lease_vizard_submission_job(
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns setof public.vizard_submission_jobs
language plpgsql security definer set search_path=public as $$
begin
  return query
  with candidate as (
    select id from public.vizard_submission_jobs
    where (status = 'queued' and next_attempt_at <= now())
       or (status = 'submitting' and lease_expires_at < now())
    order by created_at
    for update skip locked limit 1
  )
  update public.vizard_submission_jobs j
  set status='submitting', lease_owner=p_worker_id,
      lease_expires_at=now()+make_interval(secs=>greatest(60,p_lease_seconds)),
      attempt_count=attempt_count+1, updated_at=now()
  from candidate where j.id=candidate.id
  returning j.*;
end;
$$;

revoke all on function public.lease_vizard_submission_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_vizard_submission_job(text,integer) to service_role;
