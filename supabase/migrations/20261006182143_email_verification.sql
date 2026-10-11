-- Non-blocking email verification. Tokens and the verified timestamp are
-- server-written. Members cannot set email_verified_at.

alter table public.members
  add column email_verified_at timestamptz;

create table private.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default pg_catalog.now()
);

create unique index email_verification_tokens_hash
  on private.email_verification_tokens (token_hash);

create index email_verification_tokens_member_created
  on private.email_verification_tokens (member_id, created_at desc);

alter table private.email_verification_tokens enable row level security;

revoke all on table private.email_verification_tokens from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.protect_member_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.legal_documents
    where kind = 'terms'
      and version = new.terms_version
      and is_current
  ) then
    raise exception 'terms version is not current';
  end if;

  if not exists (
    select 1
    from public.legal_documents
    where kind = 'privacy'
      and version = new.privacy_version
      and is_current
  ) then
    raise exception 'privacy version is not current';
  end if;

  new.email_verified_at = null;
  new.terms_accepted_at = pg_catalog.now();
  new.privacy_acknowledged_at = pg_catalog.now();
  new.created_at = pg_catalog.now();
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function private.protect_member_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.first_name is distinct from old.first_name
    or new.terms_version is distinct from old.terms_version
    or new.privacy_version is distinct from old.privacy_version
    or new.terms_accepted_at is distinct from old.terms_accepted_at
    or new.privacy_acknowledged_at is distinct from old.privacy_acknowledged_at
    or new.timezone is distinct from old.timezone
    or new.region is distinct from old.region
    or new.created_at is distinct from old.created_at
  then
    raise exception 'only display_name can be changed';
  end if;

  if new.email_verified_at is distinct from old.email_verified_at
    and pg_catalog.current_setting('private.marking_email_verified', true) is distinct from 'on'
  then
    raise exception 'email_verified_at cannot be changed';
  end if;

  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function private.mark_email_verified(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config('private.marking_email_verified', 'on', true);

  update public.members
  set email_verified_at = pg_catalog.now()
  where id = p_member_id
    and email_verified_at is null;
end;
$$;

create or replace function private.issue_email_verification_token(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_at timestamptz;
  recent_at timestamptz;
  raw_token text;
begin
  select email_verified_at into verified_at
  from public.members
  where id = p_member_id;

  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'no_member');
  end if;

  if verified_at is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'already_verified');
  end if;

  select created_at into recent_at
  from private.email_verification_tokens
  where member_id = p_member_id
    and used_at is null
  order by created_at desc
  limit 1;

  if recent_at is not null and recent_at > pg_catalog.now() - interval '60 seconds' then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'throttled');
  end if;

  update private.email_verification_tokens
  set used_at = pg_catalog.now()
  where member_id = p_member_id
    and used_at is null;

  raw_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');

  insert into private.email_verification_tokens (member_id, token_hash, expires_at)
  values (
    p_member_id,
    pg_catalog.encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    pg_catalog.now() + interval '24 hours'
  );

  return pg_catalog.jsonb_build_object('ok', true, 'reason', 'issued', 'token', raw_token);
end;
$$;

create or replace function private.confirm_email_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_member uuid;
  hashed text;
begin
  if p_token is null or pg_catalog.btrim(p_token) = '' then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  hashed := pg_catalog.encode(extensions.digest(p_token, 'sha256'), 'hex');

  update private.email_verification_tokens
  set used_at = pg_catalog.now()
  where token_hash = hashed
    and used_at is null
    and expires_at > pg_catalog.now()
  returning member_id into found_member;

  if found_member is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  perform private.mark_email_verified(found_member);
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.issue_email_verification_token(p_member_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.issue_email_verification_token(p_member_id);
$$;

create or replace function public.confirm_email_token(p_token text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_email_token(p_token);
$$;

revoke all on function private.mark_email_verified(uuid) from public, anon, authenticated, service_role;
revoke all on function private.issue_email_verification_token(uuid) from public, anon, authenticated;
revoke all on function private.confirm_email_token(text) from public, anon, authenticated;
revoke all on function public.issue_email_verification_token(uuid) from public, anon, authenticated;
revoke all on function public.confirm_email_token(text) from public, anon, authenticated;

grant execute on function private.issue_email_verification_token(uuid) to service_role;
grant execute on function private.confirm_email_token(text) to service_role;
grant execute on function public.issue_email_verification_token(uuid) to service_role;
grant execute on function public.confirm_email_token(text) to service_role;
