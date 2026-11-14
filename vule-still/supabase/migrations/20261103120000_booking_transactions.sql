-- Phase 7. Additive schema + narrow transactional RPCs. No Auth/SMTP changes.
-- Inspect the target first. Phase 6 intervals must be empty, not silently invented customers.
begin;
do $$ begin
  if exists (select 1 from public.reservations) then
    raise exception 'Reservation foundation is not empty; review/backfill explicitly before applying';
  end if;
end $$;

alter table public.reservations
  add column user_id uuid references public.profiles(id) on delete restrict,
  add column guest_name text,
  add column guest_phone text,
  add column attendee_name text not null,
  add column service_id uuid not null references public.services(id),
  add column service_name text not null,
  add column duration_minutes integer not null,
  add column version integer not null default 1 check (version > 0),
  add column cancelled_at timestamptz,
  add column cancellation_reason text,
  add constraint reservation_customer_or_guest check (
    (user_id is not null and guest_name is null and guest_phone is null) or
    (user_id is null and guest_name is not null and guest_name = btrim(guest_name) and guest_name <> '')),
  add constraint reservation_attendee_valid check (attendee_name = btrim(attendee_name) and char_length(attendee_name) between 1 and 120),
  add constraint reservation_guest_phone_valid check (guest_phone is null or guest_phone ~ '^\+[1-9][0-9]{1,14}$'),
  add constraint reservation_snapshot_valid check (service_name <> '' and duration_minutes > 0 and duration_minutes % 10 = 0
    and ends_at = starts_at + make_interval(mins => duration_minutes)),
  add constraint reservation_cancelled_valid check ((status = 'confirmed' and cancelled_at is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and nullif(btrim(cancellation_reason),'') is not null));
create index reservations_user_time_idx on public.reservations(user_id,starts_at);
create index reservations_service_idx on public.reservations(service_id);
-- The staff table enforces exactly one possible barber. A range exclusion
-- constraint protects that shared resource even outside the controlled RPCs,
-- including transactions whose snapshot predates another writer's commit.
alter table public.reservations add constraint reservations_no_overlap
  exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&)
  where (status='confirmed');

create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  kind text not null check (kind in ('confirmed','cancelled','changed')),
  message text not null,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz
);
create index booking_notifications_user_time_idx on public.booking_notifications(user_id,created_at);
create index booking_notifications_reservation_idx on public.booking_notifications(reservation_id);
create table public.booking_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  reservation_id uuid references public.reservations(id) on delete restrict,
  action text not null,
  details jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index booking_audit_actor_idx on public.booking_audit(actor_id);
create index booking_audit_reservation_idx on public.booking_audit(reservation_id);
create table public.booking_mutation_keys (
  user_id uuid not null references public.profiles(id) on delete restrict,
  request_key uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,request_key)
);
alter table public.booking_notifications enable row level security;
alter table public.booking_audit enable row level security;
alter table public.booking_mutation_keys enable row level security;
revoke all on public.booking_notifications,public.booking_audit,public.booking_mutation_keys from public,anon,authenticated;
grant all on public.booking_notifications,public.booking_audit,public.booking_mutation_keys to service_role;
grant select on public.reservations,public.booking_notifications to authenticated;
create policy reservations_read_own on public.reservations for select to authenticated
  using ((select app_private.session_permitted()) and user_id = (select auth.uid()));
create policy booking_notifications_read_own on public.booking_notifications for select to authenticated
  using ((select app_private.session_permitted()) and user_id = (select auth.uid()));

-- All booking mutations and publications lock this SAME singleton staff row FIRST.
-- Low traffic (one barber) favors one simple lock over fragile per-day lock ordering.
create function app_private.lock_booking_resource() returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare resource uuid;
begin
  select id into strict resource from public.staff where singleton for update;
  return resource;
end $$;

