import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ScheduleEditor } from "./schedule-editor";
import { PageHeading } from "@/components/site-shell";

export const metadata: Metadata = { title: "Raspored | Vule Still", robots: { index: false, follow: false } };

async function OwnerSchedule() {
  const user = await requireUser("/raspored");
  const db = await createClient();
  const { data, error } = await db.from("admin_memberships").select("user_id").eq("user_id",user.id).maybeSingle();
  if (error) throw new Error("Provera pristupa rasporedu trenutno nije dostupna.");
  if (!data) return <><PageHeading label="RASPORED RADA" description="Nedeljni kalendari za obe lokacije.">Nedeljni <em>raspored.</em></PageHeading><section className="empty-state" aria-label="Pristup rasporedu"><h2>Raspored je dostupan samo vlasniku.</h2><p>Prijavljen si korisničkim nalogom. Registracija ne dodeljuje vlasnička prava; tvoji podaci i termini nalaze se u tvom nalogu.</p><Link className="button" href="/moji-termini">Moji termini</Link><Link className="back-link" href="/profil">Moj profil</Link></section></>;
  const { data: locations, error: locationsError } = await db.from("locations")
    .select("id,name").eq("is_active",true).order("sort_order");
  if (locationsError) throw new Error("Lokacije trenutno nisu dostupne.");
  return <ScheduleEditor locations={locations ?? []} />;
}

export default function SchedulePage() {
  return <main id="main" className="container account-main"><Suspense fallback={<p role="status" className="page-loading">Učitavamo raspored…</p>}><OwnerSchedule /></Suspense></main>;
}
