import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseConfirmation } from "@/lib/booking";
import { bookingHeaders, bookingError, readBookingBody, sameOrigin } from "@/lib/booking-http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Zahtev nije dozvoljen." }, { status: 403, headers: bookingHeaders });
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    let input;
    try { input = parseConfirmation(await readBookingBody(request)); } catch { return bookingError("INVALID_INPUT"); }
    if (!input) return bookingError("INVALID_INPUT");
    const db = await createClient();
    const { data, error } = await db.rpc("confirm_reviewed_reservation", {
      p_request_key: input.request_key, p_location: input.location, p_service: input.service,
      p_start: input.start, p_expected_revision: input.schedule_revision,
      p_expected_name: input.expected_service_name, p_expected_duration: input.expected_duration,
      ...(input.attendee_name ? { p_attendee: input.attendee_name } : {}),
    });
    if (error || !data) return bookingError(error?.message ?? "UNAVAILABLE");
    return Response.json({ reservation: data }, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}

export async function GET() {
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    const db = await createClient();
    const { data, error } = await db.rpc("get_my_appointments");
    if (error || !data) return bookingError(error?.message ?? "UNAVAILABLE");
    return Response.json(data, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
