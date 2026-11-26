import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeading } from "@/components/site-shell";
import { Icon } from "@/components/icon";
import { createClient } from "@/lib/supabase/server";
import { Appointments, type AppointmentsState } from "./appointments";
import { GuestSessionNote } from "@/components/guest-session-note";
export const metadata: Metadata = { title: "Moji termini | Vule Still", robots: { index: false, follow: false } };
async function AppointmentsContent() {
  const user = await getCurrentUser();
  if (user) {
    const db = await createClient();
    const [profile, appointments] = await Promise.all([
      db.from("profiles").select("phone,contact_email").eq("id", user.id).maybeSingle(), db.rpc("get_my_appointments"),
    ]);
    if (profile.error || appointments.error || !appointments.data) throw new Error("Termini trenutno nisu dostupni. Pokušaj ponovo.");
    return <><Appointments userId={user.id} contact={profile.data?.phone ?? profile.data?.contact_email ?? null} initialData={appointments.data as unknown as AppointmentsState} />{user.is_anonymous && <GuestSessionNote />}</>;
  }
  return <div className="empty-state"><Icon name="calendar" /><h2>Tvoji termini te čekaju</h2><p>Za nastavak unesi telefon ili mejl, bez lozinke i kodova.</p><Link href="/prijava?next=%2Fmoji-termini" prefetch={false} className="button">Prijavi se<Icon name="arrow" /></Link><GuestSessionNote /></div>;
}
export default function AppointmentsPage() {
  return <main id="main" className="container account-main"><PageHeading label="TVOJ NALOG" description="Sve tvoje rezervacije na jednom mestu.">Moji <em>termini.</em></PageHeading><Suspense fallback={<div className="empty-state" role="status">Proveravamo prijavu…</div>}><AppointmentsContent /></Suspense></main>;
}
