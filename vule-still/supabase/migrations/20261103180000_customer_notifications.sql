-- Phases 8/9: private appointment read model and narrow read acknowledgement.
begin;
create function public.get_my_appointments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare appointments jsonb; notices jsonb;
begin
  perform app_private.require_booking_session();
  select coalesce(jsonb_agg(app_private.booking_result(r.id)||jsonb_build_object(
    'location_name',l.name,'cancellation_reason',r.cancellation_reason) order by r.starts_at desc),'[]')
    into appointments from public.reservations r join public.locations l on l.id=r.location_id where r.user_id=auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'reservation_id',n.reservation_id,'kind',n.kind,
    'message',n.message,'created_at',n.created_at,'read_at',n.read_at) order by n.created_at desc),'[]')
    into notices from public.booking_notifications n where n.user_id=auth.uid();
  return jsonb_build_object('server_time',statement_timestamp(),'reservations',appointments,'notifications',notices);
end $$;
create function public.mark_booking_notification_read(p_notification uuid) returns timestamptz
language plpgsql volatile security definer set search_path='' as $$
declare marked timestamptz;
begin
  perform app_private.require_booking_session();
  update public.booking_notifications set read_at=coalesce(read_at,clock_timestamp())
    where id=p_notification and user_id=auth.uid() returning read_at into marked;
  if not found then raise exception 'NOTIFICATION_NOT_FOUND' using errcode='P0002'; end if;
  return marked;
end $$;
revoke all on function public.get_my_appointments(),public.mark_booking_notification_read(uuid) from public,anon,authenticated;
grant execute on function public.get_my_appointments(),public.mark_booking_notification_read(uuid) to authenticated;
-- Event-trigger helper is not an application RPC. Preserve its event behavior.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public,anon,authenticated';
  end if;
end $$;
create index schedule_templates_location_idx on public.schedule_templates(location_id);
commit;
