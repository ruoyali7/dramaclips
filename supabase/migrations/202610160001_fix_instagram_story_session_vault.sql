create or replace function public.save_instagram_story_session(p_session jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_id uuid;
begin
  if p_session is null or jsonb_typeof(p_session) <> 'object' then
    raise exception 'Instagram session must be a JSON object';
  end if;

  select id into secret_id
  from vault.secrets
  where name = 'dramaclips_instagram_story_session';

  if secret_id is null then
    perform vault.create_secret(
      p_session::text,
      'dramaclips_instagram_story_session',
      'instagrapi session settings for Story publishing'
    );
  else
    perform vault.update_secret(
      secret_id,
      p_session::text,
      'dramaclips_instagram_story_session',
      'instagrapi session settings for Story publishing'
    );
  end if;

  delete from vault.secrets
  where name = 'instagrapi session settings for Story publishing';
end;
$$;

revoke all on function public.save_instagram_story_session(jsonb) from public, anon, authenticated;
grant execute on function public.save_instagram_story_session(jsonb) to service_role;
