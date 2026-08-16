alter table public.hook_generation_jobs
  add column if not exists creative_direction text not null default '',
  add column if not exists direction_schema jsonb not null default '{}',
  add column if not exists direction_parser_version text not null default 'rule-v1',
  add column if not exists direction_model_version text;

alter table public.hook_candidates
  add column if not exists direction_match_score numeric(5,2),
  add column if not exists direction_evidence jsonb not null default '{}';
