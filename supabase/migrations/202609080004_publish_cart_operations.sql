alter table public.publish_cart_items drop constraint if exists publish_cart_items_status_check;
alter table public.publish_cart_items add constraint publish_cart_items_status_check
  check (status in ('cart', 'removed', 'scheduled', 'canceled'));
alter table public.publish_cart_items add column if not exists scheduled_at timestamptz;

create or replace function public.add_publish_cart_item(
  p_cart_date date, p_asset_id text, p_asset_source text, p_drama_id uuid,
  p_drama_slug text, p_drama_title text, p_episode_number integer,
  p_title text, p_video_url text, p_duration_seconds numeric
) returns public.publish_cart_items
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_position integer;
  v_item public.publish_cart_items;
begin
  perform pg_advisory_xact_lock(hashtext('publish-cart:' || p_cart_date::text));
  select count(*), coalesce(max(position), 0) into v_count, v_position
    from public.publish_cart_items where cart_date = p_cart_date and status in ('cart', 'scheduled');
  if v_count >= 10 then raise exception 'Publish day is limited to 10 items'; end if;
  insert into public.publish_cart_items (
    cart_date, position, asset_id, asset_source, drama_id, drama_slug,
    drama_title, episode_number, title, video_url, duration_seconds
  ) values (
    p_cart_date, v_position + 1, p_asset_id, p_asset_source, p_drama_id, p_drama_slug,
    p_drama_title, p_episode_number, p_title, p_video_url, p_duration_seconds
  ) returning * into v_item;
  return v_item;
end;
$$;
