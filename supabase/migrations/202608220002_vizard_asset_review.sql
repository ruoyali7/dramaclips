alter table public.vizard_assets add column if not exists review_state text not null default 'pending' check (review_state in ('pending','approved'));
alter table public.vizard_assets add column if not exists reviewed_at timestamptz;
update public.vizard_assets set review_state='pending', reviewed_at=null where review_state='approved';
create index if not exists vizard_assets_review_idx on public.vizard_assets(review_state,created_at desc);
