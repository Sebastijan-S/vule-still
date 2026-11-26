import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { HomeAnchor } from "@/components/public-navigation";
import { publicLocations, publicServices } from "@/lib/public-catalogue-server";
import { LocationsCatalogue, ServicesCatalogue } from "@/components/home-catalogue";
import { DataBoundary } from "@/components/data-recovery";

async function Services() {
  return <ServicesCatalogue initial={await publicServices()} />;
}

async function Locations() {
  return <LocationsCatalogue initial={await publicLocations()} />;
}

function Catalogue() {
  return <>
    <section className="public-section services-section" aria-labelledby="services-heading"><div className="container">
      <div className="section-heading"><div><p className="eyebrow">USLUGE</p><h2 id="services-heading">Stil je u <em>detaljima.</em></h2></div><p>Izaberi uslugu i pređi na slobodna vremena.<br />U rezervaciji možeš dodati još usluga.</p></div>
      <HomeAnchor id="usluge" className="service-list"><DataBoundary title="Usluge trenutno nisu dostupne"><Suspense fallback={<p className="catalogue-status" role="status">Učitavamo usluge…</p>}><Services /></Suspense></DataBoundary></HomeAnchor>
    </div></section>
    <section className="public-section locations-section" aria-labelledby="locations-heading"><div className="container">
      <HomeAnchor id="lokacije" className="section-heading"><div><p className="eyebrow">LOKACIJE</p><h2 id="locations-heading">Vidimo se u <em>Neuzinu.</em></h2></div><p>Izaberi svoj termin u objavljenom rasporedu.</p></HomeAnchor>
      <DataBoundary title="Lokacije trenutno nisu dostupne"><Suspense fallback={<p className="catalogue-status" role="status">Učitavamo lokacije…</p>}><Locations /></Suspense></DataBoundary>
    </div></section>
  </>;
}

export default function Home() {
  return <main id="main"><section className="home-hero"><Image src="/brand/barber-hero.webp" alt="Frizer pažljivo oblikuje mušku frizuru" fill priority sizes="100vw" className="hero-image" /><div className="hero-shade" /><div className="container hero-content"><p className="eyebrow">VULE STILL · MUŠKI FRIZERSKI SALON</p><h1>TVOJ STIL.<br />TVOJ <span>POTPIS.</span></h1><p className="hero-copy">Preciznost u svakom detalju.<br />Vreme koje pripada samo tebi.</p><Link className="button" href="/rezervacija">Rezerviši termin <Icon name="arrow" /></Link><p className="hero-location"><Icon name="pin" /> Neuzin · Zrenjanin uskoro</p></div><a className="hero-discover" href="#usluge">Pogledaj usluge <span aria-hidden="true">↓</span></a></section><Catalogue /><section className="final-cta"><div className="container"><p className="eyebrow">TVOJ SLEDEĆI DOBAR POTEZ</p><h2>Sredi stil.<br /><em>Ostavi utisak.</em></h2><p>Tvoj termin u Neuzinu. Tvoj prepoznatljiv izgled.</p><Link className="button" href="/rezervacija">Rezerviši termin <Icon name="arrow" /></Link><span className="cta-monogram" aria-hidden="true">VS</span></div></section></main>;
}
