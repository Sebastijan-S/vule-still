-- Phase 10: narrow owner operations; no exceptional/bulk cancellation.
begin;
create function app_private.require_booking_owner() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_booking_session();
  if not app_private.is_admin() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
end $$;

create function app_private.assert_owner_slot(p_location uuid,p_start timestamptz,p_duration integer,p_revision integer,p_ignore uuid default null)
returns uuid language plpgsql volatile set search_path='' as $$
declare resource uuid; wk public.schedule_weeks%rowtype; periods tstzmultirange; busy record; gap integer;
  period tstzrange; valid_start boolean:=false; unchanged boolean; finish timestamptz; day date;
begin
  resource:=app_private.lock_booking_resource();
  if p_location is null or p_start is null or p_duration is null or p_duration<=0 or p_duration%10<>0
    or p_revision is null or p_revision<1 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  perform 1 from public.locations where id=p_location and is_active for share;
  if not found then raise exception 'INACTIVE_LOCATION' using errcode='22023'; end if;
  select * into wk from public.schedule_weeks where week_start=app_private.week_of(p_start) for update;
  if not found or wk.published is null then raise exception 'UNPUBLISHED' using errcode='P0001'; end if;
  if wk.published_revision<>p_revision then raise exception 'SCHEDULE_CHANGED' using errcode='P0001'; end if;
  if not app_private.booking_time_valid(p_start,clock_timestamp()) then raise exception 'TIME_BOUNDARY' using errcode='22023'; end if;
  finish:=p_start+make_interval(mins=>p_duration);day:=(p_start at time zone 'Europe/Belgrade')::date;
  periods:=app_private.work_periods(wk.published,day,p_location);
  for busy in select r.*,w.published_gap_minutes as other_gap from public.reservations r
    left join public.schedule_weeks w on w.week_start=app_private.week_of(r.starts_at)
    where r.status='confirmed' and r.id is distinct from p_ignore loop
    gap:=case when busy.location_id=p_location then 0 else greatest(wk.published_gap_minutes,coalesce(busy.other_gap,60)) end;
    periods:=periods-tstzmultirange(tstzrange(busy.starts_at-make_interval(mins=>gap),busy.ends_at+make_interval(mins=>gap),'[)'));
  end loop;
  -- A name/contact-only edit must not lose an existing start because a neighbor
  -- was cancelled and the advisory free-period grid was reseeded.
  unchanged:=exists(select 1 from public.reservations where id=p_ignore and location_id=p_location and starts_at=p_start and ends_at=finish);
  for period in select unnest(periods) loop
    if p_start>=lower(period) and finish<=upper(period)
      and (unchanged or mod(extract(epoch from(p_start-lower(period)))::numeric,p_duration::numeric*60)=0) then valid_start:=true; end if;
  end loop;
  if not valid_start then raise exception 'SLOT_TAKEN' using errcode='23P01'; end if;
  return resource;
end $$;

create function public.owner_create_reservation(p_request_key uuid,p_location uuid,p_service uuid,p_start timestamptz,
  p_expected_revision integer,p_name text,p_expected_name text,p_expected_duration integer,p_phone text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare prior public.booking_mutation_keys%rowtype; payload jsonb; result jsonb; svc public.services%rowtype; resource uuid; reservation uuid;
begin
  perform app_private.require_booking_owner();perform app_private.lock_booking_resource();perform app_private.require_booking_owner();
  if p_request_key is null or nullif(btrim(p_name),'') is null or char_length(btrim(p_name))>120
    or p_name ~ '[[:cntrl:]]' or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{1,14}$')
    then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  payload:=jsonb_build_object('operation','owner-create','location',p_location,'service',p_service,'start',p_start,
    'revision',p_expected_revision,'name',btrim(p_name),'phone',p_phone,'expected_name',p_expected_name,'expected_duration',p_expected_duration);
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if; return prior.result;
  end if;
  select * into svc from public.services where id=p_service and is_active for share;
  if not found then raise exception 'INACTIVE_SERVICE' using errcode='22023'; end if;
  if svc.name is distinct from p_expected_name or svc.duration_minutes is distinct from p_expected_duration then raise exception 'SERVICE_CHANGED' using errcode='P0001'; end if;
  resource:=app_private.assert_owner_slot(p_location,p_start,svc.duration_minutes,p_expected_revision);
  insert into public.reservations(staff_id,location_id,guest_name,guest_phone,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at)
    values(resource,p_location,btrim(p_name),p_phone,btrim(p_name),svc.id,svc.name,svc.duration_minutes,p_start,p_start+make_interval(mins=>svc.duration_minutes)) returning id into reservation;
  perform app_private.booking_event(reservation,'confirmed','Vlasnik je uneo ručnu rezervaciju.');
  result:=app_private.booking_result(reservation);
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);
  return result;
