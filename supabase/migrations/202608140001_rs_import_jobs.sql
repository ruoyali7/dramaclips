alter table public.drama_bundles add column if not exists rs_book_id text;
create unique index if not exists drama_bundles_rs_book_id_idx on public.drama_bundles(rs_book_id) where rs_book_id is not null;
create table if not exists public.rs_import_jobs (
  id uuid primary key default gen_random_uuid(), rs_book_id text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  drama jsonb not null, chapters jsonb not null check (jsonb_typeof(chapters) = 'array'), error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists rs_import_jobs_book_idx on public.rs_import_jobs(rs_book_id,created_at desc);
alter table public.rs_import_jobs enable row level security;
-- Server-only service role access. Signed RS URLs are cleared as each episode completes.

create or replace function public.patch_rs_import_chapter(
  p_job_id uuid,
  p_episode_number integer,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  patched jsonb;
begin
  update public.rs_import_jobs
  set chapters = (
    select jsonb_agg(
      case
        when (chapter ->> 'episodeNumber')::integer = p_episode_number
          then chapter || p_patch
        else chapter
      end
      order by ordinal
    )
    from jsonb_array_elements(chapters) with ordinality as entries(chapter, ordinal)
  ), updated_at = now()
  where id = p_job_id
  returning chapters into patched;

  if patched is null then
    raise exception 'Import job not found';
  end if;
  return patched;
end;
$$;

revoke all on function public.patch_rs_import_chapter(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.patch_rs_import_chapter(uuid, integer, jsonb) to service_role;