create function app_private.require_booking_session() returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not app_private.session_permitted() or not exists (
    select 1 from public.account_activity a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and a.last_activity_at>clock_timestamp()-interval '30 days'
      and u.email_confirmed_at is not null
  ) then raise exception 'SESSION_REQUIRED' using errcode='42501'; end if;
end $$;

create function app_private.booking_time_valid(p_start timestamptz,p_now timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select p_start>=p_now+interval '15 minutes' and p_start=date_trunc('minute',p_start)
    and (p_start at time zone 'Europe/Belgrade')::date between
      (p_now at time zone 'Europe/Belgrade')::date and (p_now at time zone 'Europe/Belgrade')::date+14;
$$;
create function app_private.cancellation_time_valid(p_start timestamptz,p_now timestamptz) returns boolean
language sql immutable set search_path = '' as $$ select p_start>=p_now+interval '30 minutes'; $$;

-- Convert wall boundaries without a fixed UTC offset. Missing DST time fails closed;
-- repeated boundary opens at the first instant and closes at the last, matching TS.
create function app_private.local_boundary(p_date date,p_minute integer,p_end boolean default false)
returns timestamptz language plpgsql stable set search_path = '' as $$
declare wall timestamp := p_date::timestamp + make_interval(mins => p_minute); result timestamptz;
begin
  select case when p_end then max(candidate) else min(candidate) end into result
  from (
    select distinct (wall - ((sample at time zone 'Europe/Belgrade') - (sample at time zone 'UTC'))) at time zone 'UTC' as candidate
    from generate_series((wall at time zone 'UTC') - interval '36 hours',
      (wall at time zone 'UTC') + interval '36 hours',interval '6 hours') sample
  ) offsets where candidate at time zone 'Europe/Belgrade' = wall;
  if result is null then raise exception 'INVALID_SCHEDULE' using errcode='22023'; end if;
  return result;
end $$;

create function app_private.work_periods(p_entries jsonb,p_date date,p_location uuid)
returns tstzmultirange language plpgsql stable set search_path = '' as $$
declare e jsonb; b jsonb; periods tstzmultirange := '{}'::tstzmultirange;
  pauses tstzmultirange := '{}'::tstzmultirange;
begin
  for e in select value from jsonb_array_elements(p_entries) where (value->>'date')::date=p_date
    and (value->>'location_id')::uuid=p_location loop
    periods := periods + tstzmultirange(tstzrange(
      app_private.local_boundary(p_date,(e->>'start_minute')::integer),
      app_private.local_boundary(p_date,(e->>'end_minute')::integer,true),'[)'));
    for b in select value from jsonb_array_elements(e->'breaks') loop
      pauses := pauses + tstzmultirange(tstzrange(
        app_private.local_boundary(p_date,(b->>'start_minute')::integer),
        app_private.local_boundary(p_date,(b->>'end_minute')::integer,true),'[)'));
    end loop;
  end loop;
  return periods - pauses;
end $$;

create function app_private.week_of(p_start timestamptz) returns date
language sql immutable set search_path = '' as $$
  select date_trunc('week',p_start at time zone 'Europe/Belgrade')::date;
$$;

-- Database integrity also protects trusted maintenance INSERT/UPDATE, not only RPCs.
create function app_private.guard_reservation_overlap() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app_private.lock_booking_resource();
  if tg_op='UPDATE' and (new.service_id<>old.service_id or new.service_name<>old.service_name
    or new.duration_minutes<>old.duration_minutes) then
    raise exception 'IMMUTABLE_SERVICE_SNAPSHOT' using errcode='22023';
  end if;
  if new.status='confirmed' and exists (select 1 from public.reservations r
    where r.id<>new.id and r.staff_id=new.staff_id and r.status='confirmed'
      and r.starts_at<new.ends_at and new.starts_at<r.ends_at) then
    raise exception 'SLOT_TAKEN' using errcode='23P01';
  end if;
  return new;
end $$;
create trigger reservation_overlap_guard before insert or update on public.reservations
  for each row execute function app_private.guard_reservation_overlap();

create function app_private.booking_result(p_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id',id,'status',status,'location_id',location_id,'service_id',service_id,
    'service_name',service_name,'duration_minutes',duration_minutes,'starts_at',starts_at,
    'ends_at',ends_at,'attendee_name',attendee_name,'version',version) from public.reservations where id=p_id;
$$;

create function app_private.booking_event(p_id uuid,p_kind text,p_reason text) returns void
language plpgsql volatile set search_path = '' as $$
begin
  insert into public.booking_audit(actor_id,reservation_id,action,details)
    values(auth.uid(),p_id,p_kind,jsonb_build_object('reason',p_reason,'reservation',app_private.booking_result(p_id)));
  insert into public.booking_notifications(user_id,reservation_id,kind,message)
    select user_id,id,p_kind,p_reason from public.reservations where id=p_id and user_id is not null;
end $$;

create function public.confirm_reservation(p_request_key uuid,p_location uuid,p_service uuid,
  p_start timestamptz,p_expected_revision integer,p_attendee text default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  resource uuid; profile public.profiles%rowtype; svc public.services%rowtype;
  wk public.schedule_weeks%rowtype; prior public.booking_mutation_keys%rowtype;
  payload jsonb; result jsonb; reservation uuid; clock_now timestamptz; day date;
  periods tstzmultirange; busy record; gap integer; period tstzrange;
  attendee text; finish timestamptz; valid_start boolean := false;
begin
  perform app_private.require_booking_session();
  if p_request_key is null or p_location is null or p_service is null or p_start is null
    or p_expected_revision is null or p_expected_revision<1 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  payload := jsonb_build_object('operation','confirm','location',p_location,'service',p_service,
    'start',p_start,'revision',p_expected_revision,'attendee',nullif(btrim(p_attendee),''));
  resource := app_private.lock_booking_resource();
  -- Access can expire while waiting for another transaction.
  perform app_private.require_booking_session();
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if;
    return prior.result;
  end if;
  select * into strict profile from public.profiles where id=auth.uid() for update;
  if profile.booking_blocked then raise exception 'BOOKING_BLOCKED' using errcode='42501'; end if;
  if profile.first_name is null or profile.last_name is null or profile.phone is null then
    raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
  attendee := coalesce(nullif(btrim(p_attendee),''),profile.first_name||' '||profile.last_name);
  if char_length(attendee)>120 then raise exception 'INVALID_ATTENDEE' using errcode='22023'; end if;
  perform 1 from public.locations where id=p_location and is_active for share;
  if not found then raise exception 'INACTIVE_LOCATION' using errcode='22023'; end if;
  select * into svc from public.services where id=p_service and is_active for share;
  if not found then raise exception 'INACTIVE_SERVICE' using errcode='22023'; end if;
  day := (p_start at time zone 'Europe/Belgrade')::date;
  select * into wk from public.schedule_weeks where week_start=app_private.week_of(p_start) for update;
  if not found or wk.published is null then raise exception 'UNPUBLISHED' using errcode='P0001'; end if;
  if wk.published_revision<>p_expected_revision then raise exception 'SCHEDULE_CHANGED' using errcode='P0001'; end if;
  clock_now := clock_timestamp();
  if not app_private.booking_time_valid(p_start,clock_now) then raise exception 'TIME_BOUNDARY' using errcode='22023'; end if;
  finish := p_start+make_interval(mins=>svc.duration_minutes);
  periods := app_private.work_periods(wk.published,day,p_location);
  for busy in select r.*,w.published_gap_minutes as other_gap from public.reservations r
    left join public.schedule_weeks w on w.week_start=app_private.week_of(r.starts_at)
    where r.status='confirmed' loop
    gap := case when busy.location_id=p_location then 0 else greatest(wk.published_gap_minutes,coalesce(busy.other_gap,60)) end;
    periods := periods - tstzmultirange(tstzrange(busy.starts_at-make_interval(mins=>gap),busy.ends_at+make_interval(mins=>gap),'[)'));
  end loop;
  for period in select unnest(periods) loop
    if p_start>=lower(period) and finish<=upper(period)
      and mod(extract(epoch from (p_start-lower(period)))::numeric,svc.duration_minutes::numeric*60)=0 then valid_start:=true; end if;
  end loop;
  if not valid_start then raise exception 'SLOT_TAKEN' using errcode='23P01'; end if;
  insert into public.reservations(staff_id,location_id,user_id,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at)
    values(resource,p_location,auth.uid(),attendee,svc.id,svc.name,svc.duration_minutes,p_start,finish) returning id into reservation;
  perform app_private.booking_event(reservation,'confirmed','Rezervacija je potvrđena.');
  result := app_private.booking_result(reservation);
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);
  update public.account_activity set last_activity_at=clock_timestamp() where user_id=auth.uid();
  return result;
end $$;

create function public.cancel_reservation(p_request_key uuid,p_reservation uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare r public.reservations%rowtype; prior public.booking_mutation_keys%rowtype; payload jsonb; result jsonb; clock_now timestamptz;
begin
  perform app_private.require_booking_session();
  if p_request_key is null or p_reservation is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  perform app_private.lock_booking_resource();
  perform app_private.require_booking_session();
  payload := jsonb_build_object('operation','cancel','reservation',p_reservation);
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if;
    return prior.result;
  end if;
  select * into r from public.reservations where id=p_reservation and user_id=auth.uid() for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002'; end if;
  clock_now := clock_timestamp();
  if r.status='confirmed' then
    if not app_private.cancellation_time_valid(r.starts_at,clock_now) then raise exception 'CANCELLATION_TOO_LATE' using errcode='22023'; end if;
    update public.reservations set status='cancelled',cancelled_at=clock_now,cancellation_reason='Korisnik je otkazao rezervaciju.',version=version+1 where id=r.id;
    perform app_private.booking_event(r.id,'cancelled','Korisnik je otkazao rezervaciju.');
  end if;
  result := app_private.booking_result(r.id);
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);
  update public.account_activity set last_activity_at=clock_timestamp() where user_id=auth.uid();
  return result;
end $$;

-- Per-interval travel padding keeps advisory availability aligned across week edges.
create or replace function public.availability_context(p_date date,p_location uuid,p_service uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare clock_now timestamptz:=statement_timestamp(); today date:=(clock_now at time zone 'Europe/Belgrade')::date;
  monday date; week_data jsonb; gap integer; busy jsonb; service_data jsonb;
begin
  if p_date is null or p_location is null or p_service is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_date<today or p_date>today+14 then return jsonb_build_object('reason','outside_horizon','server_time',clock_now); end if;
  if not exists (select 1 from public.locations where id=p_location and is_active) then
    return jsonb_build_object('reason','inactive_location','server_time',clock_now); end if;
  select jsonb_build_object('minutes',duration_minutes,'active',is_active) into service_data from public.services where id=p_service;
  if service_data is null or not (service_data->>'active')::boolean then
    return jsonb_build_object('reason','inactive_service','server_time',clock_now); end if;
  monday:=p_date-(extract(isodow from p_date)::integer-1); week_data:=public.published_schedule(monday);
  gap:=coalesce((week_data->>'travel_gap_minutes')::integer,60);
  select coalesce(jsonb_agg(jsonb_build_object('start',r.starts_at,'end',r.ends_at,'location_id',r.location_id,
    'travel_gap_minutes',greatest(gap,coalesce(w.published_gap_minutes,60))) order by r.starts_at),'[]') into busy
  from public.reservations r left join public.schedule_weeks w on w.week_start=app_private.week_of(r.starts_at)
  where r.status='confirmed'
    and r.starts_at<((p_date+1)::timestamp at time zone 'Europe/Belgrade')+make_interval(mins=>greatest(gap,coalesce(w.published_gap_minutes,60)))
    and r.ends_at>(p_date::timestamp at time zone 'Europe/Belgrade')-make_interval(mins=>greatest(gap,coalesce(w.published_gap_minutes,60)));
  return jsonb_build_object('server_time',clock_now,'service',service_data,'week',week_data,'occupied',busy);
end $$;

-- Validate absolute intervals, including different days/weeks and DST boundaries.
create function app_private.validate_published_neighbors(p_week date,p_entries jsonb,p_gap integer)
returns void language plpgsql volatile set search_path = '' as $$
declare a record; b record;
begin
  for a in select value as e,p_gap as gap from jsonb_array_elements(p_entries) loop
    -- Resolving every boundary also rejects DST gaps, even with no appointments.
    perform app_private.work_periods(p_entries,(a.e->>'date')::date,(a.e->>'location_id')::uuid);
    for b in select value as e,p_gap as gap from jsonb_array_elements(p_entries)
      union all select value,w.published_gap_minutes from public.schedule_weeks w,
        lateral jsonb_array_elements(w.published) where w.week_start<>p_week and w.published is not null loop
      if a.e=b.e then continue; end if;
      if app_private.local_boundary((a.e->>'date')::date,(a.e->>'start_minute')::integer)
          < app_private.local_boundary((b.e->>'date')::date,(b.e->>'end_minute')::integer,true)
            + make_interval(mins=>case when a.e->>'location_id'<>b.e->>'location_id' then greatest(a.gap,b.gap) else 0 end)
        and app_private.local_boundary((b.e->>'date')::date,(b.e->>'start_minute')::integer)
          < app_private.local_boundary((a.e->>'date')::date,(a.e->>'end_minute')::integer,true)
            + make_interval(mins=>case when a.e->>'location_id'<>b.e->>'location_id' then greatest(a.gap,b.gap) else 0 end) then
        raise exception 'SCHEDULE_TRAVEL_CONFLICT' using errcode='22023';
      end if;
    end loop;
  end loop;
end $$;

create function app_private.schedule_impact(p_week date) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare wk public.schedule_weeks%rowtype; r record; affected jsonb := '[]'; fits boolean; clock_now timestamptz := clock_timestamp();
begin
  select * into strict wk from public.schedule_weeks where week_start=p_week;
  for r in select * from public.reservations where status='confirmed' and ends_at>clock_now order by id loop
    fits := true;
    if app_private.week_of(r.starts_at)=p_week then
      fits := app_private.work_periods(wk.draft,(r.starts_at at time zone 'Europe/Belgrade')::date,r.location_id)
        @> tstzrange(r.starts_at,r.ends_at,'[)');
    end if;
    if fits and exists (
      select 1 from public.reservations other
      left join public.schedule_weeks ow on ow.week_start=app_private.week_of(other.starts_at)
      left join public.schedule_weeks rw on rw.week_start=app_private.week_of(r.starts_at)
      where other.status='confirmed' and other.id<>r.id and other.location_id<>r.location_id
        and (app_private.week_of(r.starts_at)=p_week or app_private.week_of(other.starts_at)=p_week)
        and r.starts_at<other.ends_at+make_interval(mins=>greatest(
          case when app_private.week_of(r.starts_at)=p_week then wk.travel_gap_minutes else rw.published_gap_minutes end,
          case when app_private.week_of(other.starts_at)=p_week then wk.travel_gap_minutes else ow.published_gap_minutes end))
        and other.starts_at<r.ends_at+make_interval(mins=>greatest(
          case when app_private.week_of(r.starts_at)=p_week then wk.travel_gap_minutes else rw.published_gap_minutes end,
          case when app_private.week_of(other.starts_at)=p_week then wk.travel_gap_minutes else ow.published_gap_minutes end))
    ) then fits:=false; end if;
    if not fits then
      if r.starts_at<=clock_now then raise exception 'STARTED_RESERVATION' using errcode='22023'; end if;
      affected:=affected||jsonb_build_array(jsonb_build_object('id',r.id,'version',r.version));
    end if;
  end loop;
  return jsonb_build_object('draft_revision',wk.draft_revision,'published_revision',wk.published_revision,'affected',affected);
end $$;

-- Reduced release: there is no public RPC that cancels impacted appointments.
-- The owner must resolve each reservation through permitted booking operations.
create or replace function public.publish_schedule_week(p_week date,p_expected_revision integer)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare wk public.schedule_weeks%rowtype; impact jsonb;
begin
  if not app_private.is_admin() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
  perform app_private.require_booking_session();
  perform app_private.lock_booking_resource();
  perform app_private.require_booking_session();
  if not app_private.is_admin() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
  -- Use P0001 business conflict, not 40001: PostgREST may retry serialization failures.
  select * into wk from public.schedule_weeks where week_start=p_week for update;
  if not found or wk.draft_revision is distinct from p_expected_revision then raise exception 'SCHEDULE_CHANGED' using errcode='P0001'; end if;
  perform app_private.validate_published_neighbors(p_week,wk.draft,wk.travel_gap_minutes);
  impact:=app_private.schedule_impact(p_week);
  if jsonb_array_length(impact->'affected')>0 then
    raise exception 'SCHEDULE_RESERVATION_CONFLICT' using errcode='P0001';
  end if;
  update public.schedule_weeks set published=draft,published_gap_minutes=travel_gap_minutes,
    published_revision=published_revision+1,published_at=clock_timestamp() where week_start=p_week;
  insert into public.booking_audit(actor_id,action,details) values(auth.uid(),'schedule_published',
    jsonb_build_object('week',p_week,'impact',impact));
  return wk.published_revision+1;
end $$;

create or replace function public.save_schedule_draft(p_week date,p_expected_revision integer,p_entries jsonb,p_gap integer)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare wk public.schedule_weeks%rowtype;
begin
  if not app_private.is_admin() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
  if not app_private.validate_schedule(p_week,p_entries,p_gap) then raise exception 'INVALID_SCHEDULE' using errcode='22023'; end if;
  select * into wk from public.schedule_weeks where week_start=p_week for update;
  if not found or wk.draft_revision is distinct from p_expected_revision then raise exception 'SCHEDULE_CHANGED' using errcode='P0001'; end if;
  update public.schedule_weeks set draft=p_entries,travel_gap_minutes=p_gap,draft_revision=draft_revision+1 where week_start=p_week;
  return wk.draft_revision+1;
end $$;

-- No direct browser writes, internal helper execution, guest creation or role assignment.
revoke all on function app_private.lock_booking_resource(),app_private.local_boundary(date,integer,boolean),
  app_private.require_booking_session(),app_private.booking_time_valid(timestamptz,timestamptz),app_private.cancellation_time_valid(timestamptz,timestamptz),
  app_private.work_periods(jsonb,date,uuid),app_private.week_of(timestamptz),app_private.guard_reservation_overlap(),
  app_private.booking_result(uuid),app_private.booking_event(uuid,text,text),
  app_private.validate_published_neighbors(date,jsonb,integer),app_private.schedule_impact(date) from public,anon,authenticated;
revoke all on function public.confirm_reservation(uuid,uuid,uuid,timestamptz,integer,text),public.cancel_reservation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.confirm_reservation(uuid,uuid,uuid,timestamptz,integer,text),public.cancel_reservation(uuid,uuid) to authenticated;
comment on table public.reservations is 'Phase 7 customer reservations and reserved guest representation. Browser writes only through controlled RPCs; linked phone stays in profiles.';
commit;
