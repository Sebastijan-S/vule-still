-- READ ONLY. Run ONLY in Vule-still-test (xfbjgxtgvlyndonhlupm).
-- Inspect output before applying 20261103120000_booking_transactions.sql.
-- Never replay a migration because SQL Editor has no CLI history entry.
select version();
select table_schema,table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name in
  ('reservations','booking_notifications','booking_audit','booking_mutation_keys','schedule_weeks')
order by table_name,ordinal_position;
select count(*) as reservation_rows from public.reservations;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  md5(pg_get_functiondef(p.oid)) as definition_hash,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app_private') and p.proname in
  ('confirm_reservation','cancel_reservation','publish_schedule_week','save_schedule_draft',
   'preview_schedule_publication','publish_schedule_with_impact','availability_context',
   'session_permitted','is_admin','lock_booking_resource')
order by n.nspname,p.proname;
select conname,contype,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid='public.reservations'::regclass;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename like 'booking%'
  or schemaname='public' and tablename='reservations';
select to_regclass('supabase_migrations.schema_migrations') as cli_history_table;
-- If the last result exists, also inspect its versions separately. Foundation
-- reservation_rows must be 0 before this uninstalled migration; unexpected data
-- requires explicit review/backfill, never deletion to pass the precondition.
