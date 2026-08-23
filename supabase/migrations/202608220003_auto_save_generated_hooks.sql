alter table public.vizard_assets alter column review_state set default 'approved';
update public.vizard_assets set review_state='approved', reviewed_at=coalesce(reviewed_at,created_at);
update public.hook_candidates set review_state='approved', reviewed_at=coalesce(reviewed_at,created_at), reviewed_by=coalesce(reviewed_by,'auto-save') where draft_url is not null;
