import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getChallenge } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/validation";
import { isOwnerDestination } from "@/lib/auth/owner-paths";
import { accountReturnTo } from "@/lib/auth/navigation";
import { passwordTestMode } from "@/lib/auth/mode";
import { PasswordForm } from "@/app/(public)/prijava/password-form";
import { AuthForm } from "@/app/(public)/prijava/auth-form";
import { OwnerDenied } from "@/components/owner-shell";

export const metadata = { title: "Prijava vlasnika | Vule Still" };
async function Login({ searchParams }: PageProps<"/administrator">) {
  const query = await searchParams;
  const candidate = safeReturnTo(query.next);
  const next = isOwnerDestination(candidate) ? candidate : "/administracija";
  const user = await getCurrentUser();
  if (user) {
    const destination = await accountReturnTo(next, user.id);
    if (isOwnerDestination(destination)) redirect(destination);
    return <OwnerDenied />;
  }
  const challenge = await getChallenge();
  return <>{query.odjava === "1" && <p className="notice" role="status">Uspešno si se odjavio sa ovog uređaja.</p>}<div className="owner-login"><div><p className="eyebrow">VLASNIČKI PRISTUP</p><h1>Vule Still.<br /><em>Administracija.</em></h1><p className="muted">Rezervacije i radno vreme za Zrenjanin i Neuzin.</p><p className="field-help">Pristup imaju samo ovlašćeni vlasnički nalozi. Link ne dodeljuje administratorska prava.</p></div><section className="form-panel" aria-label="Prijava vlasnika">{passwordTestMode() ? <PasswordForm next={next} owner /> : <AuthForm next={next} initialState={challenge ? { step: "code", ...challenge } : { step: "email", email: "" }} />}</section></div></>;
}
export default function AdministratorLogin(props: PageProps<"/administrator">) {
  return <main id="main" className="container auth-main"><Suspense fallback={<p role="status">Pripremamo vlasničku prijavu…</p>}><Login {...props} /></Suspense></main>;
}
