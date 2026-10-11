create extension if not exists btree_gist with schema extensions;

update public.legal_documents
set is_current = false
where kind = 'privacy'
  and version = '2026-10-05';

insert into public.legal_documents (kind, version, title, body, is_current)
values (
  'privacy',
  '2026-10-07',
  'Privacy Policy',
  'Unpublished draft. This is not the production Privacy Policy and will be replaced before production.' || E'\n\n' ||
  'Brew & Move stores your email, first name, display name, the version of each document you accept, and the timezone and region reported by your device.' || E'\n\n' ||
  'When you validate a day, Brew & Move stores that local date, the timezone reported by your phone, whether the total came from Apple Health or Health Connect, the daily step total submitted by the app, the time of validation, and the Brew Points awarded. It does not store step-by-step samples. The server does not read Apple Health or Health Connect, so it does not independently verify that the submitted total matches the health store. Your Brew Points balance is stored with your account.',
  true
);

create table public.member_balances (
  member_id uuid primary key references public.members (id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default pg_catalog.now(),
  constraint member_balances_nonnegative check (balance >= 0)
);

create table public.step_validations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  local_date date not null,
  timezone text not null,
  step_total integer not null,
  source_platform text not null,
  awarded_points integer not null,
  validated_at timestamptz not null default pg_catalog.now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  constraint step_validations_timezone_present check (char_length(btrim(timezone)) > 0),
  constraint step_validations_step_total_range check (step_total >= 0 and step_total <= 1000000),
  constraint step_validations_platform check (source_platform in ('apple_health', 'health_connect')),
  constraint step_validations_awarded_range check (awarded_points >= 0),
  constraint step_validations_window check (window_end > window_start),
  unique (member_id, timezone, local_date)
);

create index step_validations_member on public.step_validations (member_id);

alter table public.step_validations
  add constraint step_validations_no_overlap
  exclude using gist (
    member_id with =,
    tstzrange(window_start, window_end, '[)') with &&
  );

comment on column public.step_validations.step_total is
  'Daily total submitted by the member app. The server does not read Apple Health or Health Connect and does not independently verify this figure.';

comment on table public.step_validations is
  'One validated local-day window. Overlap uses absolute window_start and window_end, not the timezone name. Adjacent windows are allowed. An overlapping window cannot be partially awarded.';

create table private.point_issuances (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  validation_id uuid not null references public.step_validations (id) on delete cascade,
  points integer not null,
  awarded_total integer not null,
  rule_version text not null,
  solana_status text not null default 'blocked',
  created_at timestamptz not null default pg_catalog.now(),
  constraint point_issuances_points_positive check (points > 0),
  constraint point_issuances_awarded_positive check (awarded_total > 0),
  constraint point_issuances_rule_present check (char_length(btrim(rule_version)) > 0),
  constraint point_issuances_solana_status check (solana_status in ('blocked', 'submitted')),
  unique (validation_id, awarded_total)
);

comment on column private.point_issuances.solana_status is
  'blocked means no devnet submission has run. submitted is reserved for a later retry of this same row. This status is not an on-chain recording.';

create index point_issuances_blocked on private.point_issuances (created_at) where solana_status = 'blocked';

alter table public.member_balances enable row level security;
alter table public.step_validations enable row level security;
alter table private.point_issuances enable row level security;

revoke all on public.member_balances from anon, authenticated;
grant select on public.member_balances to authenticated;
revoke all on public.step_validations from anon, authenticated;
grant select on public.step_validations to authenticated;
revoke all on private.point_issuances from public, anon, authenticated;

create policy member_balances_select_own on public.member_balances for select to authenticated using (member_id = (select auth.uid()));
create policy step_validations_select_own on public.step_validations for select to authenticated using (member_id = (select auth.uid()));
