alter table public.publish_cart_items
  drop constraint if exists publish_cart_items_asset_source_check;

alter table public.publish_cart_items
  add constraint publish_cart_items_asset_source_check
  check (asset_source in ('episode', 'hook_clip', 'vizard'));
