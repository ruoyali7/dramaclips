alter table public.hook_candidates drop constraint if exists hook_candidates_rank_check;
alter table public.hook_candidates add constraint hook_candidates_rank_check check (rank between 1 and 6);
