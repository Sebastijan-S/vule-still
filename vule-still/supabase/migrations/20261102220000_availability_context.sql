-- Phase 6: anonymous availability context, private interval foundation, strict schedule input.
-- This does not enable reservation writes. Phase 7 must extend reservations and add atomic RPCs.
begin;
create or replace function app_private.validate_schedule(p_week date, p_entries jsonb, p_gap integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare e jsonb; b jsonb; e2 jsonb; prior_end integer; d date;
  lo uuid; start_n integer; end_n integer; other_lo uuid; gap_n integer;
begin
  -- Reject missing/null/wrong-type fields before SQL's three-valued logic can skip them.
  if p_week is null or extract(isodow from p_week) <> 1 or p_gap is null or p_gap < 0
    or jsonb_typeof(p_entries) is distinct from 'array' then return false; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(e) is distinct from 'object'
      or jsonb_typeof(e->'date') is distinct from 'string'
      or jsonb_typeof(e->'location_id') is distinct from 'string'
      or jsonb_typeof(e->'start_minute') is distinct from 'number'
      or jsonb_typeof(e->'end_minute') is distinct from 'number'
      or jsonb_typeof(e->'breaks') is distinct from 'array'
      then return false; end if;
    for b in select value from jsonb_array_elements(e->'breaks') loop
      if jsonb_typeof(b) is distinct from 'object'
        or jsonb_typeof(b->'start_minute') is distinct from 'number'
        or jsonb_typeof(b->'end_minute') is distinct from 'number'
        then return false; end if;
    end loop;
  end loop;
  if p_gap is null or p_gap < 0 or jsonb_typeof(p_entries) <> 'array'
     or jsonb_array_length(p_entries) > 28 then return false; end if;
  if (select count(*) from jsonb_array_elements(p_entries)) <>
     (select count(distinct value) from jsonb_array_elements(p_entries)) then return false; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'breaks') <> 'array'
       or jsonb_array_length(e->'breaks') > 12 then return false; end if;
    begin
      d := (e->>'date')::date; lo := (e->>'location_id')::uuid;
      start_n := (e->>'start_minute')::integer; end_n := (e->>'end_minute')::integer;
    exception when others then return false; end;
    if d < p_week or d >= p_week + 7 or start_n < 0 or end_n > 1440
       or start_n >= end_n or not exists
         (select 1 from public.locations where id = lo and is_active) then return false; end if;
    prior_end := start_n;
    for b in select value from jsonb_array_elements(e->'breaks') loop
      begin
        if jsonb_typeof(b) <> 'object' or (b->>'start_minute')::integer < prior_end
           or (b->>'end_minute')::integer > end_n
           or (b->>'end_minute')::integer <= (b->>'start_minute')::integer then return false; end if;
        prior_end := (b->>'end_minute')::integer;
      exception when others then return false; end;
    end loop;
    for e2 in select value from jsonb_array_elements(p_entries) loop
      if e2 = e then continue; end if;
      begin
        if (e2->>'date')::date <> d then continue; end if;
        other_lo := (e2->>'location_id')::uuid;
        gap_n := case when other_lo <> lo then p_gap else 0 end;
        -- Sorted shifts must not overlap; different locations need travel time.
        if start_n < (e2->>'end_minute')::integer + gap_n
           and (e2->>'start_minute')::integer < end_n + gap_n
           then return false; end if;
      exception when others then return false; end;
    end loop;
  end loop;
  return true;
end;
$$;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  location_id uuid not null references public.locations(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (date_trunc('minute', starts_at) = starts_at and date_trunc('minute', ends_at) = ends_at)
);
create index reservations_confirmed_time_idx on public.reservations (starts_at, ends_at) where status = 'confirmed';
create index reservations_staff_id_idx on public.reservations(staff_id);
create index reservations_location_id_idx on public.reservations(location_id);
alter table public.reservations enable row level security;
revoke all on public.reservations from public, anon, authenticated;
grant all on public.reservations to service_role;
comment on table public.reservations is 'Phase 6 private interval foundation; no customer writes. Phase 7 adds ownership, snapshots, constraints and atomic mutation RPCs before enabling booking.';

create function public.availability_context(p_date date, p_location uuid, p_service uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  clock_now timestamptz := statement_timestamp();
  today date := (clock_now at time zone 'Europe/Belgrade')::date;
  monday date;
  week_data jsonb;
  gap integer;
  busy jsonb;
  service_data jsonb;
begin
  if p_date is null or p_location is null or p_service is null then
    raise exception 'Date, location and service required' using errcode='22023';
  end if;
  if p_date < today or p_date > today + 14 then
    return jsonb_build_object('reason','outside_horizon','server_time',clock_now);
  end if;
  if not exists (select 1 from public.locations where id=p_location and is_active) then
    return jsonb_build_object('reason','inactive_location','server_time',clock_now);
  end if;
  select jsonb_build_object('minutes',duration_minutes,'active',is_active)
    into service_data from public.services where id=p_service;
  if service_data is null or not (service_data->>'active')::boolean then
    return jsonb_build_object('reason','inactive_service','server_time',clock_now);
  end if;
  monday := p_date - (extract(isodow from p_date)::integer - 1);
  week_data := public.published_schedule(monday);
  gap := coalesce((week_data->>'travel_gap_minutes')::integer,60);
  select coalesce(jsonb_agg(jsonb_build_object('start',starts_at,'end',ends_at,'location_id',location_id)
    order by starts_at),'[]'::jsonb) into busy
  from public.reservations
  where status='confirmed'
    and starts_at < ((p_date + 1)::timestamp at time zone 'Europe/Belgrade') + make_interval(mins=>gap)
    and ends_at > (p_date::timestamp at time zone 'Europe/Belgrade') - make_interval(mins=>gap);
  return jsonb_build_object('server_time',clock_now,'service',service_data,'week',week_data,'occupied',busy);
end;
$$;
revoke all on function public.availability_context(date,uuid,uuid) from public, anon, authenticated;
grant execute on function public.availability_context(date,uuid,uuid) to anon, authenticated;
commit;
