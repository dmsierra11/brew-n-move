-- Hosted Auth Confirm email is not writable from migrations. Confirm the
-- auth email on insert so sign-in can start immediately. Product verification
-- stays on public.members.email_verified_at.

create or replace function private.confirm_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email_confirmed_at = coalesce(new.email_confirmed_at, pg_catalog.now());
  return new;
end;
$$;

revoke all on function private.confirm_auth_email() from public, anon, authenticated;
grant execute on function private.confirm_auth_email() to supabase_auth_admin;
grant usage on schema private to supabase_auth_admin;

create trigger confirm_auth_email
  before insert on auth.users
  for each row
  execute function private.confirm_auth_email();
