import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { Icon } from "./icon";
import { LogoutButton } from "./logout-button";
import { ActivityPing } from "./activity-ping";
import { phase3AccessEnabled } from "@/lib/auth/activity";

async function AccountNavigation() {
  const user = await getCurrentUser();
  return user ? <>{phase3AccessEnabled() && <ActivityPing />}<Link href="/profil" prefetch={false} className="account-link"><Icon name="user" /><span>Moj profil</span></Link><LogoutButton /></> : <Link href="/prijava" prefetch={false} className="account-link"><Icon name="user" /><span>Prijavi se</span></Link>;
}
export function Header() {
  return <header className="site-header"><div className="container header-inner"><Link href="/" aria-label="Vule Still — početna" className="brand"><Image src="/brand/logo.webp" width={110} height={64} alt="Vule Still" priority /></Link><nav aria-label="Glavna navigacija"><Link href="/#usluge" className="nav-link">Usluge</Link><Link href="/#lokacije" className="nav-link">Lokacije</Link><Link href="/moji-termini" prefetch={false} className="nav-link">Moji termini</Link><Suspense fallback={<span className="nav-loading" aria-label="Provera prijave…" />}><AccountNavigation /></Suspense><Link href="/rezervacija" className="button button-small header-booking">Rezerviši termin <Icon name="arrow" /></Link></nav></div></header>;
}
export function Footer() {
  return <footer className="site-footer"><div className="container"><div className="footer-top"><Link href="/" aria-label="Vule Still — početna" className="brand"><Image src="/brand/logo.webp" width={94} height={56} alt="Vule Still" /></Link><p>Tvoj stil. Tvoj potpis.</p><Link href="/moji-termini" prefetch={false}>Moji termini</Link></div><div className="footer-bottom"><span>© 2026 Vule Still</span><span className="locations-label">ZRENJANIN <b>•</b> NEUZIN</span><span>Vreme u Srbiji · 24 h format</span></div></div></footer>;
}
export function PageHeading({ label, children, description }: { label: string; children: React.ReactNode; description: string }) {
  return <div className="page-heading"><p className="eyebrow">{label}</p><h1>{children}</h1><p className="muted">{description}</p></div>;
}
