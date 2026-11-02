import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { profileComplete } from "@/lib/auth/validation";
import { accountReturnTo } from "@/lib/auth/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/site-shell";
import { Icon } from "@/components/icon";
import { ProfileForm } from "./profile-form";
import { passwordTestMode } from "@/lib/auth/mode";
export const metadata: Metadata = { title: "Moj profil | Vule Still", robots: { index: false, follow: false } };
async function ProfileContent({ searchParams }: PageProps<"/profil">) {
  const user = await requireUser();
  const query = await searchParams;
  const next = query.next ? await accountReturnTo(query.next, user.id) : "/profil";
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("first_name,last_name,phone").eq("id", user.id).single();
  if (error || !profile) throw new Error("Profil trenutno nije dostupan.");
  return <><PageHeading label="TVOJ NALOG" description="Tvoji podaci, uvek pri ruci.">Moj <em>profil.</em></PageHeading>{query.sacuvano === "1" && <p className="notice" role="status"><Icon name="check" />Podaci su sačuvani.</p>}<div className="profile-layout"><section className="profile-panel" aria-label="Podaci profila"><ProfileForm profile={profile} email={user.email ?? ""} emailVerified={!passwordTestMode()} next={next} /></section><aside className="profile-aside"><p className="eyebrow">SVE SPREMNO ZA DOLAZAK</p><h2>{profileComplete(profile) ? <>Tvoji podaci.<br /><em>Tvoj mir.</em></> : <>Još samo<br /><em>nekoliko detalja.</em></>}</h2><p>Ime, prezime i telefon potrebni su pre prve rezervacije. Podatke možeš da promeniš kad god želiš.</p><Link href="/moji-termini" className="back-link">Moji termini <Icon name="arrow" /></Link></aside></div></>;
}
export default function ProfilePage(props: PageProps<"/profil">) {
  return <main id="main" className="container account-main"><Suspense fallback={<p className="page-loading" role="status">Učitavamo profil…</p>}><ProfileContent {...props} /></Suspense></main>;
}
