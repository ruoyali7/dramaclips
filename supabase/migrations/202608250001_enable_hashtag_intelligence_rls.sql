-- These tables are accessed by the server-side admin repository only.
-- RLS with no client policies denies anon/authenticated access; the service
-- role used by the repository continues to bypass RLS.
alter table public.social_posts enable row level security;
alter table public.social_metric_snapshots enable row level security;
alter table public.hashtag_performance_snapshots enable row level security;
