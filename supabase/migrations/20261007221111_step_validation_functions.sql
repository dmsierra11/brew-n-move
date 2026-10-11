create or replace function private.points_for_steps(p_steps integer)
returns integer language sql immutable set search_path = ''
as $$
  select case
    when p_steps >= 20000 then 200
    when p_steps >= 17500 then 175
    when p_steps >= 15000 then 150
    when p_steps >= 12500 then 125
    when p_steps >= 10000 then 100
    when p_steps >= 7500 then 75
    when p_steps >= 5000 then 50
    when p_steps >= 2500 then 25
    else 0
  end;
$$;

create or replace function private.protect_member_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.first_name is distinct from old.first_name
    or new.terms_version is distinct from old.terms_version
    or new.terms_accepted_at is distinct from old.terms_accepted_at
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
  if new.privacy_version is distinct from old.privacy_version
    or new.privacy_acknowledged_at is distinct from old.privacy_acknowledged_at
  then
    if pg_catalog.current_setting('private.acknowledging_privacy', true) is distinct from 'on' then
      raise exception 'privacy acknowledgement cannot be changed';
    end if;
    if new.privacy_version is distinct from (
      select version from public.legal_documents where kind = 'privacy' and is_current
    ) then
      raise exception 'privacy version is not current';
    end if;
  end if;
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function private.acknowledge_current_privacy(p_member_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  current_version text;
  member_found uuid;
begin
  select version into current_version from public.legal_documents where kind = 'privacy' and is_current;
  if current_version is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  select id into member_found from public.members where id = p_member_id for update;
  if member_found is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'no_member');
  end if;
  perform pg_catalog.set_config('private.acknowledging_privacy', 'on', true);
  update public.members
  set privacy_version = current_version, privacy_acknowledged_at = pg_catalog.now()
  where id = p_member_id and privacy_version is distinct from current_version;
  if not found then
    return pg_catalog.jsonb_build_object('ok', true, 'reason', 'already_current', 'version', current_version);
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'reason', 'acknowledged', 'version', current_version);
end;
$$;

revoke all on function private.points_for_steps(integer) from public, anon, authenticated;
revoke all on function private.acknowledge_current_privacy(uuid) from public, anon, authenticated;
grant execute on function private.points_for_steps(integer) to service_role;
grant execute on function private.acknowledge_current_privacy(uuid) to service_role;
