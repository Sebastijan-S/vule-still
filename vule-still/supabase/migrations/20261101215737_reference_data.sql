-- Confirmed starting data only: no customers, accounts or reservations.
begin;

insert into public.locations (id, slug, name, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'zrenjanin', 'Zrenjanin', 1),
  ('10000000-0000-4000-8000-000000000002', 'neuzin', 'Neuzin', 2);

-- The barber's personal/display name has not been supplied.
insert into public.staff (id)
values ('20000000-0000-4000-8000-000000000001');

insert into public.services (id, slug, name, category, duration_minutes, sort_order)
values
  ('30000000-0000-4000-8000-000000000001', 'klasicno-sisanje',
    'Klasično šišanje', 'standard', 20, 1),
  ('30000000-0000-4000-8000-000000000002', 'sisanje-sa-izbrijavanjem',
    'Šišanje sa izbrijavanjem', 'standard', 20, 2),
  ('30000000-0000-4000-8000-000000000003', 'brada',
    'Brada', 'standard', 20, 3),
  ('30000000-0000-4000-8000-000000000004', 'sisanje-i-brada',
    'Šišanje i brada', 'standard', 20, 4),
  ('30000000-0000-4000-8000-000000000005', 'oblikovanje-obrva-britvom',
    'Oblikovanje obrva britvom', 'premium', 40, 5),
  ('30000000-0000-4000-8000-000000000006', 'tretman-toplim-peskirom',
    'Tretman toplim peškirom', 'premium', 40, 6),
  ('30000000-0000-4000-8000-000000000007', 'tretman-usnim-svecama',
    'Tretman ušnim svećama', 'premium', 40, 7);

-- Addresses and public phone numbers stay NULL until real values are supplied.
-- Weekly opening hours will be stored in the later scheduling migrations.
commit;
