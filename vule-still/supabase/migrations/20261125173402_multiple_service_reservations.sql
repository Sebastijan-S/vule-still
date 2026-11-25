-- UI step 2: additive visit items; legacy scalar RPCs keep their payloads/keys.
-- Keep this schema when rolling the UI back. Never discard visit history.
begin;
alter table public.reservations add column service_count integer not null default 1 check (service_count>0);
create table public.reservation_items (
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  position integer not null check (position>0),
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null check (nullif(btrim(service_name),'') is not null),
  duration_minutes integer not null check (duration_minutes>0 and duration_minutes%10=0),
  primary key (reservation_id,position),
  unique (reservation_id,service_id)
);
create index reservation_items_service_idx on public.reservation_items(service_id);
alter table public.reservation_items enable row level security;
revoke all on public.reservation_items from public,anon,authenticated;
grant all on public.reservation_items to service_role;
grant select on public.reservation_items to authenticated;
create policy reservation_items_read_own on public.reservation_items for select to authenticated
using ((select app_private.session_permitted()) and exists (
  select 1 from public.reservations r where r.id=reservation_id and r.user_id=(select auth.uid())
));

-- Backfill ONLY the original saved values, including cancelled/inactive services.
insert into public.reservation_items(reservation_id,position,service_id,service_name,duration_minutes)
select id,1,service_id,service_name,duration_minutes from public.reservations;

-- Preserve trusted/legacy single-service inserts without changing their RPCs.
create function app_private.initialize_reservation_item() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.service_count=1 then
    insert into public.reservation_items(reservation_id,position,service_id,service_name,duration_minutes)
      values(new.id,1,new.service_id,new.service_name,new.duration_minutes);
  end if;
  return new;
end $$;
create trigger reservation_item_initialize after insert on public.reservations
for each row execute function app_private.initialize_reservation_item();

create function app_private.guard_reservation_items() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='reservations' then
    if new.service_count=old.service_count then return new; end if;
  end if;
  raise exception 'IMMUTABLE_SERVICE_SNAPSHOT' using errcode='22023';
end $$;
create trigger reservation_item_count_immutable before update on public.reservations
for each row execute function app_private.guard_reservation_items();
create trigger reservation_items_immutable before update or delete on public.reservation_items
for each row execute function app_private.guard_reservation_items();

-- Deferred integrity allows parent + items in one transaction, but never a partial visit.
create function app_private.validate_reservation_items() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent public.reservations%rowtype; target uuid; item_count integer; total bigint;
  first_id uuid; names text; last_position integer;
begin
  if tg_table_name='reservations' then target:=new.id; else target:=new.reservation_id; end if;
  select * into parent from public.reservations where id=target;
  if not found then return null; end if;
  select count(*),sum(duration_minutes),string_agg(service_name,' + ' order by position),max(position)
    into item_count,total,names,last_position from public.reservation_items where reservation_id=target;
  select service_id into first_id from public.reservation_items where reservation_id=target and position=1;
  if item_count<>parent.service_count or last_position<>item_count or total is distinct from parent.duration_minutes::bigint
    or names is distinct from parent.service_name or first_id is distinct from parent.service_id then
    raise exception 'INVALID_RESERVATION_ITEMS' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger reservation_items_parent_valid after insert or update on public.reservations
deferrable initially deferred for each row execute function app_private.validate_reservation_items();
create constraint trigger reservation_items_children_valid after insert on public.reservation_items
deferrable initially deferred for each row execute function app_private.validate_reservation_items();

create or replace function app_private.booking_result(p_id uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',id,'status',status,'location_id',location_id,'service_id',service_id,
    'service_name',service_name,'duration_minutes',duration_minutes,'starts_at',starts_at,
    'ends_at',ends_at,'attendee_name',attendee_name,'version',version,'service_count',service_count,
    'items',coalesce((select jsonb_agg(jsonb_build_object('service_id',i.service_id,'service_name',i.service_name,
      'duration_minutes',i.duration_minutes,'position',i.position) order by i.position)
      from public.reservation_items i where i.reservation_id=r.id),'[]'::jsonb))
  from public.reservations r where id=p_id;
$$;

create function app_private.canonical_service_ids(p_services uuid[]) returns uuid[]
language plpgsql immutable set search_path='' as $$
declare canonical uuid[];
begin
  if p_services is null or coalesce(array_ndims(p_services),0)<>1 or cardinality(p_services)=0
    or array_position(p_services,null) is not null then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select array_agg(distinct s order by s) into canonical from unnest(p_services) s;
  if cardinality(canonical)<>cardinality(p_services) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  return canonical;
end $$;

