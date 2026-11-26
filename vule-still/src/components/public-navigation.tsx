"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

export function HomeAnchor({ id, className, children }: { id: string; className: string; children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The home catalogue can arrive after navigation because it is streamed.
    if (window.location.hash === `#${id}`) {
      target.current?.focus({ preventScroll: true });
      target.current?.scrollIntoView();
    }
  }, [id]);
  return <div ref={target} id={id} className={className} tabIndex={-1}>{children}</div>;
}

export function PublicNavigation({ account }: { account: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const secondary = useRef<HTMLDivElement>(null);

  function focusAnchor(id: string) {
    // Same-page hash transitions scroll in Next.js but do not move keyboard focus.
    // Wait for the disclosure to collapse before focusing its destination.
    requestAnimationFrame(() => {
      const destination = document.getElementById(id);
      destination?.focus({ preventScroll: true });
      destination?.scrollIntoView();
    });
  }

  useEffect(() => {
    if (!open) return;
    secondary.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        toggle.current?.focus();
      }
    }
    function outside(event: PointerEvent) {
      if (!navigation.current?.contains(event.target as Node)) {
        if (secondary.current?.contains(document.activeElement)) toggle.current?.focus();
        setOpen(false);
      }
    }
    function resize(event: MediaQueryListEvent) {
      if (event.matches) {
        if (document.activeElement === toggle.current) secondary.current?.querySelector<HTMLAnchorElement>("a")?.focus();
        setOpen(false);
      }
    }
    const desktop = window.matchMedia("(min-width: 1001px)");
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    desktop.addEventListener("change", resize);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
      desktop.removeEventListener("change", resize);
    };
  }, [open]);

  return <nav ref={navigation} className="public-navigation" aria-label="Glavna navigacija" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <div className="primary-navigation">
      <Link href="/moji-termini" prefetch={false} className="nav-link appointments-link">Moji termini</Link>
      <Link href="/rezervacija" className="button button-small header-booking"><span className="booking-label-desktop">Rezerviši termin</span><span className="booking-label-mobile">Rezerviši</span><Icon name="arrow" /></Link>
    </div>
    <button ref={toggle} type="button" className="navigation-toggle" aria-expanded={open} aria-controls="public-secondary-navigation" onClick={() => setOpen(value => !value)}>
      <span aria-hidden="true">{open ? "×" : "☰"}</span>{open ? "Zatvori meni" : "Meni"}
    </button>
    <div ref={secondary} id="public-secondary-navigation" className={`secondary-navigation${open ? " is-open" : ""}`} onClick={event => {
      if ((event.target as Element).closest("a")) setOpen(false);
    }}>
      <Link href="/#usluge" className="nav-link" onNavigate={() => focusAnchor("usluge")}>Usluge</Link>
      <Link href="/#lokacije" className="nav-link" onNavigate={() => focusAnchor("lokacije")}>Lokacije</Link>
      {account}
    </div>
  </nav>;
}
