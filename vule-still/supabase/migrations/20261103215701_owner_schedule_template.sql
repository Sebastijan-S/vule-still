-- Owner-editable defaults. Existing week drafts/published snapshots are never
-- updated by template saves. Apply once to Vule-still-test only.
begin;

alter table public.schedule_templates drop constraint schedule_templates_weekday_check;
alter table public.schedule_templates add constraint schedule_templates_weekday_check check (weekday between 1 and 7);
alter table public.schedule_templates add column breaks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(breaks) = 'array');

create table public.schedule_template_settings (
  singleton boolean primary key default true check (singleton),
  revision integer not null default 0 check (revision >= 0),
  travel_gap_minutes integer not null default 60 check (travel_gap_minutes >= 0)
);
insert into public.schedule_template_settings (singleton) values (true);
alter table public.schedule_template_settings enable row level security;
revoke all on public.schedule_template_settings from public, anon, authenticated;
grant all on public.schedule_template_settings to service_role;

create function public.get_owner_schedule_template()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode = '42501'; end if;
  return (select jsonb_build_object('revision', s.revision, 'travel_gap_minutes', s.travel_gap_minutes,
    'entries', (select coalesce(jsonb_agg(jsonb_build_object('weekday', t.weekday,
      'location_id', t.location_id, 'start_minute', t.start_minute, 'end_minute', t.end_minute,
      'breaks', t.breaks) order by t.weekday, t.start_minute), '[]'::jsonb)
      from public.schedule_templates t)) from public.schedule_template_settings s where s.singleton);
end;
$$;

create function public.save_owner_schedule_template(p_expected_revision integer, p_entries jsonb, p_gap integer)
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
  delete from public.schedule_templates;
  insert into public.schedule_templates (weekday, location_id, start_minute, end_minute, breaks)
    select (value->>'weekday')::smallint, (value->>'location_id')::uuid,
      (value->>'start_minute')::smallint, (value->>'end_minute')::smallint, value->'breaks'
    from jsonb_array_elements(p_entries);
  update public.schedule_template_settings set revision = revision + 1, travel_gap_minutes = p_gap where singleton;
  return public.get_owner_schedule_template();
end;
$$;

create or replace function public.prepare_schedule_week(p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entries jsonb; gap_minutes integer;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_week is null or extract(isodow from p_week) <> 1 then raise exception 'Monday required' using errcode = '22023'; end if;
  -- Serialize reading defaults with template saves: one coherent snapshot.
  select travel_gap_minutes into gap_minutes from public.schedule_template_settings where singleton for share;
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date', p_week + (t.weekday - 1),
    'location_id', t.location_id, 'start_minute', t.start_minute, 'end_minute', t.end_minute,
    'breaks', t.breaks) order by t.weekday, t.start_minute), '[]'::jsonb)
    into entries from public.schedule_templates t;
  insert into public.schedule_weeks (week_start, draft, travel_gap_minutes) values (p_week, entries, gap_minutes)
    on conflict (week_start) do nothing;
  return public.get_owner_schedule(p_week);
end;
$$;

revoke all on function public.get_owner_schedule_template(), public.save_owner_schedule_template(integer,jsonb,integer) from public, anon, authenticated;
grant execute on function public.get_owner_schedule_template(), public.save_owner_schedule_template(integer,jsonb,integer) to authenticated;
-- Keep the existing prepare ACL explicit after replacement.
revoke all on function public.prepare_schedule_week(date) from public, anon;
grant execute on function public.prepare_schedule_week(date) to authenticated;
commit;
