create extension if not exists pgcrypto;

create table public.dramas (
  id uuid primary key default gen_random_uuid(), slug text not null unique, public_code text not null unique,
  status text not null check (status in ('draft','published','paused','archived')), title text not null,
  hook text, description text, cover_url text not null, locale text not null default 'en-US', tags text[] not null default '{}',
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.destinations (
  id uuid primary key default gen_random_uuid(), name text not null, provider text not null,
  app_platform text not null check (app_platform in ('ios','android','web','universal')),
  cps_url_encrypted text not null, promo_code_encrypted text, allowed_host text not null,
  countries text[] not null default '{}', locales text[] not null default '{}', enabled boolean not null default true,
  priority integer not null default 100, weight integer not null default 100 check(weight >= 0), valid_from timestamptz,
  valid_until timestamptz, health_status text not null default 'unknown', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.redirect_routes (
  id uuid primary key default gen_random_uuid(), slug text not null unique, drama_id uuid not null references public.dramas(id),
  status text not null default 'active', redirect_status smallint not null default 302 check(redirect_status in (302,307)), created_at timestamptz not null default now()
);
create table public.route_destinations (
  route_id uuid not null references public.redirect_routes(id) on delete cascade, destination_id uuid not null references public.destinations(id),
  priority integer not null default 100, weight integer not null default 100 check(weight >= 0), rules jsonb not null default '{}', primary key(route_id,destination_id)
);
create table public.landings (
  id uuid primary key default gen_random_uuid(), slug text not null unique, status text not null default 'draft', template_key text not null default 'hero-grid-v1',
  title text not null, subtitle text, hero_drama_id uuid references public.dramas(id), default_tracking jsonb not null default '{}', locale text not null default 'en-US',
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.landing_items (landing_id uuid references public.landings(id) on delete cascade, drama_id uuid references public.dramas(id), redirect_route_id uuid references public.redirect_routes(id), position integer not null, cta_label text, primary key(landing_id,drama_id));
create table public.episodes (
  id uuid primary key default gen_random_uuid(), drama_id uuid not null references public.dramas(id) on delete cascade,
  episode_number integer not null check(episode_number > 0), title text, video_object_key text not null,
  duration_seconds integer, is_preview boolean not null default false, status text not null default 'published',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(drama_id,episode_number)
);
create table public.drama_codes (
  id uuid primary key default gen_random_uuid(), drama_id uuid not null references public.dramas(id) on delete cascade,
  provider text not null, code text not null, code_type text not null check(code_type in ('public','promo','alias')),
  created_at timestamptz not null default now(), unique(provider,code)
);
create table public.clicks (
  id uuid primary key default gen_random_uuid(), public_click_id text not null unique, occurred_at timestamptz not null default now(), session_id text,
  route_id uuid not null references public.redirect_routes(id), drama_id uuid not null references public.dramas(id), destination_id uuid references public.destinations(id),
  source text, medium text, account text, campaign text, clip text, variant text, referrer_host text, country_code text, device_type text, ua_family text,
  ip_hash text, is_bot boolean not null default false, risk_score numeric(5,2), outcome text not null, latency_ms integer, schema_version integer not null default 1
);
create index clicks_occurred_at_idx on public.clicks(occurred_at desc);
create index clicks_dimensions_idx on public.clicks(campaign,clip,drama_id,destination_id,occurred_at desc);
create table public.conversions (
  id uuid primary key default gen_random_uuid(), provider text not null, external_event_id text not null, public_click_id text,
  click_id uuid references public.clicks(id), event_type text not null, event_at timestamptz not null, amount numeric(18,6), currency char(3),
  attribution_method text not null check(attribution_method in ('exact','provider','aggregate','manual')), raw_payload jsonb, created_at timestamptz not null default now(), unique(provider,external_event_id)
);
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, entity_type text not null, entity_id uuid, before_data jsonb, after_data jsonb, occurred_at timestamptz not null default now());

alter table public.dramas enable row level security; alter table public.destinations enable row level security; alter table public.redirect_routes enable row level security;
alter table public.route_destinations enable row level security; alter table public.landings enable row level security; alter table public.landing_items enable row level security;
alter table public.episodes enable row level security; alter table public.drama_codes enable row level security;
alter table public.clicks enable row level security; alter table public.conversions enable row level security; alter table public.audit_logs enable row level security;
create policy "published dramas are publicly readable" on public.dramas for select using(status='published');
create policy "published landings are publicly readable" on public.landings for select using(status='published');
create policy "published landing items are publicly readable" on public.landing_items for select using(exists(select 1 from public.landings l where l.id=landing_id and l.status='published'));
create policy "published preview episodes are publicly readable" on public.episodes for select using(is_preview=true and status='published' and exists(select 1 from public.dramas d where d.id=drama_id and d.status='published'));
create policy "active drama codes are publicly readable" on public.drama_codes for select using(exists(select 1 from public.dramas d where d.id=drama_id and d.status='published'));
-- Sensitive destination, route, click, conversion, and audit tables intentionally have no anonymous policies.
