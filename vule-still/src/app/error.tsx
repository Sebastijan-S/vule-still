"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main id="main" className="container error-main"><p className="eyebrow">VULE STILL</p><h1>Pokušajmo <em>ponovo.</em></h1><p>Trenutno ne možemo da učitamo stranicu. Proveri vezu i pokušaj ponovo.</p><button className="button" onClick={retry}>Pokušaj ponovo</button><p><Link href="/" className="back-link">Nazad na početnu</Link></p></main>;
}
