import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseOwnerMutation } from "@/lib/owner-booking";
import { isCalendarDate } from "@/lib/availability";
import { bookingHeaders, bookingError, readBookingBody, sameOrigin } from "@/lib/booking-http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Zahtev nije dozvoljen." }, { status: 403, headers: bookingHeaders });
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    let input;
    try { input = parseOwnerMutation(await readBookingBody(request)); } catch { return bookingError("INVALID_INPUT"); }
    if (!input) return bookingError("INVALID_INPUT");
    const db = await createClient();
    const result = input.operation === "cancel"
      ? await db.rpc("owner_cancel_reservation", { p_request_key: input.request_key, p_reservation: input.reservation })
      : input.operation === "create"
        ? await db.rpc("owner_create_reservation", { p_request_key: input.request_key, p_location: input.location, p_service: input.service, p_start: input.start, p_expected_revision: input.schedule_revision, p_name: input.name, p_expected_name: input.expected_service_name, p_expected_duration: input.expected_duration, ...(input.phone ? { p_phone: input.phone } : {}) })
        : await db.rpc("owner_update_reservation", { p_request_key: input.request_key, p_reservation: input.reservation, p_expected_version: input.version, p_location: input.location, p_start: input.start, p_expected_revision: input.schedule_revision, p_name: input.name, ...(input.phone ? { p_phone: input.phone } : {}) });
    if (result.error || !result.data) return bookingError(result.error?.message ?? "UNAVAILABLE");
    return Response.json({ reservation: result.data }, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
export async function GET(request: Request) {
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    const params = new URL(request.url).searchParams, from = params.get("from") ?? "", to = params.get("to") ?? "";
    if (!isCalendarDate(from) || !isCalendarDate(to)) return bookingError("INVALID_INPUT");
    const db = await createClient(), { data, error } = await db.rpc("get_owner_reservations", { p_from: from, p_to: to });
    if (error || !data) return bookingError(error?.message ?? "UNAVAILABLE");
    return Response.json(data, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