end $$;

create function public.owner_update_reservation(p_request_key uuid,p_reservation uuid,p_expected_version integer,p_location uuid,
  p_start timestamptz,p_expected_revision integer,p_name text,p_phone text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare prior public.booking_mutation_keys%rowtype; payload jsonb; result jsonb; r public.reservations%rowtype; before_row jsonb; message text;
begin
  perform app_private.require_booking_owner();perform app_private.lock_booking_resource();perform app_private.require_booking_owner();
  if p_request_key is null or p_reservation is null or p_expected_version is null or p_expected_version<1
    or nullif(btrim(p_name),'') is null or char_length(btrim(p_name))>120 or p_name ~ '[[:cntrl:]]'
    or (p_phone is not null and p_phone !~ '^\+[1-9][0-9]{1,14}$') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  payload:=jsonb_build_object('operation','owner-update','reservation',p_reservation,'version',p_expected_version,
    'location',p_location,'start',p_start,'revision',p_expected_revision,'name',btrim(p_name),'phone',p_phone);
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if; return prior.result;
  end if;
  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002'; end if;
  if r.version<>p_expected_version then raise exception 'RESERVATION_CHANGED' using errcode='P0001'; end if;
  if r.status<>'confirmed' then raise exception 'RESERVATION_CLOSED' using errcode='P0001'; end if;
  -- Conservative reduced release: moving also releases the old appointment.
  -- Do not turn a late move into a hidden late-cancellation exception.
  if not app_private.cancellation_time_valid(r.starts_at,clock_timestamp()) then raise exception 'EDIT_TOO_LATE' using errcode='22023'; end if;
  if r.user_id is not null and p_phone is not null then raise exception 'LINKED_PROFILE_CONTACT' using errcode='22023'; end if;
  perform app_private.assert_owner_slot(p_location,p_start,r.duration_minutes,p_expected_revision,r.id);
  before_row:=to_jsonb(r);
  message:='Rezervacija je izmenjena: '||to_char(r.starts_at at time zone 'Europe/Belgrade','DD.MM.YYYY. HH24:MI')||' ('||(select name from public.locations where id=r.location_id)||') → '
    ||to_char(p_start at time zone 'Europe/Belgrade','DD.MM.YYYY. HH24:MI')||' ('||(select name from public.locations where id=p_location)||'). Osoba: '||btrim(p_name)||'.';
  update public.reservations set location_id=p_location,starts_at=p_start,ends_at=p_start+make_interval(mins=>r.duration_minutes),
    attendee_name=btrim(p_name),guest_name=case when r.user_id is null then btrim(p_name) else null end,
    guest_phone=case when r.user_id is null then p_phone else null end,version=version+1 where id=r.id;
  result:=app_private.booking_result(r.id);
  insert into public.booking_audit(actor_id,reservation_id,action,details) values(auth.uid(),r.id,'changed',jsonb_build_object('before',before_row,'after',result,'message',message));
  if r.user_id is not null then insert into public.booking_notifications(user_id,reservation_id,kind,message) values(r.user_id,r.id,'changed',message); end if;
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);
  return result;
end $$;

create function public.owner_cancel_reservation(p_request_key uuid,p_reservation uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare prior public.booking_mutation_keys%rowtype; payload jsonb; result jsonb; r public.reservations%rowtype; clock_now timestamptz;
begin
  perform app_private.require_booking_owner();perform app_private.lock_booking_resource();perform app_private.require_booking_owner();
  if p_request_key is null or p_reservation is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  payload:=jsonb_build_object('operation','owner-cancel','reservation',p_reservation);
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if; return prior.result;
  end if;
  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002'; end if;
  clock_now:=clock_timestamp();
  if r.status='confirmed' then
    if not app_private.cancellation_time_valid(r.starts_at,clock_now) then raise exception 'CANCELLATION_TOO_LATE' using errcode='22023'; end if;
    update public.reservations set status='cancelled',cancelled_at=clock_now,cancellation_reason='Vlasnik je otkazao rezervaciju.',version=version+1 where id=r.id;
    perform app_private.booking_event(r.id,'cancelled','Vlasnik je otkazao rezervaciju.');
  end if;
  result:=app_private.booking_result(r.id);
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);return result;
end $$;

