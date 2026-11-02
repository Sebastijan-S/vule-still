import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getChallenge, getCurrentUser } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/validation";
import { Icon } from "@/components/icon";
import { AuthForm } from "./auth-form";
import { PasswordForm } from "./password-form";
import { passwordTestMode } from "@/lib/auth/mode";
import { accountReturnTo } from "@/lib/auth/navigation";
export const metadata: Metadata = { title: "Prijava | Vule Still", robots: { index: false, follow: false } };
async function LoginContent({ searchParams }: PageProps<"/prijava">) {
  const query = await searchParams;
  const next = safeReturnTo(query.next);
  const user = await getCurrentUser();
  if (user) redirect(await accountReturnTo(next, user.id));
  const challenge = await getChallenge();
  const passwordMode = passwordTestMode();
  return <>{query.odjava === "1" && <p className="notice" role="status"><Icon name="check" />Uspešno si se odjavio sa ovog uređaja.</p>}<div className="auth-layout"><section className="auth-intro"><Link href="/moji-termini" className="back-link"><Icon name="back" />Nazad na moje termine</Link><p className="eyebrow">TVOJ NALOG</p><h1>Tvoj stil.<br />Tvoj <em>nalog.</em></h1><p className="intro-copy">{passwordMode ? "Prijavi se lozinkom u privremenom test okruženju." : "Jedan kod. Sve na jednom mestu."}<br />Pripremi svoj profil za sledeći dolazak.</p><div className="auth-benefits"><div><Icon name="mail" /><span>{passwordMode ? "Test nalog sa imejlom" : "Prijava kodom na tvoj imejl"}</span></div><div><Icon name="lock" /><span>{passwordMode ? "Lozinka od najmanje 12 znakova" : "Bez lozinke za pamćenje"}</span></div><div><Icon name="pin" /><span>Zrenjanin i Neuzin</span></div></div><p className="auth-signature">Dobar izgled. <em>Bez komplikacija.</em></p></section><section className="form-panel" aria-label="Prijava i registracija">{passwordMode ? <PasswordForm next={next} /> : <AuthForm next={next} initialState={challenge ? { step: "code", ...challenge } : { step: "email", email: "" }} />}</section></div></>;
}
export default function LoginPage(props: PageProps<"/prijava">) {
  return <main id="main" className="container auth-main"><Suspense fallback={<p className="page-loading" role="status">Pripremamo prijavu…</p>}><LoginContent {...props} /></Suspense></main>;
}
