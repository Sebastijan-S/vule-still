"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [["/administracija", "Rezervacije"], ["/raspored", "Radno vreme"], ["/administrator/sablon", "Uobičajena nedelja"]];
export function OwnerNavigation() {
  const pathname = usePathname();
  return <nav className="container owner-navigation" aria-label="Administratorska navigacija">{links.map(([href, label]) => <Link prefetch={false} key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>;
}
