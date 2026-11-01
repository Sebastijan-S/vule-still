-- Privileged, manual setup AFTER this account completes email verification.
-- Not a schema migration, seed, signup hook or public RPC.
-- Never insert Auth users or mark an email verified to make this script pass.
begin;
lock table public.admin_memberships in exclusive mode;

do $$
declare
  admin_email constant text := 'sekosansebastijan@gmail.com';
  target_id uuid;
  existing_id uuid;
  matching_accounts integer;
begin
  select count(*) into matching_accounts
  from auth.users
  where lower(email) = lower(admin_email)
    and email_confirmed_at is not null;

  if matching_accounts <> 1 then
    raise exception 'Expected exactly one verified Auth account for %, found %. Complete email verification first.',
      admin_email, matching_accounts;
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(admin_email)
    and email_confirmed_at is not null;

  select user_id into existing_id
  from public.admin_memberships
  where singleton;

  if existing_id is not null and existing_id <> target_id then
    raise exception 'A different administrator already exists. This script does not transfer ownership.';
  elsif existing_id = target_id then
    raise notice 'Administrator is already assigned; no change.';
  else
    insert into public.admin_memberships (user_id) values (target_id);
  end if;
end;
$$;
commit;
