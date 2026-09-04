-- Preserve publish history while collapsing abandoned duplicate ready rows.
with ranked as (
  select id,
    row_number() over (
      partition by coalesce(hook_clip_id::text, video_url)
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.publish_packages
  where video_kind = 'hook'
    and status in ('ready','validating','publishing','submitted','reconciling','scheduled','outcome_unknown')
)
update public.publish_packages as package
set status = 'failed',
    yixiaoer_action = null,
    yixiaoer_error = 'Superseded duplicate task; continue from the newest task for this hook',
    yixiaoer_lease_owner = null,
    yixiaoer_lease_expires_at = null,
    yixiaoer_updated_at = now(),
    updated_at = now()
from ranked
where package.id = ranked.id
  and ranked.duplicate_rank > 1
  and package.status = 'ready'
  and package.yixiaoer_action is null;

-- A leftover ready task must not remain actionable after this hook was published.
update public.publish_packages as package
set status = 'failed',
    yixiaoer_action = null,
    yixiaoer_error = 'Superseded task; this hook already has a published result',
    yixiaoer_lease_owner = null,
    yixiaoer_lease_expires_at = null,
    yixiaoer_updated_at = now(),
    updated_at = now()
where package.video_kind = 'hook'
  and package.status = 'ready'
  and package.yixiaoer_action is null
  and exists (
    select 1 from public.publish_packages as published
    where published.id <> package.id
      and published.status = 'published'
      and coalesce(published.hook_clip_id::text, published.video_url) = coalesce(package.hook_clip_id::text, package.video_url)
  );

create unique index if not exists publish_packages_one_active_hook_idx
on public.publish_packages ((coalesce(hook_clip_id::text, video_url)))
where video_kind = 'hook'
  and status in ('ready','validating','publishing','submitted','reconciling','scheduled','outcome_unknown');
