-- Hosted safeupdate requires a qualified DELETE. Keep all ACLs and transaction validation.
begin;
create or replace function public.save_owner_schedule_template(p_expected_revision integer, p_entries jsonb, p_gap integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_revision integer; e jsonb; entries jsonb := '[]'::jsonb;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode = '42501'; end if;
  select revision into current_revision from public.schedule_template_settings where singleton for update;
  -- Do not overwrite another owner session's saved defaults.
  if p_expected_revision is distinct from current_revision then raise exception 'TEMPLATE_CHANGED' using errcode = 'P0001'; end if;
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_gap is null or p_gap < 0 or p_entries is null or jsonb_typeof(p_entries) <> 'array'
    or jsonb_array_length(p_entries) > 14 then raise exception 'INVALID_TEMPLATE' using errcode = '22023'; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'weekday') is distinct from 'number'
      or (e->>'weekday') !~ '^[1-7]$' or jsonb_typeof(e->'location_id') is distinct from 'string'
      or jsonb_typeof(e->'start_minute') is distinct from 'number' or (e->>'start_minute') !~ '^\d+$'
      or jsonb_typeof(e->'end_minute') is distinct from 'number' or (e->>'end_minute') !~ '^\d+$'
      or jsonb_typeof(e->'breaks') is distinct from 'array' then
      raise exception 'INVALID_TEMPLATE' using errcode = '22023';
    end if;
    -- Strict required break fields before the shared schedule validator.
    if exists (select 1 from jsonb_array_elements(e->'breaks') b where
      jsonb_typeof(b->'start_minute') is distinct from 'number' or (b->>'start_minute') !~ '^\d+$'
      or jsonb_typeof(b->'end_minute') is distinct from 'number' or (b->>'end_minute') !~ '^\d+$') then
      raise exception 'INVALID_TEMPLATE' using errcode = '22023';
    end if;
    entries := entries || jsonb_build_array(jsonb_build_object('date', date '2000-01-03' + ((e->>'weekday')::integer - 1),
      'location_id', e->>'location_id', 'start_minute', (e->>'start_minute')::integer,
      'end_minute', (e->>'end_minute')::integer, 'breaks', e->'breaks'));
  end loop;
  if not app_private.validate_schedule(date '2000-01-03', entries, p_gap)
    or (select count(*) from jsonb_array_elements(p_entries)) <>
      (select count(distinct (value->>'weekday', value->>'location_id')) from jsonb_array_elements(p_entries)) then
    raise exception 'INVALID_TEMPLATE' using errcode = '22023';
  end if;
  delete from public.schedule_templates where weekday between 1 and 7;
  insert into public.schedule_templates (weekday, location_id, start_minute, end_minute, breaks)
    select (value->>'weekday')::smallint, (value->>'location_id')::uuid,
      (value->>'start_minute')::smallint, (value->>'end_minute')::smallint, value->'breaks'
    from jsonb_array_elements(p_entries);
  update public.schedule_template_settings set revision = revision + 1, travel_gap_minutes = p_gap where singleton;
  return public.get_owner_schedule_template();
end;
$$;

commit;
