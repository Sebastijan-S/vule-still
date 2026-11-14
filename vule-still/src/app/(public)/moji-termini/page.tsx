import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeading } from "@/components/site-shell";
import { Icon } from "@/components/icon";
import { passwordTestMode } from "@/lib/auth/mode";
import { createClient } from "@/lib/supabase/server";
import { Appointments, type AppointmentsState } from "./appointments";
export const metadata: Metadata = { title: "Moji termini | Vule Still", robots: { index: false, follow: false } };
async function AppointmentsContent() {
  const user = await getCurrentUser();
  if (user) {
    const db = await createClient();
    const [profile, appointments] = await Promise.all([
      db.from("profiles").select("phone").eq("id", user.id).maybeSingle(), db.rpc("get_my_appointments"),
    ]);
    if (profile.error || appointments.error || !appointments.data) throw new Error("Termini trenutno nisu dostupni. Pokušaj ponovo.");
    return <Appointments userId={user.id} phone={profile.data?.phone ?? null} initialData={appointments.data as unknown as AppointmentsState} />;
  }
  return <div className="empty-state"><Icon name="calendar" /><h2>{user ? "Tvoj nalog je spreman." : "Tvoji termini te čekaju"}</h2><p>{user ? "Ovde će biti tvoje rezervacije. Online zakazivanje uskoro postaje dostupno." : passwordTestMode() ? "Prijavi se lozinkom u privremenom test okruženju." : "Prijavi se jednokratnim kodom koji šaljemo na tvoj imejl."}</p><Link href={user ? "/profil" : "/prijava?next=%2Fmoji-termini"} prefetch={false} className="button">{user ? "Moj profil" : "Prijavi se"}<Icon name="arrow" /></Link></div>;
}
export default function AppointmentsPage() {
  return <main id="main" className="container account-main"><PageHeading label="TVOJ NALOG" description="Sve tvoje rezervacije na jednom mestu.">Moji <em>termini.</em></PageHeading><Suspense fallback={<div className="empty-state" role="status">Proveravamo prijavu…</div>}><AppointmentsContent /></Suspense></main>;
}
