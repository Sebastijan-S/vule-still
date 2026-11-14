import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OwnerDenied } from "@/components/owner-shell";
import { PageHeading } from "@/components/site-shell";
import { businessDate } from "@/lib/appointment-display";
import { OwnerAppointments, type OwnerState } from "./owner-appointments";
export const metadata = { title: "Administracija | Vule Still", robots: { index: false, follow: false } };
async function Content() {
  const user = await requireUser("/administracija"), db = await createClient();
  const membership = await db.from("admin_memberships").select("user_id").eq("user_id", user.id).maybeSingle();
  if (membership.error) throw new Error("Provera vlasničkog pristupa trenutno nije dostupna.");
  if (!membership.data) return <OwnerDenied />;
  const today = businessDate(new Date().toISOString());
  const [locations, services, appointments] = await Promise.all([
    db.from("locations").select("id,name").eq("is_active", true).order("sort_order"),
    db.from("services").select("id,name,duration_minutes").eq("is_active", true).order("sort_order"),
    db.rpc("get_owner_reservations", { p_from: today, p_to: today }),
  ]);
  if (locations.error || services.error || appointments.error || !appointments.data) throw new Error("Administracija trenutno nije dostupna.");
  return <OwnerAppointments userId={user.id} today={today} locations={locations.data ?? []} services={services.data ?? []} initialData={appointments.data as unknown as OwnerState} />;
}
export default function OwnerPage() {
  return <main id="main" className="container account-main"><PageHeading label="VLASNIK" description="Pregled termina i svakodnevno upravljanje za jednog frizera na obe lokacije.">Pregled <em>rezervacija.</em></PageHeading><Suspense fallback={<p role="status">Učitavamo administraciju…</p>}><Content /></Suspense></main>;
}
