-- Vule Still: foundation only. Apply once as the database owner/migration role.
-- Scheduling, bookings, notifications and 30-day session enforcement come later.
begin;

-- Internal functions must stay outside the Data API's exposed schemas.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  booking_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_first_name_valid check (
    first_name is null or (first_name = btrim(first_name) and first_name <> '')
  ),
  constraint profiles_last_name_valid check (
    last_name is null or (last_name = btrim(last_name) and last_name <> '')
  ),
  -- Canonical international shape; actual country/number validation belongs
  -- in the later application input layer. No SMS verification is implied.
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+[1-9][0-9]{1,14}$'
  )
);

create table public.admin_memberships (
  singleton boolean primary key default true,
  user_id uuid not null unique references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  constraint admin_memberships_single_owner check (singleton)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_slug_valid check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint locations_name_valid check (name = btrim(name) and name <> ''),
  constraint locations_address_valid check (
    address is null or (address = btrim(address) and address <> '')
  ),
  constraint locations_phone_format check (
    phone is null or phone ~ '^\+[1-9][0-9]{1,14}$'
  ),
  constraint locations_sort_order_valid check (sort_order >= 0)
);

-- The resource is independent of the administrator's login identity.
-- The singleton constraint deliberately enforces the agreed one-barber scope.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_single_barber check (singleton),
  constraint staff_display_name_valid check (
    display_name is null or (display_name = btrim(display_name) and display_name <> '')
  )
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  duration_minutes integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_slug_valid check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint services_name_valid check (name = btrim(name) and name <> ''),
  constraint services_category_valid check (category in ('standard', 'premium')),
  constraint services_duration_valid check (
    duration_minutes > 0 and duration_minutes % 10 = 0
  ),
  constraint services_sort_order_valid check (sort_order >= 0)
);

create function app_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function app_private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function app_private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function app_private.set_updated_at();
create trigger staff_set_updated_at before update on public.staff
for each row execute function app_private.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function app_private.set_updated_at();

-- Never grant authority or copy unvalidated profile fields from user metadata.
create function app_private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function app_private.create_profile_for_auth_user()
from public, anon, authenticated;

create trigger vule_still_auth_user_created
after insert on auth.users
for each row execute function app_private.create_profile_for_auth_user();

-- Empty projects have no rows here. Backfill safely if an Auth user was
-- created between planning and applying this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Narrow helper: no caller-supplied user ID, no metadata-based authority,
-- and no recursive membership policy. The Auth email must remain verified.
create function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_memberships as membership
    join auth.users as account on account.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and account.email_confirmed_at is not null
  );
$$;
revoke all on function app_private.is_admin() from public, anon, authenticated;
grant execute on function app_private.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.admin_memberships enable row level security;
alter table public.locations enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;

-- Explicit grants also remove any inherited project-default table grants.
revoke all on table public.profiles, public.admin_memberships,
  public.locations, public.staff, public.services from public, anon, authenticated;

grant select on public.profiles, public.admin_memberships,
  public.locations, public.staff, public.services to authenticated;
grant select on public.locations, public.services to anon;
grant update (first_name, last_name, phone) on public.profiles to authenticated;

-- service_role is a trusted server/maintenance role, never a browser role.
grant all on public.profiles, public.admin_memberships,
  public.locations, public.staff, public.services to service_role;

create policy profiles_read_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_admin_read on public.profiles
for select to authenticated
using ((select app_private.is_admin()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy admin_memberships_read_own on public.admin_memberships
for select to authenticated
using (user_id = (select auth.uid()));

create policy locations_public_read_active on public.locations
for select to anon, authenticated
using (is_active);

create policy locations_admin_read_all on public.locations
for select to authenticated
using ((select app_private.is_admin()));

create policy staff_admin_read on public.staff
for select to authenticated
using ((select app_private.is_admin()));

create policy services_public_read_active on public.services
for select to anon, authenticated
using (is_active);

create policy services_admin_read_all on public.services
for select to authenticated
using ((select app_private.is_admin()));

comment on table public.profiles is
  'Private profile. Nullable fields until booking; phone is current contact, not unique identity.';
comment on column public.profiles.booking_blocked is
  'Client cannot edit. Later controlled blocking transaction must cancel affected bookings and audit the change.';
comment on table public.admin_memberships is
  'At most one owner. Assignment is privileged and separate from editable profile data.';
comment on table public.staff is
  'One shared scheduling resource across both locations; not an Auth account.';
comment on column public.services.duration_minutes is
  'Positive multiples of 10. No additional business maximum. Future bookings must snapshot duration and name.';
comment on schema app_private is
  'Internal helpers/triggers; do not add to Supabase Data API exposed schemas.';

commit;
