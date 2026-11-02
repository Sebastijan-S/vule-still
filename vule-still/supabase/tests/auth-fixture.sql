-- TEST DOUBLE ONLY: executed in a fresh in-memory PGlite database.
-- Never apply this file to Supabase. Real auth.users/auth.uid() are managed by Auth.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create table auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp()
);

create function auth.uid()
returns uuid language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create function auth.jwt()
returns jsonb language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;

-- Simulate permissive table defaults to verify that the migration removes them.
alter default privileges in schema public
grant all on tables to anon, authenticated, service_role;
