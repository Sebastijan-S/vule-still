import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { profileComplete, safeReturnTo } from "@/lib/auth/validation";
import { accountReturnTo } from "@/lib/auth/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/site-shell";
import { Icon } from "@/components/icon";
import { ProfileForm } from "./profile-form";
import { returnContext } from "@/lib/auth/return-context";
import { GuestSessionNote } from "@/components/guest-session-note";
export const metadata: Metadata = { title: "Moj profil | Vule Still", robots: { index: false, follow: false } };
async function ProfileContent({ searchParams }: PageProps<"/profil">) {
  const query = await searchParams;
  const requestedNext = query.next ? safeReturnTo(query.next) : "/profil";
  const user = await requireUser(requestedNext);
  const next = query.next ? await accountReturnTo(query.next, user.id) : "/profil";
  const context = returnContext(next);
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("first_name,last_name,phone,contact_email").eq("id", user.id).single();
  if (error || !profile) throw new Error("Profil trenutno nije dostupan.");
  const { data: owner } = await supabase.from("admin_memberships").select("user_id").eq("user_id", user.id).maybeSingle();
  const completing = context.booking && !profileComplete(profile);
  return <><Link href={context.href} prefetch={false} className="back-link"><Icon name="back" />{context.label}</Link><PageHeading label={completing ? "PRE PRVE REZERVACIJE" : "TVOJI PODACI"} description={completing ? "Dopuni označene podatke, pa nastavi sa izabranim terminom." : "Ime, prezime i jedan kontakt za dogovor sa salonom."}>{completing ? <>Dopuni <em>profil.</em></> : <>Moj <em>profil.</em></>}</PageHeading>{query.sacuvano === "1" && <p className="notice" role="status"><Icon name="check" />Podaci su sačuvani.</p>}<div className="profile-layout"><section className="profile-panel" aria-label="Podaci profila"><ProfileForm profile={profile} email={user.email ?? ""} emailVerified={!!user.email_confirmed_at} next={next} /></section><aside className="profile-aside">{owner && <Link className="outline-link" href="/administracija">Administracija i raspored</Link>}<p>Podatke možeš da promeniš kad god želiš. Sačuvan izbor usluga i vremena čeka te u rezervaciji; termin je zauzet tek posle potvrde.</p>{user.is_anonymous && <GuestSessionNote />}</aside></div></>;
}
export default function ProfilePage(props: PageProps<"/profil">) {
  return <main id="main" className="container account-main"><Suspense fallback={<p className="page-loading" role="status">Učitavamo profil…</p>}><ProfileContent {...props} /></Suspense></main>;
}
