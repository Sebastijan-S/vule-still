import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { Icon } from "@/components/icon";
import { getSupabaseEnvironment } from "@/lib/supabase/environment";
import type { Database } from "@/types/database";

async function Catalogue() {
  const { url, publishableKey } = getSupabaseEnvironment();
  const db = createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [serviceResult, locationResult] = await Promise.all([
    db.from("services").select("slug,name,category,duration_minutes,sort_order").eq("is_active", true).order("sort_order"),
    db.from("locations").select("slug,name,address,phone,sort_order").eq("is_active", true).order("sort_order"),
  ]);
  if (serviceResult.error || locationResult.error) return <section className="catalogue-error container" role="status"><h2>Trenutno ne možemo da prikažemo usluge.</h2><p>Pokušaj ponovo malo kasnije.</p></section>;
  const standard = (serviceResult.data ?? []).filter((item) => item.category === "standard");
  const premium = (serviceResult.data ?? []).filter((item) => item.category === "premium");
  const locations = locationResult.data ?? [];
  return <>
    <section id="usluge" className="public-section services-section"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">USLUGE</p><h2>Stil je u <em>detaljima.</em></h2></div><p>Od klasičnog reza do završnog dodira.<br />Izaberi uslugu koja odgovara tvom stilu.</p></div>
      <div className="services-grid"><div className="service-promo"><div className="scissors-mark" aria-hidden="true">✂</div><p className="tiny-label">TVOJ SLEDEĆI TERMIN</p><h3>Dobar izgled.<br /><span>Bez komplikacija.</span></h3><p>Izaberi lokaciju i uslugu. Slobodni termini biće dostupni kada zakazivanje bude uključeno.</p><Link href="/rezervacija" className="text-link">Pogledaj zakazivanje <Icon name="arrow" /></Link></div>
      <div className="service-list">{standard.map((item, index) => <Link key={item.slug} href={`/rezervacija?usluga=${encodeURIComponent(item.slug)}`} className="service-row"><span className="row-number">{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><span className="row-duration">{item.duration_minutes} min</span><Icon name="arrow" /></Link>)}
      {premium.length > 0 && <details className="premium-list"><summary><span className="premium-star" aria-hidden="true">✳</span><strong>Premium usluge</strong><span className="premium-tag">DODATNA NEGA</span><span className="chevron" aria-hidden="true">⌄</span></summary><div>{premium.map((item) => <Link key={item.slug} href={`/rezervacija?usluga=${encodeURIComponent(item.slug)}`} className="service-row premium-row"><span className="row-number">✳</span><strong>{item.name}</strong><span className="row-duration">{item.duration_minutes} min</span><Icon name="arrow" /></Link>)}</div></details>}
      </div></div>
    </div></section>
    <section id="lokacije" className="public-section locations-section"><div className="container"><div className="section-heading"><div><p className="eyebrow">LOKACIJE</p><h2>Dva mesta.<br />Isti <em>potpis.</em></h2></div><p>Pronađi nas tamo gde ti odgovara.<br />Tvoj stil je uvek na pravom mestu.</p></div><div className="location-grid">{locations.map((location, index) => <article className="location-card" key={location.slug}><div className="location-top"><span className="tiny-label">LOKACIJA {String(index + 1).padStart(2, "0")}</span><Icon name="pin" /></div><h3>{location.name}<span>.</span></h3><p>{location.slug === "zrenjanin" ? "Tvoj termin. Tvoj stil." : "Isti pristup. Isti standard."}</p>{location.address && <p className="location-detail">{location.address}</p>}{location.phone && <p className="location-detail">{location.phone}</p>}<p className="location-schedule">Raspored termina biće prikazan po objavljivanju.</p><Link href={`/rezervacija?lokacija=${encodeURIComponent(location.slug)}`} className="outline-link">Zakazivanje: {location.name} <Icon name="arrow" /></Link></article>)}</div><p className="location-note"><Icon name="calendar" /> Termini će biti dostupni po objavljivanju rasporeda.</p></div></section>
  </>;
}

export default function Home() {
  return <main id="main"><section className="home-hero"><Image src="/brand/barber-hero.webp" alt="Frizer pažljivo oblikuje mušku frizuru" fill priority sizes="100vw" className="hero-image" /><div className="hero-shade" /><div className="container hero-content"><p className="eyebrow">VULE STILL · MUŠKI FRIZERSKI SALON</p><h1>TVOJ STIL.<br />TVOJ <span>POTPIS.</span></h1><p className="hero-copy">Preciznost u svakom detalju.<br />Vreme koje pripada samo tebi.</p><Link className="button" href="/rezervacija">Rezerviši termin <Icon name="arrow" /></Link><p className="hero-location"><Icon name="pin" /> Zrenjanin & Neuzin</p></div><span className="hero-side-note" aria-hidden="true">DETALJI PRAVE RAZLIKU.</span><a className="hero-discover" href="#usluge">OTKRIJ VULE STILL <span aria-hidden="true">↓</span></a></section><div className="brand-strip"><span>PRECIZAN REZ.</span><b>✳</b><span>ČISTE LINIJE.</span><b>✳</b><span>TVOJ KARAKTER.</span><b>✳</b><span>VULE STYLE.</span></div><Suspense fallback={<div className="page-loading" role="status">Učitavanje usluga i lokacija…</div>}><Catalogue /></Suspense><section className="final-cta"><div className="container"><p className="eyebrow">TVOJ SLEDEĆI DOBAR POTEZ</p><h2>Sredi stil.<br /><em>Ostavi utisak.</em></h2><p>Jedan salon. Dve lokacije. Tvoj prepoznatljiv izgled.</p><Link className="button" href="/rezervacija">Rezerviši termin <Icon name="arrow" /></Link><span className="cta-monogram" aria-hidden="true">VS</span></div></section></main>;
}
