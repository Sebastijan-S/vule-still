import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calculateAvailability, isCalendarDate, businessOffsetMinutes, type AvailabilityContext } from "@/lib/availability";
import { timeLabel } from "@/lib/appointment-display";
import { bookingHeaders, bookingError } from "@/lib/booking-http";
export async function GET(request: Request) {
  try {
    if (!await getCurrentUser()) return bookingError("SESSION_REQUIRED");
    const params = new URL(request.url).searchParams, date = params.get("date") ?? "", location = params.get("location") ?? "", reservation = params.get("reservation") ?? "";
    if (!isCalendarDate(date) || !/^[0-9a-f-]{36}$/i.test(location) || !/^[0-9a-f-]{36}$/i.test(reservation)) return bookingError("INVALID_INPUT");
    const db = await createClient(), { data, error } = await db.rpc("owner_reservation_context", { p_date: date, p_location: location, p_reservation: reservation });
    if (error || !data) return bookingError(error?.message ?? "UNAVAILABLE");
    const context = data as unknown as AvailabilityContext & { original?: { start: string; end: string; location_id: string } };
    const result = calculateAvailability(date, location, context);
    if (result.reason === "invalid_schedule") return bookingError("UNAVAILABLE");
    const original = context.original;
    // Preserve an unchanged confirmed start after neighboring cancellations
    // reseed the advisory grid. The mutation still checks the full interval.
    if (original && context.week && original.location_id === location
      && new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date(original.start)) === date
      && Date.parse(original.start) >= Date.parse(context.server_time) + 30 * 60000
      && !result.slots.some(s => s.start === new Date(original.start).toISOString())) {
      result.slots.push({ start: new Date(original.start).toISOString(), end: new Date(original.end).toISOString(), local_start: timeLabel(original.start), utc_offset_minutes: businessOffsetMinutes(original.start) });
      result.slots.sort((a, b) => a.start.localeCompare(b.start)); result.reason = "available";
    }
    return Response.json(result, { headers: bookingHeaders });
  } catch { return bookingError("UNAVAILABLE"); }
}
