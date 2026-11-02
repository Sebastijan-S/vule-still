import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeading } from "@/components/site-shell";
import { Icon } from "@/components/icon";
import { passwordTestMode } from "@/lib/auth/mode";
export const metadata: Metadata = { title: "Moji termini | Vule Still", robots: { index: false, follow: false } };
async function AppointmentsContent() {
  const user = await getCurrentUser();
  return <div className="empty-state"><Icon name="calendar" /><h2>{user ? "Tvoj nalog je spreman." : "Tvoji termini te čekaju"}</h2><p>{user ? "Ovde će biti tvoje rezervacije. Online zakazivanje uskoro postaje dostupno." : passwordTestMode() ? "Prijavi se lozinkom u privremenom test okruženju." : "Prijavi se jednokratnim kodom koji šaljemo na tvoj imejl."}</p><Link href={user ? "/profil" : "/prijava?next=%2Fmoji-termini"} prefetch={false} className="button">{user ? "Moj profil" : "Prijavi se"}<Icon name="arrow" /></Link></div>;
}
export default function AppointmentsPage() {
  return <main id="main" className="container account-main"><PageHeading label="TVOJ NALOG" description="Sve tvoje rezervacije na jednom mestu.">Moji <em>termini.</em></PageHeading><Suspense fallback={<div className="empty-state" role="status">Proveravamo prijavu…</div>}><AppointmentsContent /></Suspense></main>;
}
