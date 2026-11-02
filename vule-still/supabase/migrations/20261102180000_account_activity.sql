-- Account-wide 30-day activity, with per-Auth-session revocation.
-- Apply after the three foundation migrations. No synthetic timestamp edits here.
begin;

create table public.account_activity (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_activity_at timestamptz not null default statement_timestamp(),
  revoked_before timestamptz not null default '-infinity'::timestamptz,
  generation bigint not null default 1 check (generation > 0)
);

create table public.session_access (
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  generation bigint not null check (generation > 0),
  granted_at timestamptz not null default statement_timestamp()
);
create index session_access_user_id_idx on public.session_access (user_id);

create function app_private.create_account_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.account_activity (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function app_private.create_account_activity() from public, anon, authenticated;
create trigger vule_still_auth_activity_created after insert on auth.users
for each row execute function app_private.create_account_activity();
-- Existing accounts receive a fresh 30-day grace period at migration time.
insert into public.account_activity (user_id)
select id from auth.users on conflict (user_id) do nothing;

create function app_private.session_permitted()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.account_activity a
    join public.session_access x on x.user_id = a.user_id and x.generation = a.generation
    join auth.sessions s on s.id = x.session_id and s.user_id = a.user_id
    where a.user_id = (select auth.uid())
      and x.session_id = nullif((select auth.jwt() ->> 'session_id'), '')::uuid
      and s.created_at >= a.revoked_before
      and a.last_activity_at > statement_timestamp() - interval '30 days'
  );
$$;
revoke all on function app_private.session_permitted() from public, anon, authenticated;
grant execute on function app_private.session_permitted() to authenticated;

create function public.ensure_session_access()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_created_at timestamptz;
  v_account public.account_activity%rowtype;
  v_existing_generation bigint;
  v_now timestamptz := statement_timestamp();
  v_expiry timestamptz;
begin
  if v_user is null or v_session is null then return false; end if;
  select created_at into v_created_at from auth.sessions
  where id = v_session and user_id = v_user;
  if not found then return false; end if;

  select * into v_account from public.account_activity
  where user_id = v_user for update;
  if not found then return false; end if;
  v_expiry := v_account.last_activity_at + interval '30 days';
  if v_now >= v_expiry then
    -- A refreshed token keeps the old session ID/creation time. Only a new
    -- Auth login made after expiry can reset account-wide access.
    if v_created_at < v_expiry then return false; end if;
    update public.account_activity
    set last_activity_at = v_now,
        revoked_before = greatest(revoked_before, v_expiry),
        generation = generation + 1
    where user_id = v_user returning * into v_account;
  end if;
  if v_created_at < v_account.revoked_before then return false; end if;
  select generation into v_existing_generation from public.session_access
  where session_id = v_session;
  if found then
    return v_existing_generation = v_account.generation;
  end if;
  insert into public.session_access (session_id, user_id, generation)
  values (v_session, v_user, v_account.generation);
  -- A new login is a real user action. Repeated reads and token refreshes
  -- do not update account activity.
  update public.account_activity set last_activity_at = v_now where user_id = v_user;
  return true;
end;
$$;
revoke all on function public.ensure_session_access() from public, anon, authenticated;
grant execute on function public.ensure_session_access() to authenticated;

create function public.record_user_activity()
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.ensure_session_access() then return false; end if;
  update public.account_activity
  set last_activity_at = statement_timestamp()
  where user_id = auth.uid()
    and last_activity_at > statement_timestamp() - interval '30 days';
  return found;
end;
$$;
revoke all on function public.record_user_activity() from public, anon, authenticated;
grant execute on function public.record_user_activity() to authenticated;

-- Internal tables cannot be read or written through the browser/Data API.
alter table public.account_activity enable row level security;
alter table public.session_access enable row level security;
revoke all on table public.account_activity, public.session_access from public, anon, authenticated;
grant all on table public.account_activity, public.session_access to service_role;

create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select app_private.session_permitted()) and exists (
    select 1 from public.admin_memberships m
    join auth.users u on u.id = m.user_id
    where m.user_id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;

drop policy profiles_read_access on public.profiles;
create policy profiles_read_access on public.profiles
for select to authenticated
using ((select app_private.session_permitted()) and
       (id = (select auth.uid()) or (select app_private.is_admin())));
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using ((select app_private.session_permitted()) and id = (select auth.uid()))
with check ((select app_private.session_permitted()) and id = (select auth.uid()));
drop policy admin_memberships_read_own on public.admin_memberships;
create policy admin_memberships_read_own on public.admin_memberships
for select to authenticated
using ((select app_private.session_permitted()) and user_id = (select auth.uid()));

comment on table public.account_activity is 'Account-wide real activity. Only controlled functions update it.';
comment on table public.session_access is 'Registered Auth sessions; generation prevents revival after account inactivity.';
commit;
