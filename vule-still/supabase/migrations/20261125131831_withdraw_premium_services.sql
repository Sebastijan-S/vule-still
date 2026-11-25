-- Temporarily withdraw only the three existing premium catalogue entries.
-- Keep their identities and snapshots on historical reservations intact.
begin;
update public.services
set is_active = false
where category = 'premium' and slug in (
  'oblikovanje-obrva-britvom',
  'tretman-toplim-peskirom',
  'tretman-usnim-svecama'
);
commit;
