create or replace function public.analytics_summary_v2(from_at timestamptz, to_at timestamptz, time_zone text default 'America/Los_Angeles')
returns jsonb language sql security definer set search_path = public as $$
  with scoped as (
    select name, session_id, drama_slug, source, campaign, metadata, occurred_at
    from public.tracking_events
    where occurred_at >= from_at and occurred_at < to_at
  ),
  source_counts as (
    select coalesce(source, 'direct') as name,
      count(distinct session_id) filter (where name = 'page_view')::int as sessions,
      count(*) filter (where name = 'promo_code_copy')::int as copies,
      count(*) filter (where name = 'rs_redirect_click')::int as redirects
    from scoped group by 1 order by redirects desc, copies desc, sessions desc, name
  ),
  drama_counts as (
    select coalesce(drama_slug, 'unknown') as name,
      count(distinct session_id) filter (where name = 'page_view')::int as sessions,
      count(*) filter (where name = 'promo_code_copy')::int as copies,
      count(*) filter (where name = 'rs_redirect_click')::int as redirects
    from scoped group by 1 order by redirects desc, copies desc, sessions desc, name
  ),
  daily_counts as (
    select (occurred_at at time zone time_zone)::date::text as day,
      count(distinct session_id) filter (where name = 'page_view')::int as sessions,
      count(*) filter (where name = 'promo_code_copy')::int as copies,
      count(*) filter (where name = 'rs_redirect_click')::int as redirects
    from scoped group by 1 order by day
  )
  select jsonb_build_object(
    'pageViews', (select count(*)::int from scoped where name = 'page_view'),
    'shortLinkClicks', (select count(*)::int from scoped where name = 'short_link_click'),
    'bioPageViews', (select count(*)::int from scoped where name = 'page_view' and campaign = 'bio'),
    'clipPageViews', (select count(*)::int from scoped where name = 'page_view' and campaign <> 'bio'),
    'sessions', (select count(distinct session_id)::int from scoped where name = 'page_view'),
    'previewStarts', (select count(*)::int from scoped where name = 'episode_start'),
    'previewCompletions', (select count(*)::int from scoped where name = 'episode_complete'),
    'watchFullClicks', (select count(*)::int from scoped where name = 'watch_full_click'),
    'promoCodeCopies', (select count(*)::int from scoped where name = 'promo_code_copy'),
    'manualCodeCopies', (select count(*)::int from scoped where name = 'promo_code_copy' and coalesce(metadata->>'reason', '') = 'manual'),
    'automaticCodeCopies', (select count(*)::int from scoped where name = 'promo_code_copy' and coalesce(metadata->>'reason', '') in ('full_cta', 'mobile_bottom')),
    'unclassifiedCodeCopies', (select count(*)::int from scoped where name = 'promo_code_copy' and coalesce(metadata->>'reason', '') not in ('manual', 'full_cta', 'mobile_bottom')),
    'rsRedirects', (select count(*)::int from scoped where name = 'rs_redirect_click'),
    'redirectSuccesses', (select count(*)::int from scoped where name = 'redirect_success'),
    'events', (select count(*)::int from scoped),
    'bySource', coalesce((select jsonb_agg(jsonb_build_array(name, sessions, copies, redirects)) from source_counts), '[]'::jsonb),
    'byDrama', coalesce((select jsonb_agg(jsonb_build_array(name, sessions, copies, redirects)) from drama_counts), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_array(day, sessions, copies, redirects)) from daily_counts), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_summary_v2(timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.analytics_summary_v2(timestamptz, timestamptz, text) to service_role;
