-- Preserve the same access while avoiding multiple SELECT policies per role.
begin;

drop policy profiles_read_own on public.profiles;
drop policy profiles_admin_read on public.profiles;
create policy profiles_read_access on public.profiles
for select to authenticated
using (id = (select auth.uid()) or (select app_private.is_admin()));

drop policy locations_public_read_active on public.locations;
drop policy locations_admin_read_all on public.locations;
create policy locations_public_read_active on public.locations
for select to anon using (is_active);
create policy locations_authenticated_read on public.locations
for select to authenticated
using (is_active or (select app_private.is_admin()));

drop policy services_public_read_active on public.services;
drop policy services_admin_read_all on public.services;
create policy services_public_read_active on public.services
for select to anon using (is_active);
create policy services_authenticated_read on public.services
for select to authenticated
using (is_active or (select app_private.is_admin()));

commit;