create function public.get_owner_reservations(p_from date,p_to date,p_location uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare appointments jsonb;
begin
  perform app_private.require_booking_owner();
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select coalesce(jsonb_agg(app_private.booking_result(r.id)||jsonb_build_object('location_name',l.name,'user_id',r.user_id,
    'phone',case when r.user_id is null then r.guest_phone else p.phone end,'email',u.email,'cancellation_reason',r.cancellation_reason) order by r.starts_at),'[]')
  into appointments from public.reservations r join public.locations l on l.id=r.location_id left join public.profiles p on p.id=r.user_id left join auth.users u on u.id=r.user_id
  where r.starts_at>=(p_from::timestamp at time zone 'Europe/Belgrade') and r.starts_at<((p_to+1)::timestamp at time zone 'Europe/Belgrade')
    and (p_location is null or r.location_id=p_location);
  return jsonb_build_object('server_time',statement_timestamp(),'reservations',appointments);
end $$;

create function public.owner_reservation_context(p_date date,p_location uuid,p_reservation uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.reservations%rowtype; wk jsonb; busy jsonb; gap integer; clock_now timestamptz:=statement_timestamp(); today date:=(clock_now at time zone 'Europe/Belgrade')::date;
begin
  perform app_private.require_booking_owner();
  select * into r from public.reservations where id=p_reservation;
  if not found then raise exception 'RESERVATION_NOT_FOUND' using errcode='P0002'; end if;
  if r.status<>'confirmed' then raise exception 'RESERVATION_CLOSED' using errcode='P0001'; end if;
  if p_date is null or p_location is null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if p_date<today or p_date>today+14 then return jsonb_build_object('reason','outside_horizon','server_time',clock_now); end if;
  if not exists(select 1 from public.locations where id=p_location and is_active) then return jsonb_build_object('reason','inactive_location','server_time',clock_now); end if;
  wk:=public.published_schedule(p_date-(extract(isodow from p_date)::integer-1));gap:=coalesce((wk->>'travel_gap_minutes')::integer,60);
  select coalesce(jsonb_agg(jsonb_build_object('start',b.starts_at,'end',b.ends_at,'location_id',b.location_id,
    'travel_gap_minutes',greatest(gap,coalesce(w.published_gap_minutes,60))) order by b.starts_at),'[]') into busy
  from public.reservations b left join public.schedule_weeks w on w.week_start=app_private.week_of(b.starts_at)
  where b.id<>r.id and b.status='confirmed'
    and b.starts_at<((p_date+1)::timestamp at time zone 'Europe/Belgrade')+make_interval(mins=>greatest(gap,coalesce(w.published_gap_minutes,60)))
    and b.ends_at>(p_date::timestamp at time zone 'Europe/Belgrade')-make_interval(mins=>greatest(gap,coalesce(w.published_gap_minutes,60)));
  return jsonb_build_object('server_time',clock_now,'service',jsonb_build_object('minutes',r.duration_minutes,'active',true),
    'week',wk,'occupied',busy,'original',jsonb_build_object('start',r.starts_at,'end',r.ends_at,'location_id',r.location_id));
end $$;
revoke all on function app_private.require_booking_owner(),app_private.assert_owner_slot(uuid,timestamptz,integer,integer,uuid) from public,anon,authenticated;
revoke all on function public.owner_create_reservation(uuid,uuid,uuid,timestamptz,integer,text,text,integer,text),
  public.owner_update_reservation(uuid,uuid,integer,uuid,timestamptz,integer,text,text),public.owner_cancel_reservation(uuid,uuid),
  public.get_owner_reservations(date,date,uuid),public.owner_reservation_context(date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.owner_create_reservation(uuid,uuid,uuid,timestamptz,integer,text,text,integer,text),
  public.owner_update_reservation(uuid,uuid,integer,uuid,timestamptz,integer,text,text),public.owner_cancel_reservation(uuid,uuid),
  public.get_owner_reservations(date,date,uuid),public.owner_reservation_context(date,uuid,uuid) to authenticated;
commit;
