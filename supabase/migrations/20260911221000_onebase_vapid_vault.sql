create or replace function public.onebase_get_runtime_secret(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.onebase_get_runtime_secret(text) from public, anon, authenticated;
grant execute on function public.onebase_get_runtime_secret(text) to service_role;

create or replace function public.onebase_store_vapid_keys(public_key_value text, private_key_value text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if exists (select 1 from vault.secrets where name = 'onebase_vapid_private_key') then return false; end if;
  perform vault.create_secret(private_key_value, 'onebase_vapid_private_key', 'OneBase Web Push VAPID private key');
  perform vault.create_secret(public_key_value, 'onebase_vapid_public_key', 'OneBase Web Push VAPID public key');
  return true;
end;
$$;
revoke all on function public.onebase_store_vapid_keys(text, text) from public, anon, authenticated;
grant execute on function public.onebase_store_vapid_keys(text, text) to service_role;
