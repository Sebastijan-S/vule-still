import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { profileComplete, safeReturnTo } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icon";
import { GuestForm } from "./guest-form";
import { accountReturnTo } from "@/lib/auth/navigation";
import { returnContext } from "@/lib/auth/return-context";
export const metadata: Metadata = { title: "Prijava | Vule Still", robots: { index: false, follow: false } };
async function LoginContent({ searchParams }: PageProps<"/prijava">) {
  const query = await searchParams;
  const next = safeReturnTo(query.next);
  const context = returnContext(next);
  const user = await getCurrentUser();
  if (user) {
    const db = await createClient();
    const { data, error } = await db.from("profiles").select("first_name,last_name,phone,contact_email").eq("id", user.id).single();
    if (error) throw new Error("Profil trenutno nije dostupan.");
    const destination = await accountReturnTo(next, user.id);
    redirect(profileComplete(data) ? destination : `/profil?next=${encodeURIComponent(destination)}`);
  }
  return <>{query.odjava === "1" && <p className="notice" role="status"><Icon name="check" />Uspešno si se odjavio sa ovog uređaja.</p>}<div className="guest-entry"><Link href={context.href} prefetch={false} className="back-link"><Icon name="back" />{context.label}</Link><p className="eyebrow">{context.booking ? "NASTAVI REZERVACIJU" : "MOJI TERMINI"}</p><h1>Prijavi <em>se.</em></h1><section className="form-panel" aria-label="Prijava"><GuestForm next={next} /></section></div></>;
}
export default function LoginPage(props: PageProps<"/prijava">) {
  return <main id="main" className="container auth-main"><Suspense fallback={<p className="page-loading" role="status">Pripremamo prijavu…</p>}><LoginContent {...props} /></Suspense></main>;
}
