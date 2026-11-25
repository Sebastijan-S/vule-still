"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addCalendarDays } from "@/lib/availability";
import { dateLabel, timeLabel, offsetLabel, postBooking, type Appointment } from "@/lib/appointment-display";

type Location = { id: string; slug: string; name: string };
type Service = { id: string; slug: string; name: string; duration_minutes: number; category: string };
type User = { id: string; email: string; name: string; complete: boolean } | null;
type Availability = { reason: string; schedule_revision: number; server_time: string; slots: { start: string; end: string; local_start: string; utc_offset_minutes: number }[] };
type Pending = { request_key: string; location: string; service: string; start: string; schedule_revision: number; expected_service_name: string; expected_duration: number; attendee_name: string | null };
const messages: Record<string, string> = { unpublished: "Raspored još nije objavljen.", closed: "Ovaj dan je neradan.", fully_booked: "Svi odgovarajući termini su zauzeti.", insufficient_duration: "Nema dovoljno dugog slobodnog perioda za ovu uslugu.", cutoff: "Za danas više nema termina koji počinju najmanje 15 minuta unapred.", outside_horizon: "Izaberi datum u narednih 14 dana.", inactive_service: "Usluga više nije dostupna. Ponovo izaberi uslugu.", inactive_location: "Lokacija više nije dostupna. Ponovo izaberi lokaciju." };
const draftKey = "vule-booking-selection";
export function BookingForm({ locations, services, user, today, initial }: { locations: Location[]; services: Service[]; user: User; today: string; initial: { location?: string; service?: string } }) {
  const [location, setLocation] = useState(locations.find(l => l.slug === initial.location)?.id ?? "");
  const [service, setService] = useState(services.find(s => s.slug === initial.service)?.id ?? "");
  const [date, setDate] = useState(today), [start, setStart] = useState("");
  const [step, setStep] = useState(0), [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<Availability | null>(null), [loading, setLoading] = useState(false), [reload, setReload] = useState(0);
  const [other, setOther] = useState(false), [attendee, setAttendee] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [pending, setPending] = useState<Pending | null>(null);
  const [success, setSuccess] = useState<Appointment | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { if (step > 0 || success) { const heading = panel.current?.querySelector("h2"); if (heading) { heading.tabIndex = -1; heading.focus(); } } }, [step, success]);
  const pendingKey = `vule-booking-pending:${user?.id ?? "anonymous"}`;
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
        if (saved) {
          if (!initial.location && locations.some(l => l.id === saved.location)) setLocation(saved.location);
          if (!initial.service && services.some(s => s.id === saved.service)) setService(saved.service);
          if (/^\d{4}-\d{2}-\d{2}$/.test(saved.date) && saved.date >= today && saved.date <= addCalendarDays(today, 14)) { setDate(saved.date); if (typeof saved.start === "string") setStart(saved.start); }
          if (locations.some(l => l.id === saved.location) && services.some(s => s.id === saved.service)
            && (!initial.location || locations.find(l => l.slug === initial.location)?.id === saved.location)
            && (!initial.service || services.find(s => s.slug === initial.service)?.id === saved.service)) setStep(2);
        }
        if (user) {
          const savedRequest = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null");
          if (savedRequest?.request_key && savedRequest.location && savedRequest.service && savedRequest.start) {
            setPending(savedRequest); setLocation(savedRequest.location); setService(savedRequest.service); setDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date(savedRequest.start))); setStart(savedRequest.start); setStep(3);
            setOther(!!savedRequest.attendee_name); setAttendee(savedRequest.attendee_name ?? "");
          }
        }
      } catch { /* Storage may be unavailable; database idempotency still applies. */ }
      setReady(true);
    });
  }, [initial.location, initial.service, locations, services, today, user, pendingKey]);
  useEffect(() => { if (ready && !success) { try { sessionStorage.setItem(draftKey, JSON.stringify({ location, service, date, start })); } catch {} } }, [location, service, date, start, ready, success]);
  useEffect(() => {
    if (!ready || !location || !service) return;
    const controller = new AbortController();
    Promise.resolve().then(() => { setLoading(true); setAvailable(null); });
    fetch(`/api/availability?date=${date}&location=${location}&service=${service}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body as Availability; })
      .then(data => { if (!controller.signal.aborted) { setAvailable(data); setStart(current => {
        if (current && !pending && !data.slots.some(s => s.start === current)) { setError("Sačuvani termin više nije dostupan. Izaberi drugi; lokacija i usluga ostaju sačuvane."); return ""; } return current;
      }); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || "Slobodni termini trenutno nisu dostupni."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [date, location, service, ready, reload, pending]);
  const selectedLocation = locations.find(l => l.id === location), selectedService = services.find(s => s.id === service);
  const slot = available?.slots.find(s => s.start === start);
  const end = slot?.end ?? (start && selectedService ? new Date(Date.parse(start) + selectedService.duration_minutes * 60000).toISOString() : "");
  const returnTo = `/rezervacija?lokacija=${encodeURIComponent(selectedLocation?.slug ?? "")}&usluga=${encodeURIComponent(selectedService?.slug ?? "")}`;
  function clearPending() { setPending(null); try { sessionStorage.removeItem(pendingKey); } catch {} }
  async function confirm() {
    if (!user || !user.complete || !start || !selectedService || !selectedLocation) return;
    if (other && (!attendee.trim() || [...attendee.trim()].length > 120)) { setError("Unesi ime osobe koja dolazi (do 120 znakova)."); return; }
    setBusy(true); setError("");
    let request = pending;
    try {
      if (!request) {
        // Revalidate the advisory selection after login/profile and immediately
        // before a new mutation. A pending mutation must retry its exact payload.
        const response = await fetch(`/api/availability?date=${date}&location=${location}&service=${service}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const fresh = await response.json();
        if (!response.ok) throw new Error(fresh.error);
        if (!fresh.slots.some((s: { start: string }) => s.start === start)) { setStart(""); setStep(2); setReload(n => n + 1); setError("Ovaj termin je upravo zauzet ili je raspored promenjen. Izaberi drugi slobodan termin."); return; }
        request = { request_key: crypto.randomUUID(), location, service, start, schedule_revision: fresh.schedule_revision, expected_service_name: selectedService.name, expected_duration: selectedService.duration_minutes, attendee_name: other ? attendee.trim() : null };
        setPending(request);
        try { sessionStorage.setItem(pendingKey, JSON.stringify(request)); } catch {}
      }
      const response = await postBooking("/api/reservations", request);
      if (!response.ok) {
        setError(response.error);
        if (!response.retry_same_key) { clearPending(); if (response.status === 409) { setStart(""); setStep(2); setReload(n => n + 1); } }
        return;
      }
      setSuccess(response.reservation); clearPending();
      try { sessionStorage.removeItem(draftKey); } catch {}
    } catch { setError(request ? "Ishod potvrde još nije poznat. Proveri isti zahtev dugmetom ispod; nemoj zakazivati novi termin dok ne proveriš Moje termine." : "Dostupnost trenutno ne može da se proveri. Pokušaj ponovo."); }
    finally { setBusy(false); }
  }
  if (success) return <section ref={panel} className="booking-panel" aria-label="Potvrđena rezervacija"><p className="eyebrow">REZERVACIJA JE POTVRĐENA</p><h2>Vidimo se <em>uskoro.</em></h2><dl className="appointment-facts"><div><dt>Usluga</dt><dd>{success.service_name} · {success.duration_minutes} min</dd></div><div><dt>Lokacija</dt><dd>{selectedLocation?.name}</dd></div><div><dt>Termin</dt><dd>{dateLabel(success.starts_at)} · {timeLabel(success.starts_at)}–{timeLabel(success.ends_at)} ({offsetLabel(success.starts_at)})</dd></div><div><dt>Osoba</dt><dd>{success.attendee_name}</dd></div></dl><p>Potvrda je sačuvana u aplikaciji. Obaveštenja vidiš kada otvoriš Moje termine; ne šaljemo booking mejlove.</p><Link className="button" href="/moji-termini">Moji termini</Link></section>;
  return <section ref={panel} className="booking-panel" aria-label="Zakazivanje termina">
    <ol className="booking-progress">{["Lokacija", "Usluga", "Termin", "Pregled"].map((label, i) => <li key={label}><button type="button" aria-current={step === i ? "step" : undefined} disabled={busy || !!pending || (i > 0 && !location) || (i > 1 && !service) || (i > 2 && !start)} onClick={() => { setStep(i); setError(""); }}>{i + 1}. {label}</button></li>)}</ol>
    <p className="field-help">Vreme u Srbiji · izbor nije rezervacija niti zauzeće termina.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!ready ? <p role="status">Učitavamo sačuvani izbor…</p> : <>
      {step === 0 && <><h2>Izaberi lokaciju</h2><div className="booking-options">{locations.map(l => <button type="button" className="booking-option" aria-pressed={location === l.id} key={l.id} onClick={() => { if (location !== l.id) { setLocation(l.id); setStart(""); } setStep(1); setError(""); }}>{l.name}</button>)}</div></>}
      {step === 1 && <><h2>Izaberi jednu uslugu</h2>{["standard", "premium"].map(category => <fieldset key={category}><legend>{category === "premium" ? "Premium usluge" : "Standardne usluge"}</legend><div className="booking-options">{services.filter(s => s.category === category).map(s => <button type="button" className="booking-option" aria-pressed={service === s.id} key={s.id} onClick={() => { if (service !== s.id) { setService(s.id); setStart(""); } setStep(2); setError(""); }}><strong>{s.name}</strong><span>{s.duration_minutes} min</span></button>)}</div></fieldset>)}</>}
      {step === 2 && <><h2>Izaberi datum i vreme</h2><p>{selectedLocation?.name} · {selectedService?.name} · {selectedService?.duration_minutes} min</p><label className="booking-field">Datum<input type="date" min={today} max={addCalendarDays(today, 14)} value={date} onChange={e => { setDate(e.target.value); setStart(""); setError(""); }} /></label><button type="button" className="text-button" onClick={() => { setError(""); setReload(n => n + 1); }}>Osveži slobodne termine</button>
        {loading ? <p role="status">Proveravamo slobodne termine…</p> : available && !available.slots.length ? <p className="booking-empty">{messages[available.reason] ?? "Za ovaj izbor nema slobodnih termina."}</p> : <div className="slot-options" aria-label="Slobodni termini">{available?.slots.map(s => <button type="button" key={s.start} aria-pressed={start === s.start} onClick={() => { setStart(s.start); setError(""); }}>{s.local_start}<small>{offsetLabel(s.start)}</small></button>)}</div>}
        <button type="button" className="button" disabled={!start || loading} onClick={() => setStep(3)}>Pregled rezervacije</button></>}
      {step === 3 && <><h2>Proveri svoj izbor</h2><dl className="appointment-facts"><div><dt>Lokacija</dt><dd>{selectedLocation?.name}</dd></div><div><dt>Usluga</dt><dd>{selectedService?.name} · {selectedService?.duration_minutes} min</dd></div><div><dt>Termin</dt><dd>{start && dateLabel(start)} · {start && timeLabel(start)}–{end && timeLabel(end)} ({start && offsetLabel(start)})</dd></div><div><dt>Kontakt</dt><dd>{user?.email ?? "Prijava je potrebna za potvrdu."}</dd></div></dl>
        {!user ? <Link className="button" prefetch={false} href={`/prijava?next=${encodeURIComponent(returnTo)}`}>Prijavi se i nastavi</Link> : !user.complete ? <Link className="button" prefetch={false} href={`/profil?next=${encodeURIComponent(returnTo)}`}>Dopuni profil i nastavi</Link> : <><fieldset disabled={busy || !!pending}><legend>Ko dolazi?</legend><label className="choice-line"><input type="radio" name="attendee" checked={!other} onChange={() => setOther(false)} /> Ja — {user.name}</label><label className="choice-line"><input type="radio" name="attendee" checked={other} onChange={() => setOther(true)} /> Druga osoba</label>{other && <label className="booking-field">Ime osobe koja dolazi<input maxLength={120} value={attendee} onChange={e => setAttendee(e.target.value)} /></label>}</fieldset><p className="field-help">Osoba koja dolazi: <strong>{other ? attendee || "Unesi ime" : user.name}</strong>. Otkazivanje je moguće najmanje 30 minuta pre početka.</p>{pending && <p role="status">Postoji zahtev za potvrdu. Dugme ponavlja isti zahtev i ne stvara duplikat. Možeš proveriti i <Link href="/moji-termini">Moje termine</Link>.</p>}<button type="button" className="button" disabled={busy || (!pending && (!slot || loading))} onClick={confirm}>{busy ? "Proveravamo potvrdu…" : pending ? "Proveri isti zahtev" : "Potvrdi rezervaciju"}</button></>}
      </>}
      {step > 0 && <button type="button" className="back-link" disabled={busy || !!pending} onClick={() => { setStep(step - 1); setError(""); }}>← Prethodni korak</button>}
    </>}
  </section>;
}
