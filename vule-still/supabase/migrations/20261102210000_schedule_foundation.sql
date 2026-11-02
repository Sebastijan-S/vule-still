-- Phase 5 schedule foundation. Apply only after account_activity.sql.
-- A draft is private; the published snapshot stays unchanged until explicit publish.
begin;

create table public.schedule_templates (
  weekday smallint not null check (weekday between 1 and 6),
  location_id uuid not null references public.locations(id),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  check (end_minute > start_minute),
  primary key (weekday, location_id)
);
insert into public.schedule_templates (weekday, location_id, start_minute, end_minute)
select day, l.id, case when l.slug = 'zrenjanin' then 600 else 1020 end,
  case when l.slug = 'zrenjanin' then 900 else 1200 end
from generate_series(1,6) as day cross join public.locations l
where l.slug in ('zrenjanin','neuzin');

create table public.schedule_weeks (
  week_start date primary key check (extract(isodow from week_start) = 1),
  draft jsonb not null default '[]'::jsonb,
  draft_revision integer not null default 0 check (draft_revision >= 0),
  published jsonb,
  published_revision integer not null default 0 check (published_revision >= 0),
  travel_gap_minutes integer not null default 60 check (travel_gap_minutes >= 0),
  published_gap_minutes integer check (published_gap_minutes >= 0),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create trigger schedule_weeks_set_updated_at before update on public.schedule_weeks
for each row execute function app_private.set_updated_at();

-- Entry shape: {date, location_id, start_minute, end_minute,
-- breaks:[{start_minute,end_minute}]}. A date with no entry is closed/absent.
create function app_private.validate_schedule(p_week date, p_entries jsonb, p_gap integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare e jsonb; b jsonb; e2 jsonb; prior_end integer; d date;
  lo uuid; start_n integer; end_n integer; other_lo uuid; gap_n integer;
begin
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
revoke all on function app_private.validate_schedule(date,jsonb,integer) from public,anon,authenticated;

create function app_private.check_schedule_week()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not app_private.validate_schedule(new.week_start,new.draft,new.travel_gap_minutes)
     or (new.published is not null and not app_private.validate_schedule(new.week_start,new.published,new.published_gap_minutes))
     then raise exception 'Invalid schedule' using errcode='22023'; end if;
  return new;
end;
$$;
revoke all on function app_private.check_schedule_week() from public,anon,authenticated;
create trigger schedule_week_validate before insert or update on public.schedule_weeks
for each row execute function app_private.check_schedule_week();

create function public.get_owner_schedule(p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
  select jsonb_build_object('week_start',week_start,'draft',draft,'draft_revision',draft_revision,
    'published',published,'published_revision',published_revision,'travel_gap_minutes',travel_gap_minutes,
    'published_gap_minutes',published_gap_minutes)
    into result from public.schedule_weeks where week_start=p_week;
  return result;
end;
$$;

create function public.prepare_schedule_week(p_week date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entries jsonb;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
  if extract(isodow from p_week) <> 1 then raise exception 'Monday required' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',p_week + (t.weekday-1),
    'location_id',t.location_id,'start_minute',t.start_minute,'end_minute',t.end_minute,
    'breaks','[]'::jsonb) order by t.weekday,t.start_minute),'[]'::jsonb)
    into entries from public.schedule_templates t;
  insert into public.schedule_weeks (week_start,draft) values (p_week,entries)
  on conflict (week_start) do nothing;
  return public.get_owner_schedule(p_week);
end;
$$;

create function public.save_schedule_draft(p_week date,p_expected_revision integer,p_entries jsonb,p_gap integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
  if not app_private.validate_schedule(p_week,p_entries,p_gap) then
    raise exception 'Invalid schedule' using errcode='22023'; end if;
  update public.schedule_weeks set draft=p_entries, travel_gap_minutes=p_gap,
    draft_revision=draft_revision+1
    where week_start=p_week and draft_revision=p_expected_revision
    returning draft_revision into next_revision;
  if next_revision is null then raise exception 'Schedule changed; reload' using errcode='40001'; end if;
  return next_revision;
end;
$$;

create function public.publish_schedule_week(p_week date,p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_revision integer;
begin
  if not app_private.is_admin() then raise exception 'Owner access required' using errcode='42501'; end if;
  -- Future booking writes must lock this same week row before validating a slot.
  update public.schedule_weeks set published=draft,published_gap_minutes=travel_gap_minutes,
    published_revision=published_revision+1,published_at=statement_timestamp()
    where week_start=p_week and draft_revision=p_expected_revision
    returning published_revision into next_revision;
  if next_revision is null then raise exception 'Schedule changed; reload' using errcode='40001'; end if;
  return next_revision;
end;
$$;

create function public.published_schedule(p_week date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('week_start',week_start,'entries',published,
    'travel_gap_minutes',published_gap_minutes,'revision',published_revision)
    from public.schedule_weeks where week_start=p_week and published is not null;
$$;

alter table public.schedule_templates enable row level security;
alter table public.schedule_weeks enable row level security;
revoke all on public.schedule_templates,public.schedule_weeks from public,anon,authenticated;
grant all on public.schedule_templates,public.schedule_weeks to service_role;
revoke all on function public.get_owner_schedule(date),public.prepare_schedule_week(date),
  public.save_schedule_draft(date,integer,jsonb,integer),public.publish_schedule_week(date,integer),
  public.published_schedule(date) from public,anon,authenticated;
grant execute on function public.get_owner_schedule(date),public.prepare_schedule_week(date),
  public.save_schedule_draft(date,integer,jsonb,integer),public.publish_schedule_week(date,integer) to authenticated;
grant execute on function public.published_schedule(date) to anon,authenticated;
commit;
