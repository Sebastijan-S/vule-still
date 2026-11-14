-- Confirm exactly the service snapshot shown in the customer's final review.
-- The existing transaction and durable idempotency result remain authoritative.
begin;
create function public.confirm_reviewed_reservation(p_request_key uuid,p_location uuid,p_service uuid,
  p_start timestamptz,p_expected_revision integer,p_expected_name text,p_expected_duration integer,p_attendee text default null)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
  if nullif(btrim(p_expected_name),'') is null or p_expected_duration is null
    or p_expected_duration<=0 or p_expected_duration%10<>0 then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  result:=public.confirm_reservation(p_request_key,p_location,p_service,p_start,p_expected_revision,p_attendee);
  if result->>'service_name' is distinct from p_expected_name
    or (result->>'duration_minutes')::integer is distinct from p_expected_duration then
    -- Rolls the entire inner transaction (reservation, events and key) back.
    raise exception 'SERVICE_CHANGED' using errcode='P0001';
  end if;
  return result;
end $$;
revoke all on function public.confirm_reviewed_reservation(uuid,uuid,uuid,timestamptz,integer,text,integer,text) from public,anon,authenticated;
grant execute on function public.confirm_reviewed_reservation(uuid,uuid,uuid,timestamptz,integer,text,integer,text) to authenticated;
commit;
