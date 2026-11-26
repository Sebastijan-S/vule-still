"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicLocation, PublicService } from "@/lib/public-catalogue";
import { Icon } from "./icon";

function useCatalogue<T>(kind: "services" | "locations", initial: T[] | null) {
  const [data, setData] = useState(initial), [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function reload() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/catalogue/${kind}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.data)) throw new Error("Catalogue unavailable");
      if (!controller.signal.aborted) setData(body.data);
    } catch { if (!controller.signal.aborted) setData(null); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return { data, loading, reload };
}

export function ServicesCatalogue({ initial }: { initial: PublicService[] | null }) {
  const { data, loading, reload } = useCatalogue("services", initial);
  const standard = data?.filter(item => item.category === "standard") ?? [];
  const premium = data?.filter(item => item.category === "premium") ?? [];
  return <div aria-busy={loading}>
    {loading ? <p role="status" className="catalogue-status">Učitavamo usluge…</p>
      : data === null ? <p role="alert" className="form-error">Trenutno ne možemo da prikažemo usluge. Proveri vezu i pokušaj ponovo.</p>
      : !data.length ? <p role="status" className="catalogue-status">Trenutno nema dostupnih usluga za novo zakazivanje.</p>
      : <>{standard.map((item, index) => <Link key={item.slug} href={`/rezervacija?usluga=${encodeURIComponent(item.slug)}`} className="service-row"><span className="row-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><span className="row-duration">{item.duration_minutes} min</span><Icon name="arrow" /></Link>)}
        {premium.length > 0 && <details className="premium-list"><summary><span className="premium-star" aria-hidden="true">✳</span><strong>Premium usluge</strong><span className="premium-tag">DODATNA NEGA</span><span className="chevron" aria-hidden="true">⌄</span></summary><div>{premium.map(item => <Link key={item.slug} href={`/rezervacija?usluga=${encodeURIComponent(item.slug)}`} className="service-row premium-row"><span className="row-number" aria-hidden="true">✳</span><strong>{item.name}</strong><span className="row-duration">{item.duration_minutes} min</span><Icon name="arrow" /></Link>)}</div></details>}
      </>}
    <button type="button" className="text-button catalogue-refresh" disabled={loading} onClick={reload}>{loading ? "Učitavamo…" : data === null ? "Pokušaj ponovo" : "Osveži usluge"}</button>
  </div>;
}

export function LocationsCatalogue({ initial }: { initial: PublicLocation[] | null }) {
  const { data, loading, reload } = useCatalogue("locations", initial);
  const locations = [...(data ?? [])].sort((a, b) => Number(b.booking_enabled) - Number(a.booking_enabled) || a.sort_order - b.sort_order);
  return <div aria-busy={loading}>
    {loading ? <p role="status" className="catalogue-status">Učitavamo lokacije…</p>
      : data === null ? <p role="alert" className="form-error">Trenutno ne možemo da prikažemo lokacije. Proveri vezu i pokušaj ponovo.</p>
      : !locations.length ? <p role="status" className="catalogue-status">Trenutno nema dostupnih lokacija.</p>
      : <><div className="location-grid">{locations.map(location => <article className={`location-card${location.booking_enabled ? "" : " location-coming-soon"}`} key={location.slug}>
        <div className="location-top"><span className="tiny-label">{location.booking_enabled ? "REZERVACIJE SU OTVORENE" : "USKORO"}</span><Icon name="pin" /></div><h3>{location.name}<span>.</span></h3>
        {location.booking_enabled ? <><p>Slobodni termini prate objavljeni raspored.</p>{location.address && <p className="location-detail">{location.address}</p>}{location.phone && <p className="location-detail">{location.phone}</p>}<p className="location-schedule">Rezerviši vreme koje pripada samo tebi.</p><Link href={`/rezervacija?lokacija=${encodeURIComponent(location.slug)}`} className="button">Zakazivanje: {location.name} <Icon name="arrow" /></Link></> : <p>{location.name} rezervacije uskoro.</p>}
      </article>)}</div><p className="location-note"><Icon name="calendar" /> Rezervacije su dostupne za objavljene nedelje, do 14 dana unapred.</p></>}
    <button type="button" className="text-button catalogue-refresh" disabled={loading} onClick={reload}>{loading ? "Učitavamo…" : data === null ? "Pokušaj ponovo" : "Osveži lokacije"}</button>
  </div>;
}
