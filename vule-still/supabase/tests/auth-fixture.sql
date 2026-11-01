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

create function auth.uid()
returns uuid language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

-- Simulate permissive table defaults to verify that the migration removes them.
alter default privileges in schema public
grant all on tables to anon, authenticated, service_role;
