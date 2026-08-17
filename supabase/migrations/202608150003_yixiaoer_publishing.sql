alter table public.publish_packages
  add column if not exists yixiaoer_video jsonb not null default '{}',
  add column if not exists yixiaoer_payloads jsonb not null default '{}',
  add column if not exists yixiaoer_results jsonb not null default '{}';

alter table public.publish_packages drop constraint if exists publish_packages_status_check;
alter table public.publish_packages add constraint publish_packages_status_check
  check (status in ('draft','ready','validating','publishing','scheduled','published','failed'));
