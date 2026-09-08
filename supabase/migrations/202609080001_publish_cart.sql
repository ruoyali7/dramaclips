create table if not exists public.publish_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_date date not null,
  position integer not null check (position between 1 and 10),
  asset_id text not null,
  asset_source text not null check (asset_source in ('hook_clip', 'vizard')),
  drama_id uuid not null references public.dramas(id) on delete cascade,
  drama_slug text not null,
  drama_title text not null,
  episode_number integer not null,
  title text not null,
  video_url text not null,
  duration_seconds numeric not null default 0,
  status text not null default 'cart' check (status in ('cart', 'removed', 'scheduled')),
  publish_package_id uuid references public.publish_packages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publish_cart_active_position
  on public.publish_cart_items(cart_date, position) where status = 'cart';
create index if not exists publish_cart_date_status
  on public.publish_cart_items(cart_date, status, position);

alter table public.publish_cart_items enable row level security;

create or replace function public.add_publish_cart_item(
  p_cart_date date, p_asset_id text, p_asset_source text, p_drama_id uuid,
  p_drama_slug text, p_drama_title text, p_episode_number integer,
  p_title text, p_video_url text, p_duration_seconds numeric
) returns public.publish_cart_items
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_item public.publish_cart_items;
begin
  perform pg_advisory_xact_lock(hashtext('publish-cart:' || p_cart_date::text));
  select count(*) into v_count from public.publish_cart_items
    where cart_date = p_cart_date and status = 'cart';
  if v_count >= 10 then raise exception 'Publish cart is limited to 10 items per day'; end if;
  insert into public.publish_cart_items (
    cart_date, position, asset_id, asset_source, drama_id, drama_slug,
    drama_title, episode_number, title, video_url, duration_seconds
  ) values (
    p_cart_date, v_count + 1, p_asset_id, p_asset_source, p_drama_id, p_drama_slug,
    p_drama_title, p_episode_number, p_title, p_video_url, p_duration_seconds
  ) returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.reorder_publish_cart_items(p_cart_date date, p_item_ids uuid[])
returns setof public.publish_cart_items
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('publish-cart:' || p_cart_date::text));
  select count(*) into v_count from public.publish_cart_items
    where cart_date = p_cart_date and status = 'cart';
  if v_count <> coalesce(array_length(p_item_ids, 1), 0)
    or exists (
      select 1 from unnest(p_item_ids) id
      where not exists (select 1 from public.publish_cart_items i where i.id = id and i.cart_date = p_cart_date and i.status = 'cart')
    ) then raise exception 'Cart items changed; reload and try again'; end if;
  update public.publish_cart_items set status = 'removed' where cart_date = p_cart_date and status = 'cart';
  update public.publish_cart_items i set position = x.position, status = 'cart', updated_at = now()
    from unnest(p_item_ids) with ordinality x(id, position) where i.id = x.id;
  return query select * from public.publish_cart_items where cart_date = p_cart_date and status = 'cart' order by position;
end;
$$;

create or replace function public.remove_publish_cart_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_date date; v_remaining uuid[];
begin
  select cart_date into v_date from public.publish_cart_items where id = p_item_id and status = 'cart';
  if v_date is null then raise exception 'Cart item not found'; end if;
  perform pg_advisory_xact_lock(hashtext('publish-cart:' || v_date::text));
  select array_agg(id order by position) into v_remaining from public.publish_cart_items
    where cart_date = v_date and status = 'cart' and id <> p_item_id;
  update public.publish_cart_items set status = 'removed', updated_at = now() where cart_date = v_date and status = 'cart';
  update public.publish_cart_items i set position = x.position, status = 'cart', updated_at = now()
    from unnest(coalesce(v_remaining, array[]::uuid[])) with ordinality x(id, position) where i.id = x.id;
end;
$$;

revoke all on function public.add_publish_cart_item(date,text,text,uuid,text,text,integer,text,text,numeric) from public;
revoke all on function public.reorder_publish_cart_items(date,uuid[]) from public;
revoke all on function public.remove_publish_cart_item(uuid) from public;
grant execute on function public.add_publish_cart_item(date,text,text,uuid,text,text,integer,text,text,numeric) to service_role;
grant execute on function public.reorder_publish_cart_items(date,uuid[]) to service_role;
grant execute on function public.remove_publish_cart_item(uuid) to service_role;
