import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { ActivityPing } from "./activity-ping";
import { phase3AccessEnabled } from "@/lib/auth/activity";
import { OwnerNavigation } from "./owner-navigation";

export async function OwnerHeader() {
  const user = await getCurrentUser();
  const db = await createClient();
  const membership = user ? await db.from("admin_memberships").select("user_id").eq("user_id", user.id).maybeSingle() : null;
  if (membership?.error) throw new Error("Provera vlasničkog pristupa trenutno nije dostupna.");
  const owner = !!membership?.data;
  return <header className="owner-header"><div className="container owner-header-top"><Link href="/administrator" prefetch={false} className="owner-brand" aria-label="Vule Still — administracija"><Image src="/brand/logo.webp" alt="Vule Still" width={88} height={52} priority /><span>Administracija</span></Link>{user && <>{phase3AccessEnabled() && <ActivityPing />}<LogoutButton next="/administrator" /></>}</div>{owner && <OwnerNavigation />}</header>;
}

export function OwnerDenied({ schedule = false }: { schedule?: boolean }) {
  return <section className="empty-state"><h2>{schedule ? "Raspored je dostupan samo vlasniku." : "Administracija je dostupna samo vlasniku."}</h2><p>Ovaj nalog nema vlasničko ovlašćenje. Direktan link i registracija ne dodeljuju prava.</p><p>Odjavi se i prijavi vlasničkim nalogom.</p><Link href="/moji-termini" className="outline-link">Moji termini</Link></section>;
}
