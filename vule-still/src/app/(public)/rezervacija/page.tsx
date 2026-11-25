import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { profileComplete } from "@/lib/auth/validation";
import { PageHeading } from "@/components/site-shell";
import { BookingForm } from "./booking-form";
export const metadata = { title: "Rezervacija | Vule Still", robots: { index: false, follow: false } };
async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const params = await searchParams, user = await getCurrentUser(), db = await createClient();
  const [locations, services, profile] = await Promise.all([
    db.from("locations").select("id,slug,name").eq("is_active", true).eq("booking_enabled", true).order("sort_order"),
    db.from("services").select("id,slug,name,duration_minutes,category").eq("is_active", true).order("sort_order"),
    user ? db.from("profiles").select("first_name,last_name,phone,contact_email").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (locations.error || services.error || profile.error) throw new Error("Podaci za zakazivanje trenutno nisu dostupni.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <BookingForm locations={locations.data ?? []} services={services.data ?? []} user={user ? { id: user.id, email: profile.data?.phone ?? profile.data?.contact_email ?? user.email ?? "", name: [profile.data?.first_name, profile.data?.last_name].filter(Boolean).join(" "), complete: profileComplete(profile.data) } : null} today={today} initial={{ resume: params.nastavi === "1", location: typeof params.lokacija === "string" ? params.lokacija : undefined, service: typeof params.usluga === "string" ? params.usluga : undefined }} />;
}
export default function BookingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <main id="main" className="container account-main"><PageHeading label="REZERVACIJE" description="Rezervacije za Neuzin. Zrenjanin rezervacije uskoro. Vreme prikazujemo po vremenu Srbije.">Rezerviši <em>termin.</em></PageHeading><Suspense fallback={<p role="status">Učitavamo zakazivanje…</p>}><Content searchParams={searchParams} /></Suspense></main>;
}
