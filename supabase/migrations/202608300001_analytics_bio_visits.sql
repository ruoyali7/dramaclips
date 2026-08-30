create or replace function public.analytics_summary(since_at timestamptz)
returns jsonb language sql security definer set search_path = public as $$
  with scoped as (
    select name, session_id, drama_slug, source, campaign
    from public.tracking_events where occurred_at >= since_at
  ),
  visits as (select * from scoped where name in ('page_view', 'short_link_click')),
  source_counts as (select coalesce(source, 'unknown') as name, count(*)::int as count from visits group by 1 order by count desc, name),
  drama_counts as (select coalesce(drama_slug, 'unknown') as name, count(*)::int as count from visits group by 1 order by count desc, name)
  select jsonb_build_object(
    'visits', (select count(*)::int from visits),
    'bioVisits', (select count(*)::int from visits where campaign = 'bio'),
    'clipVisits', (select count(*)::int from visits where campaign <> 'bio'),
    'sessions', (select count(distinct session_id)::int from visits),
    'previewStarts', (select count(*)::int from scoped where name = 'episode_start'),
    'previewCompletions', (select count(*)::int from scoped where name = 'episode_complete'),
    'watchFullClicks', (select count(*)::int from scoped where name = 'watch_full_click'),
    'promoCodeCopies', (select count(*)::int from scoped where name = 'promo_code_copy'),
    'rsRedirects', (select count(*)::int from scoped where name in ('redirect_success', 'rs_redirect_click')),
    'redirects', (select count(*)::int from scoped where name = 'redirect_success'),
    'events', (select count(*)::int from scoped),
    'bySource', coalesce((select jsonb_agg(jsonb_build_array(name, count)) from source_counts), '[]'::jsonb),
    'byDrama', coalesce((select jsonb_agg(jsonb_build_array(name, count)) from drama_counts), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_summary(timestamptz) from public, anon, authenticated;
grant execute on function public.analytics_summary(timestamptz) to service_role;
