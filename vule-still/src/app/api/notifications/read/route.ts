import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { bookingHeaders, bookingError, readBookingBody, sameOrigin } from "@/lib/booking-http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Zahtev nije dozvoljen." }, { status: 403, headers: bookingHeaders });
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    let input;
    try { input = await readBookingBody(request) as { notification?: unknown }; } catch { return bookingError("INVALID_INPUT"); }
    if (!input || typeof input.notification !== "string" || !/^[0-9a-f-]{36}$/i.test(input.notification)) return bookingError("INVALID_INPUT");
    const db = await createClient();
    const { data, error } = await db.rpc("mark_booking_notification_read", { p_notification: input.notification });
    if (error) return bookingError(error.message);
    return Response.json({ read_at: data }, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
