create or replace function private.validate_steps(
  p_member_id uuid,
  p_local_date date,
  p_timezone text,
  p_step_total integer,
  p_source_platform text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_found uuid;
  current_privacy text;
  member_privacy text;
  v_window_start timestamptz;
  v_window_end timestamptz;
  today_local date;
  reached integer;
  existing public.step_validations%rowtype;
  overlapping uuid;
  delta integer;
  current_balance integer;
begin
  if p_member_id is null
    or p_local_date is null
    or p_timezone is null
    or pg_catalog.btrim(p_timezone) = ''
    or char_length(p_timezone) > 64
    or p_step_total is null
    or p_step_total < 0
    or p_step_total > 1000000
    or p_source_platform not in ('apple_health', 'health_connect')
  then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select id, privacy_version
  into member_found, member_privacy
  from public.members
  where id = p_member_id
  for update;

  if member_found is null then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'not_onboarded');
  end if;

  select version into current_privacy
  from public.legal_documents
  where kind = 'privacy'
    and is_current;

  if member_privacy is distinct from current_privacy then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'privacy_required');
  end if;

  today_local := (pg_catalog.now() at time zone p_timezone)::date;
  if p_local_date <> today_local then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'day_closed');
  end if;

  v_window_start := p_local_date::timestamp at time zone p_timezone;
  v_window_end := (p_local_date + 1)::timestamp at time zone p_timezone;
  if v_window_end <= v_window_start then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  insert into public.member_balances (member_id, balance)
  values (p_member_id, 0)
  on conflict (member_id) do nothing;

  select balance into current_balance
  from public.member_balances
  where member_id = p_member_id
  for update;

  select * into existing
  from public.step_validations
  where member_id = p_member_id
    and timezone = p_timezone
    and local_date = p_local_date
  for update;

  if existing.id is null then
    select stored.id into overlapping
    from public.step_validations as stored
    where stored.member_id = p_member_id
      and tstzrange(stored.window_start, stored.window_end, '[)')
        && tstzrange(v_window_start, v_window_end, '[)')
    limit 1;

    if overlapping is not null then
      return pg_catalog.jsonb_build_object(
        'ok', false,
        'reason', 'day_overlap',
        'awarded_delta', 0,
        'awarded_today', 0,
        'balance', current_balance
      );
    end if;
  end if;

  reached := private.points_for_steps(p_step_total);

  if existing.id is not null then
    if reached <= existing.awarded_points then
      if p_step_total > existing.step_total then
        update public.step_validations
        set
          step_total = p_step_total,
          source_platform = p_source_platform,
          validated_at = pg_catalog.now()
        where id = existing.id;
      end if;

      return pg_catalog.jsonb_build_object(
        'ok', true,
        'reason', 'no_additional',
        'awarded_delta', 0,
        'awarded_today', existing.awarded_points,
        'balance', current_balance,
        'step_total', case
          when p_step_total > existing.step_total then p_step_total
          else existing.step_total
        end
      );
    end if;

    delta := reached - existing.awarded_points;

    update public.step_validations
    set
      step_total = p_step_total,
      source_platform = p_source_platform,
      awarded_points = reached,
      validated_at = pg_catalog.now()
    where id = existing.id;

    insert into private.point_issuances (
      member_id,
      validation_id,
      points,
      awarded_total,
      rule_version
    )
    values (p_member_id, existing.id, delta, reached, 'provisional-v1');

    update public.member_balances
    set
      balance = balance + delta,
      updated_at = pg_catalog.now()
    where member_id = p_member_id
    returning balance into current_balance;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'reason', 'awarded',
      'awarded_delta', delta,
      'awarded_today', reached,
      'balance', current_balance,
      'step_total', p_step_total
    );
  end if;

  if reached <= 0 then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'reason', 'no_additional',
      'awarded_delta', 0,
      'awarded_today', 0,
      'balance', current_balance,
      'step_total', p_step_total
    );
  end if;

  insert into public.step_validations (
    member_id,
    local_date,
    timezone,
    step_total,
    source_platform,
    awarded_points,
    window_start,
    window_end
  )
  values (
    p_member_id,
    p_local_date,
    p_timezone,
    p_step_total,
    p_source_platform,
    reached,
    v_window_start,
    v_window_end
  )
  returning * into existing;

  insert into private.point_issuances (
    member_id,
    validation_id,
    points,
    awarded_total,
    rule_version
  )
  values (p_member_id, existing.id, reached, reached, 'provisional-v1');

  update public.member_balances
  set
    balance = balance + reached,
    updated_at = pg_catalog.now()
  where member_id = p_member_id
  returning balance into current_balance;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'reason', 'awarded',
    'awarded_delta', reached,
    'awarded_today', reached,
    'balance', current_balance,
    'step_total', p_step_total
  );
exception
  when exclusion_violation then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'reason', 'day_overlap',
      'awarded_delta', 0,
      'awarded_today', 0,
      'balance', coalesce(current_balance, 0)
    );
end;
$$;
