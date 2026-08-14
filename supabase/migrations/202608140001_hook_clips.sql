create table if not exists public.hook_generation_jobs (
  id uuid primary key default gen_random_uuid(), idempotency_key text not null unique,
  drama_id uuid not null, drama_slug text not null, source_episodes integer[] not null,
  source_assets jsonb not null, settings jsonb not null default '{}', pipeline_version text not null,
  status text not null default 'queued' check(status in ('queued','downloading','transcribing','analyzing','rendering','review_ready','no_result','failed','canceled')),
  progress integer not null default 0 check(progress between 0 and 100), error_category text, error_message text,
  retry_count integer not null default 0, max_retries integer not null default 3,
  lease_owner text, lease_expires_at timestamptz, heartbeat_at timestamptz, next_attempt_at timestamptz,
  created_by text not null default 'admin', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.hook_job_attempts (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.hook_generation_jobs(id) on delete cascade,
  attempt_number integer not null, worker_id text not null, status text not null,
  started_at timestamptz not null default now(), heartbeat_at timestamptz, finished_at timestamptz,
  error_category text, error_message text, unique(job_id,attempt_number)
);
create table if not exists public.hook_candidates (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.hook_generation_jobs(id) on delete cascade,
  rank integer not null check(rank between 1 and 2), title text not null, hook_type text not null,
  source_ranges jsonb not null, rendered_ranges jsonb not null, score numeric(5,2) not null, score_components jsonb not null,
  rationale text not null, risk_level text not null check(risk_level in ('low','medium','high')),
  risk_assessment jsonb not null default '{}', cover_source_timestamp numeric(10,3) not null,
  draft_object_key text, draft_url text, duration_seconds numeric(8,2), width integer, height integer,
  video_codec text, audio_codec text, size_bytes bigint, transcript_version text, model_version text,
  prompt_version text, ranking_version text, render_version text, qa_results jsonb not null default '{}',
  review_state text not null default 'pending' check(review_state in ('pending','approved','rejected')),
  reviewed_by text, reviewed_at timestamptz, created_at timestamptz not null default now(), unique(job_id,rank)
);
create table if not exists public.hook_clips (
  id uuid primary key default gen_random_uuid(), job_id uuid references public.hook_generation_jobs(id), candidate_id uuid unique references public.hook_candidates(id),
  drama_id uuid, drama_slug text not null, title text not null, hook_type text not null default 'unknown', source_episodes integer[] not null default '{}',
  source_ranges jsonb not null default '[]', rendered_ranges jsonb not null default '[]', object_key text not null, video_url text not null,
  duration_seconds numeric(8,2) not null, width integer not null default 1080, height integer not null default 1920,
  video_codec text not null default 'h264', audio_codec text not null default 'aac', size_bytes bigint,
  score numeric(5,2), score_components jsonb not null default '{}', rationale text, risk_level text not null default 'low',
  cover_source_timestamp numeric(10,3), transcript_version text, model_version text, prompt_version text, ranking_version text, render_version text,
  review_state text not null default 'approved' check(review_state in ('approved','archived')), reviewed_by text, reviewed_at timestamptz,
  status text not null default 'saved' check(status in ('saved','archived')), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists hook_jobs_status_idx on public.hook_generation_jobs(status,next_attempt_at,created_at);
create index if not exists hook_attempts_job_idx on public.hook_job_attempts(job_id,attempt_number desc);
create index if not exists hook_candidates_job_idx on public.hook_candidates(job_id,rank);
create index if not exists hook_clips_drama_idx on public.hook_clips(drama_slug,created_at desc);
alter table public.hook_clips enable row level security;
alter table public.hook_generation_jobs enable row level security;
alter table public.hook_job_attempts enable row level security;
alter table public.hook_candidates enable row level security;
alter table public.publish_packages add column if not exists video_kind text not null default 'original' check(video_kind in ('original','hook','upload'));
alter table public.publish_packages add column if not exists video_label text;
alter table public.publish_packages add column if not exists hook_clip_id uuid references public.hook_clips(id) on delete set null;

create or replace function public.lease_hook_generation_job(p_worker_id text,p_lease_seconds integer default 120)
returns setof public.hook_generation_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.hook_generation_jobs;
begin
  select * into v_job from public.hook_generation_jobs
  where (status='queued' and coalesce(next_attempt_at,now())<=now())
     or (status in ('downloading','transcribing','analyzing','rendering') and lease_expires_at<now())
  order by created_at for update skip locked limit 1;
  if v_job.id is null then return; end if;
  update public.hook_generation_jobs set status='downloading',progress=greatest(progress,2),lease_owner=p_worker_id,
    lease_expires_at=now()+make_interval(secs=>least(greatest(p_lease_seconds,30),600)),heartbeat_at=now(),updated_at=now()
  where id=v_job.id returning * into v_job;
  insert into public.hook_job_attempts(job_id,attempt_number,worker_id,status,heartbeat_at)
  values(v_job.id,v_job.retry_count+1,p_worker_id,'running',now()) on conflict(job_id,attempt_number) do update set worker_id=excluded.worker_id,status='running',heartbeat_at=now();
  return next v_job;
end $$;
revoke all on function public.lease_hook_generation_job(text,integer) from public,anon,authenticated;
grant execute on function public.lease_hook_generation_job(text,integer) to service_role;
