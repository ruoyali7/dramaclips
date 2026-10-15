create or replace function public.save_instagram_story_session_id(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
  changed_at timestamptz := now();
  normalized text := trim(coalesce(p_session_id, ''));
begin
  if length(normalized) < 20 or length(normalized) > 500 or normalized ~ '[[:space:]]' then
    raise exception 'Instagram session id is invalid';
  end if;

  select id into secret_id from vault.secrets where name = 'dramaclips_instagram_story_session_id';
  if secret_id is null then
    perform vault.create_secret(normalized, 'dramaclips_instagram_story_session_id', 'Bootstrap session cookie for Instagram Story publishing');
  else
    perform vault.update_secret(secret_id, normalized, 'dramaclips_instagram_story_session_id', 'Bootstrap session cookie for Instagram Story publishing');
  end if;
  delete from vault.secrets where name = 'dramaclips_instagram_story_session';
  return changed_at;
end;
$$;

create or replace function public.get_instagram_story_session_id()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'dramaclips_instagram_story_session_id'
  order by updated_at desc
  limit 1;
$$;

create or replace function public.instagram_story_connection_status()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'sessionIdConfigured', exists(select 1 from vault.secrets where name = 'dramaclips_instagram_story_session_id'),
    'settingsConfigured', exists(select 1 from vault.secrets where name = 'dramaclips_instagram_story_session')
  );
$$;

revoke all on function public.save_instagram_story_session_id(text) from public, anon, authenticated;
revoke all on function public.get_instagram_story_session_id() from public, anon, authenticated;
revoke all on function public.instagram_story_connection_status() from public, anon, authenticated;
grant execute on function public.save_instagram_story_session_id(text) to service_role;
grant execute on function public.get_instagram_story_session_id() to service_role;
grant execute on function public.instagram_story_connection_status() to service_role;
