alter table public.publish_packages add column if not exists publish_cart_item_id uuid;

alter table public.publish_packages
  add constraint publish_packages_cart_item_fkey
  foreign key (publish_cart_item_id) references public.publish_cart_items(id) on delete set null;

create unique index if not exists publish_packages_cart_item_unique
  on public.publish_packages(publish_cart_item_id) where publish_cart_item_id is not null;

drop index if exists public.publish_packages_one_active_hook_idx;
create unique index publish_packages_one_active_hook_idx
on public.publish_packages ((coalesce(hook_clip_id::text, video_url)))
where video_kind = 'hook' and publish_cart_item_id is null
  and status in ('ready','validating','publishing','submitted','reconciling','scheduled','outcome_unknown');
