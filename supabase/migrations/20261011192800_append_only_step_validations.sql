alter table public.step_validations
  add column anchor_id uuid;

update public.step_validations
set anchor_id = id
where anchor_id is null;

alter table public.step_validations
  alter column anchor_id set not null;

alter table public.step_validations
  add constraint step_validations_anchor_fk
  foreign key (anchor_id) references public.step_validations (id) on delete cascade;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_catalog.pg_constraint as con
    join pg_catalog.pg_class as rel on rel.oid = con.conrelid
    join pg_catalog.pg_namespace as nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'step_validations'
      and con.contype = 'u'
  loop
    execute format('alter table public.step_validations drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.step_validations
  drop constraint step_validations_no_overlap;

alter table public.step_validations
  add constraint step_validations_no_overlap
  exclude using gist (
    member_id with =,
    tstzrange(window_start, window_end, '[)') with &&
  )
  where (id = anchor_id);

create unique index step_validations_one_anchor
  on public.step_validations (member_id, timezone, local_date)
  where (id = anchor_id);

create index step_validations_anchor
  on public.step_validations (anchor_id);

alter table public.step_validations
  alter column step_total drop not null;

comment on column public.step_validations.anchor_id is
  'The first validation of this midnight-to-midnight window. Later awards of the same day point here. Overlap is judged on this row.';

comment on column public.step_validations.awarded_points is
  'Brew Points added by this validation. The day’s total is the sum of rows that share the same window.';

comment on column public.step_validations.step_total is
  'Daily total submitted with this validation. The server does not read Apple Health or Health Connect and does not independently verify this figure. Earlier awards that were later overwritten may have no stored step total.';

comment on table public.step_validations is
  'One award from a validated local-day window. A later validation of the same day inserts another row. Overlap uses absolute window_start and window_end on the first row of that window, not the timezone name.';

with ranked as (
  select
    issuances.id as issuance_id,
    issuances.validation_id as surviving_id,
    issuances.points,
    issuances.created_at,
    pg_catalog.gen_random_uuid() as new_validation_id,
    row_number() over (
      partition by issuances.validation_id
      order by issuances.awarded_total, issuances.created_at
    ) as award_n,
    count(*) over (partition by issuances.validation_id) as award_count
  from private.point_issuances as issuances
),
inserted as (
  insert into public.step_validations (
    id,
    anchor_id,
    member_id,
    local_date,
    timezone,
    step_total,
    source_platform,
    awarded_points,
    validated_at,
    window_start,
    window_end
  )
  select
    ranked.new_validation_id,
    ranked.surviving_id,
    surviving.member_id,
    surviving.local_date,
    surviving.timezone,
    null,
    surviving.source_platform,
    ranked.points,
    ranked.created_at,
    surviving.window_start,
    surviving.window_end
  from ranked
  join public.step_validations as surviving on surviving.id = ranked.surviving_id
  where ranked.award_count > 1
    and ranked.award_n < ranked.award_count
  returning id
),
moved as (
  update private.point_issuances
  set validation_id = ranked.new_validation_id
  from ranked
  where point_issuances.id = ranked.issuance_id
    and ranked.award_count > 1
    and ranked.award_n < ranked.award_count
  returning point_issuances.id
)
update public.step_validations as surviving
set awarded_points = ranked.points
from ranked
where surviving.id = ranked.surviving_id
  and ranked.award_count > 1
  and ranked.award_n = ranked.award_count
  and (select count(*) from inserted) >= 0
  and (select count(*) from moved) >= 0;

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
  awarded_today integer;
  delta integer;
  current_balance integer;
  new_id uuid;
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
    and id = anchor_id
  for update;

  if existing.id is null then
    select stored.id into overlapping
    from public.step_validations as stored
    where stored.member_id = p_member_id
      and stored.id = stored.anchor_id
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
    select coalesce(sum(awarded_points), 0)
    into awarded_today
    from public.step_validations
    where anchor_id = existing.id;

    if reached <= awarded_today then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'reason', 'no_additional',
        'awarded_delta', 0,
        'awarded_today', awarded_today,
        'balance', current_balance,
        'step_total', p_step_total
      );
    end if;

    delta := reached - awarded_today;
    new_id := pg_catalog.gen_random_uuid();

    insert into public.step_validations (
      id,
      anchor_id,
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
      new_id,
      existing.id,
      p_member_id,
      p_local_date,
      p_timezone,
      p_step_total,
      p_source_platform,
      delta,
      v_window_start,
      v_window_end
    );

    insert into private.point_issuances (
      member_id,
      validation_id,
      points,
      awarded_total,
      rule_version
    )
    values (p_member_id, new_id, delta, reached, 'provisional-v1');

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

  new_id := pg_catalog.gen_random_uuid();

  insert into public.step_validations (
    id,
    anchor_id,
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
    new_id,
    new_id,
    p_member_id,
    p_local_date,
    p_timezone,
    p_step_total,
    p_source_platform,
    reached,
    v_window_start,
    v_window_end
  );

  insert into private.point_issuances (
    member_id,
    validation_id,
    points,
    awarded_total,
    rule_version
  )
  values (p_member_id, new_id, reached, reached, 'provisional-v1');

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
