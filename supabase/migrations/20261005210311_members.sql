-- Member accounts and the draft documents they accept.
-- Trigger functions live in private so they are not exposed through the Data API.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  title text not null,
  body text not null,
  is_current boolean not null default false,
  published_at timestamptz not null default pg_catalog.now(),
  unique (kind, version)
);

create unique index legal_documents_one_current
  on public.legal_documents (kind)
  where is_current;

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  display_name text not null,
  terms_version text not null,
  privacy_version text not null,
  terms_accepted_at timestamptz not null default pg_catalog.now(),
  privacy_acknowledged_at timestamptz not null default pg_catalog.now(),
  timezone text not null,
  region text not null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint members_first_name_present check (char_length(btrim(first_name)) > 0),
  constraint members_display_name_present check (char_length(btrim(display_name)) > 0),
  constraint members_timezone_present check (char_length(btrim(timezone)) > 0),
  constraint members_region_present check (char_length(btrim(region)) > 0)
);

alter table public.legal_documents enable row level security;
alter table public.members enable row level security;

revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;

revoke all on public.members from anon, authenticated;
grant select, insert, update on public.members to authenticated;

create policy legal_documents_read
  on public.legal_documents
  for select
  to anon, authenticated
  using (true);

create policy members_select_own
  on public.members
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy members_insert_own
  on public.members
  for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and exists (
      select 1
      from public.legal_documents
      where kind = 'terms'
        and version = terms_version
        and is_current
    )
    and exists (
      select 1
      from public.legal_documents
      where kind = 'privacy'
        and version = privacy_version
        and is_current
    )
  );

create policy members_update_own
  on public.members
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

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

  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.protect_member_insert() from public;
revoke all on function private.protect_member_update() from public;
grant execute on function private.protect_member_insert() to authenticated;
grant execute on function private.protect_member_update() to authenticated;

create trigger members_protect_insert
  before insert on public.members
  for each row execute function private.protect_member_insert();

create trigger members_protect_update
  before update on public.members
  for each row execute function private.protect_member_update();

insert into public.legal_documents (kind, version, title, body, is_current)
values
  (
    'terms',
    '2026-10-05',
    'Terms of Service',
    'Unpublished draft. This is not the production Terms of Service and will be replaced before production.' || E'\n\n' ||
    'Creating a Brew & Move account uses your email and password for this demo. Brew Points are not issued here, and café redemption is not completed here.',
    true
  ),
  (
    'privacy',
    '2026-10-05',
    'Privacy Policy',
    'Unpublished draft. This is not the production Privacy Policy and will be replaced before production.' || E'\n\n' ||
    'Brew & Move stores your email, first name, display name, the version of each document you accept, and the timezone and region reported by your device. Today''s step total stays on this phone until a later validation task.',
    true
  );
