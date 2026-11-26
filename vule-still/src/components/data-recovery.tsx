"use client";

import Link from "next/link";
import { catchError, type ErrorInfo } from "next/error";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

export function DataRecovery({ title, retry }: { title: string; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="data-recovery" aria-busy={pending}>
    <h2 ref={heading} tabIndex={-1}>{title}</h2>
    <p role="alert">Podaci trenutno ne mogu da se učitaju. Proveri vezu i pokušaj ponovo. Sačuvani izbor i zahtev ostaju u ovom pregledaču.</p>
    <div className="booking-toolbar"><button type="button" className="button" disabled={pending} onClick={() => startTransition(retry)}>{pending ? "Učitavamo…" : "Pokušaj ponovo"}</button><Link href="/moji-termini" prefetch={false} className="outline-link">Moji termini</Link></div>
    {pending && <p role="status">Ponovo učitavamo podatke…</p>}
  </section>;
}

export function BookingDataRecovery() {
  const router = useRouter();
  return <DataRecovery title="Zakazivanje trenutno nije dostupno" retry={() => router.refresh()} />;
}

export const DataBoundary = catchError(function DataFallback({ title }: { title: string }, { retry }: ErrorInfo) {
  return <DataRecovery title={title} retry={retry} />;
});
