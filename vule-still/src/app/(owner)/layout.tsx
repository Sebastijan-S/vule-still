import { Suspense } from "react";
import { OwnerHeader } from "@/components/owner-shell";

export const metadata = { robots: { index: false, follow: false } };

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="owner-shell"><Suspense fallback={<header className="owner-header"><div className="container">Vule Still · Administracija</div></header>}><OwnerHeader /></Suspense>{children}<footer className="owner-footer container">Vule Still · Administracija · Vreme u Srbiji</footer></div>;
}
