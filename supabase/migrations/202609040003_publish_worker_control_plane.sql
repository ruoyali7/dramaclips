create extension if not exists supabase_vault with schema vault;

create or replace function public.set_yixiaoer_worker_api_key(p_api_key text)
returns timestamptz
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
  changed_at timestamptz := now();
begin
  if length(trim(coalesce(p_api_key, ''))) < 16 then
    raise exception 'Yixiaoer API key is invalid';
  end if;

  select id into secret_id from vault.secrets where name = 'dramaclips_yixiaoer_api_key';
  if secret_id is null then
    perform vault.create_secret(p_api_key, 'dramaclips_yixiaoer_api_key', 'Rotating credential used by the DramaClips Railway publish worker');
  else
    perform vault.update_secret(secret_id, p_api_key, 'dramaclips_yixiaoer_api_key', 'Rotating credential used by the DramaClips Railway publish worker');
  end if;
  return changed_at;
end;
$$;

create or replace function public.get_yixiaoer_worker_api_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'dramaclips_yixiaoer_api_key'
  order by updated_at desc
  limit 1;
$$;

create or replace function public.update_yixiaoer_publish_job(
  p_id uuid,
  p_worker_id text,
  p_status text,
  p_progress integer,
  p_video jsonb,
  p_payloads jsonb,
  p_results jsonb,
  p_error text,
  p_terminal boolean
)
returns setof public.publish_packages
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('validating','ready','scheduled','publishing','submitted','reconciling','published','failed','outcome_unknown') then
    raise exception 'Invalid publish status';
  end if;
  if p_progress < 0 or p_progress > 100 then
    raise exception 'Invalid publish progress';
  end if;

  return query
  update public.publish_packages as package
  set status = p_status,
      yixiaoer_progress = p_progress,
      yixiaoer_error = p_error,
      yixiaoer_video = coalesce(p_video, package.yixiaoer_video),
      yixiaoer_payloads = coalesce(p_payloads, package.yixiaoer_payloads),
      yixiaoer_results = case
        when p_results is null then package.yixiaoer_results
        when package.yixiaoer_results ? '_control'
          then p_results || jsonb_build_object('_control', package.yixiaoer_results -> '_control')
        else p_results
      end,
      yixiaoer_action = case when p_terminal then null else package.yixiaoer_action end,
      yixiaoer_lease_owner = case when p_terminal then null else package.yixiaoer_lease_owner end,
      yixiaoer_lease_expires_at = case when p_terminal then null else now() + interval '10 minutes' end,
      yixiaoer_updated_at = now(),
      updated_at = now()
  where package.id = p_id
    and package.yixiaoer_lease_owner = p_worker_id
  returning package.*;
end;
$$;

revoke all on function public.set_yixiaoer_worker_api_key(text) from public, anon, authenticated;
revoke all on function public.get_yixiaoer_worker_api_key() from public, anon, authenticated;
revoke all on function public.update_yixiaoer_publish_job(uuid,text,text,integer,jsonb,jsonb,jsonb,text,boolean) from public, anon, authenticated;
grant execute on function public.set_yixiaoer_worker_api_key(text) to service_role;
grant execute on function public.get_yixiaoer_worker_api_key() to service_role;
grant execute on function public.update_yixiaoer_publish_job(uuid,text,text,integer,jsonb,jsonb,jsonb,text,boolean) to service_role;
