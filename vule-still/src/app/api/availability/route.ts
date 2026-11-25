import { createClient } from "@supabase/supabase-js";
import { calculateAvailability, isCalendarDate, type AvailabilityContext } from "@/lib/availability";
import { getSupabaseEnvironment } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";
import { parseServiceIds } from "@/lib/booking";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const date = query.get("date") ?? "", location = query.get("location") ?? "", service = query.get("service") ?? "";
  const services = query.has("services") ? parseServiceIds(query.getAll("services")) : null;
  if (!isCalendarDate(date) || !uuid.test(location) || (query.has("services") ? !services || query.has("service") : !uuid.test(service) || query.getAll("service").length !== 1)) {
    return Response.json({ error: "Izaberi ispravan datum, lokaciju i uslugu." }, { status: 400, headers });
  }
  try {
    const { url, publishableKey } = getSupabaseEnvironment();
    const db = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = services
      ? await db.rpc("services_availability_context", { p_date: date, p_location: location, p_services: services })
      : await db.rpc("availability_context", { p_date: date, p_location: location, p_service: service });
    if (error || !data) throw new Error("Availability source unavailable");
    const result = calculateAvailability(date, location, data as unknown as AvailabilityContext);
    if (result.reason === "invalid_schedule") throw new Error("Invalid schedule boundary");
    return Response.json(result, { headers });
  } catch {
    return Response.json({ error: "Slobodni termini trenutno nisu dostupni. Pokušaj ponovo." }, { status: 503, headers });
  }
}
