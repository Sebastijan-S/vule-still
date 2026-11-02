import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ScheduleEditor } from "./schedule-editor";

export const metadata: Metadata = { title: "Raspored | Vule Still", robots: { index: false, follow: false } };

async function OwnerSchedule() {
  const user = await requireUser("/raspored");
  const db = await createClient();
  const { data, error } = await db.from("admin_memberships").select("user_id").eq("user_id",user.id).maybeSingle();
  if (error || !data) notFound();
  const { data: locations, error: locationsError } = await db.from("locations")
    .select("id,name").eq("is_active",true).order("sort_order");
  if (locationsError) throw new Error("Lokacije trenutno nisu dostupne.");
  return <ScheduleEditor locations={locations ?? []} />;
}

export default function SchedulePage() {
  return <main id="main" className="container account-main"><Suspense fallback={<p role="status" className="page-loading">Učitavamo raspored…</p>}><OwnerSchedule /></Suspense></main>;
}