-- Expected snapshots are canonicalized without consulting today's catalogue.
-- Thus a retry can resolve its key even after withdrawal, renaming or reordering.
create function app_private.reviewed_service_items(p_services uuid[],p_items jsonb,p_total integer) returns jsonb
language plpgsql immutable set search_path='' as $$
declare ids uuid[]:=app_private.canonical_service_ids(p_services); expected_ids uuid[]; result jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if jsonb_array_length(p_items)<>cardinality(ids) or p_total is null or p_total<=0 or p_total%10<>0 then
    raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e) is distinct from 'object'
    or jsonb_typeof(e->'service_id') is distinct from 'string'
    or jsonb_typeof(e->'service_name') is distinct from 'string' or nullif(btrim(e->>'service_name'),'') is null
    or jsonb_typeof(e->'duration_minutes') is distinct from 'number'
    or (e->>'duration_minutes')!~'^[1-9][0-9]*$') then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select array_agg((e->>'service_id')::uuid order by (e->>'service_id')::uuid),
    jsonb_agg(jsonb_build_object('service_id',(e->>'service_id')::uuid,'service_name',e->>'service_name',
      'duration_minutes',(e->>'duration_minutes')::integer) order by (e->>'service_id')::uuid)
    into expected_ids,result from jsonb_array_elements(p_items) e;
  if expected_ids<>ids or exists(select 1 from jsonb_array_elements(result) e where (e->>'duration_minutes')::integer%10<>0)
    or (select sum((e->>'duration_minutes')::bigint) from jsonb_array_elements(result) e)<>p_total then
    raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  return result;
end $$;

create function app_private.service_selection(p_services uuid[]) returns jsonb
language plpgsql stable set search_path='' as $$
declare ids uuid[]:=app_private.canonical_service_ids(p_services); result jsonb; matches integer; total bigint;
begin
  select count(*),sum(duration_minutes) into matches,total from public.services where id=any(ids) and is_active;
  if matches<>cardinality(ids) then raise exception 'INACTIVE_SERVICE' using errcode='22023'; end if;
  if total>2147483647 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select jsonb_build_object('minutes',total,'active',true,'name',string_agg(name,' + ' order by sort_order,id),
    'items',jsonb_agg(jsonb_build_object('service_id',id,'service_name',name,'duration_minutes',duration_minutes,
      'position',position) order by sort_order,id)) into result
  from (select *,row_number() over(order by sort_order,id) as position from public.services where id=any(ids) and is_active) s;
  return result;
end $$;

