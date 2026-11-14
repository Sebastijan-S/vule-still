import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseCancellation } from "@/lib/booking";
import { bookingHeaders, bookingError, readBookingBody, sameOrigin } from "@/lib/booking-http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Zahtev nije dozvoljen." }, { status: 403, headers: bookingHeaders });
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    let input;
    try { input = parseCancellation(await readBookingBody(request)); } catch { return bookingError("INVALID_INPUT"); }
    if (!input) return bookingError("INVALID_INPUT");
    const db = await createClient();
    const { data, error } = await db.rpc("cancel_reservation", { p_request_key: input.request_key, p_reservation: input.reservation });
    if (error || !data) return bookingError(error?.message ?? "UNAVAILABLE");
    return Response.json({ reservation: data }, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