create function public.services_availability_context(p_date date,p_location uuid,p_services uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare selection jsonb; context jsonb;
begin
  begin selection:=app_private.service_selection(p_services);
  exception when sqlstate '22023' then
    if sqlerrm<>'INACTIVE_SERVICE' then raise; end if;
    return jsonb_build_object('reason','inactive_service','server_time',statement_timestamp());
  end;
  -- Reuse the exact same horizon/location/week/occupancy contract as a scalar request.
  context:=public.availability_context(p_date,p_location,(selection->'items'->0->>'service_id')::uuid);
  return context||jsonb_build_object('service',selection);
end $$;

-- One internal writer for public + manual multi-service visits. The scalar writers
-- remain intact so pre-migration pending payloads and durable results stay identical.
create function app_private.create_services_reservation(p_request_key uuid,p_location uuid,p_services uuid[],
  p_start timestamptz,p_revision integer,p_items jsonb,p_total integer,p_manual boolean,
  p_attendee text,p_phone text default null) returns jsonb
language plpgsql volatile set search_path='' as $$
declare ids uuid[]:=app_private.canonical_service_ids(p_services); expected jsonb;
  selection jsonb; actual jsonb; payload jsonb; prior public.booking_mutation_keys%rowtype;
  profile public.profiles%rowtype; resource uuid; reservation uuid; attendee text; result jsonb; item jsonb;
begin
  if p_manual then perform app_private.require_booking_owner(); else perform app_private.require_booking_session(); end if;
  if p_request_key is null or p_location is null or p_start is null or p_revision is null or p_revision<1 then
    raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  expected:=app_private.reviewed_service_items(ids,p_items,p_total);
  if p_manual and (nullif(btrim(p_attendee),'') is null or char_length(btrim(p_attendee))>120 or p_attendee~'[[:cntrl:]]'
    or (p_phone is not null and p_phone!~'^\+[1-9][0-9]{1,14}$')) then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  payload:=jsonb_build_object('operation',case when p_manual then 'owner-create-services' else 'confirm-services' end,
    'location',p_location,'services',to_jsonb(ids),'start',p_start,'revision',p_revision,
    'items',expected,'duration',p_total,'attendee',nullif(btrim(p_attendee),''),'phone',p_phone);
  resource:=app_private.lock_booking_resource();
  if p_manual then perform app_private.require_booking_owner(); else perform app_private.require_booking_session(); end if;
  select * into prior from public.booking_mutation_keys where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if prior.payload<>payload then raise exception 'KEY_REUSED' using errcode='22023'; end if;
    return prior.result;
  end if;
  if p_manual then attendee:=btrim(p_attendee);
  else
    select * into strict profile from public.profiles where id=auth.uid() for update;
    if profile.booking_blocked then raise exception 'BOOKING_BLOCKED' using errcode='42501'; end if;
    if profile.first_name is null or profile.last_name is null or (profile.phone is null and profile.contact_email is null) then
      raise exception 'PROFILE_REQUIRED' using errcode='22023'; end if;
    attendee:=coalesce(nullif(btrim(p_attendee),''),profile.first_name||' '||profile.last_name);
    if char_length(attendee)>120 then raise exception 'INVALID_ATTENDEE' using errcode='22023'; end if;
  end if;
  -- Lock catalogue rows in a stable order until all item snapshots are persisted.
  perform 1 from public.services where id=any(ids) order by id for share;
  selection:=app_private.service_selection(ids);
  actual:=app_private.reviewed_service_items(ids,selection->'items',(selection->>'minutes')::integer);
  if actual<>expected or (selection->>'minutes')::integer<>p_total then raise exception 'SERVICE_CHANGED' using errcode='P0001'; end if;
  perform app_private.assert_owner_slot(p_location,p_start,p_total,p_revision);
  insert into public.reservations(staff_id,location_id,user_id,guest_name,guest_phone,attendee_name,
    service_id,service_name,duration_minutes,service_count,starts_at,ends_at)
  values(resource,p_location,case when p_manual then null else auth.uid() end,
    case when p_manual then attendee else null end,case when p_manual then p_phone else null end,attendee,
    (selection->'items'->0->>'service_id')::uuid,selection->>'name',p_total,cardinality(ids),p_start,p_start+make_interval(mins=>p_total))
  returning id into reservation;
  if cardinality(ids)>1 then
    for item in select value from jsonb_array_elements(selection->'items') loop
      insert into public.reservation_items(reservation_id,position,service_id,service_name,duration_minutes)
      values(reservation,(item->>'position')::integer,(item->>'service_id')::uuid,item->>'service_name',(item->>'duration_minutes')::integer);
    end loop;
  end if;
  perform app_private.booking_event(reservation,'confirmed',case when p_manual then 'Vlasnik je uneo ručnu rezervaciju.' else 'Rezervacija je potvrđena.' end);
  result:=app_private.booking_result(reservation);
  insert into public.booking_mutation_keys(user_id,request_key,payload,result) values(auth.uid(),p_request_key,payload,result);
  if not p_manual then update public.account_activity set last_activity_at=clock_timestamp() where user_id=auth.uid(); end if;
  return result;
end $$;

create function public.confirm_services_reservation(p_request_key uuid,p_location uuid,p_services uuid[],p_start timestamptz,
  p_expected_revision integer,p_expected_items jsonb,p_expected_duration integer,p_attendee text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_booking_session();
  return app_private.create_services_reservation(p_request_key,p_location,p_services,p_start,p_expected_revision,
    p_expected_items,p_expected_duration,false,p_attendee,null);
end $$;
create function public.owner_create_services_reservation(p_request_key uuid,p_location uuid,p_services uuid[],p_start timestamptz,
  p_expected_revision integer,p_name text,p_expected_items jsonb,p_expected_duration integer,p_phone text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform app_private.require_booking_owner();
  return app_private.create_services_reservation(p_request_key,p_location,p_services,p_start,p_expected_revision,
    p_expected_items,p_expected_duration,true,p_name,p_phone);
end $$;

create or replace function public.get_my_appointments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare appointments jsonb; notices jsonb;
begin
  perform app_private.require_booking_session();
  select coalesce(jsonb_agg(app_private.booking_result(r.id)||jsonb_build_object(
    'location_name',l.name,'cancellation_reason',r.cancellation_reason) order by r.starts_at desc),'[]')
    into appointments from public.reservations r join public.locations l on l.id=r.location_id where r.user_id=auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'reservation_id',n.reservation_id,'kind',n.kind,
    'message',n.message,'created_at',n.created_at,'read_at',n.read_at,'items',app_private.booking_result(n.reservation_id)->'items',
    'duration_minutes',r.duration_minutes) order by n.created_at desc),'[]') into notices
    from public.booking_notifications n join public.reservations r on r.id=n.reservation_id where n.user_id=auth.uid();
  return jsonb_build_object('server_time',statement_timestamp(),'reservations',appointments,'notifications',notices);
end $$;

revoke all on function app_private.initialize_reservation_item(),app_private.guard_reservation_items(),app_private.validate_reservation_items(),
  app_private.canonical_service_ids(uuid[]),app_private.reviewed_service_items(uuid[],jsonb,integer),app_private.service_selection(uuid[]),
  app_private.create_services_reservation(uuid,uuid,uuid[],timestamptz,integer,jsonb,integer,boolean,text,text) from public,anon,authenticated;
revoke all on function public.services_availability_context(date,uuid,uuid[]),
  public.confirm_services_reservation(uuid,uuid,uuid[],timestamptz,integer,jsonb,integer,text),
  public.owner_create_services_reservation(uuid,uuid,uuid[],timestamptz,integer,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.services_availability_context(date,uuid,uuid[]) to anon,authenticated;
grant execute on function public.confirm_services_reservation(uuid,uuid,uuid[],timestamptz,integer,jsonb,integer,text),
  public.owner_create_services_reservation(uuid,uuid,uuid[],timestamptz,integer,text,jsonb,integer,text) to authenticated;
comment on column public.reservations.service_id is 'Legacy representative: first saved visit item; never use to calculate visit duration.';
comment on column public.reservations.service_name is 'Saved visit label; joined item names for multiple services. Items retain individual snapshots.';
commit;
