"use client";
import Link from "next/link";
import { AppointmentServices } from "@/components/appointment-services";
import { SlotPicker } from "@/components/slot-picker";
import { ServicePicker, selectionSnapshot } from "@/components/service-picker";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addCalendarDays } from "@/lib/availability";
import { parseConfirmation, type ServiceSnapshot } from "@/lib/booking";
import { bookingNavigation } from "@/lib/booking-navigation";
import { dateLabel, timeLabel, offsetLabel, postBooking, businessDate, type Appointment } from "@/lib/appointment-display";

type Location = { id: string; slug: string; name: string };
type Service = { id: string; slug: string; name: string; duration_minutes: number; category: string };
type User = { id: string; email: string; name: string; complete: boolean } | null;
type Availability = { reason: string; schedule_revision: number; items?: ServiceSnapshot[]; slots: { start: string; end: string; local_start: string }[] };
type Pending = NonNullable<ReturnType<typeof parseConfirmation>>;
type Draft = { location?: string; services?: unknown[]; service?: string; date?: string; start?: string; step?: number; other?: boolean; attendee?: string; needsReview?: boolean; entryService?: string };
const messages: Record<string, string> = { unpublished: "Raspored još nije objavljen.", closed: "Ovaj dan je neradan.", fully_booked: "Svi odgovarajući termini su zauzeti.", insufficient_duration: "Nema dovoljno dugog slobodnog perioda za izabrane usluge.", cutoff: "Za danas više nema termina koji počinju najmanje 15 minuta unapred.", outside_horizon: "Izaberi datum u narednih 14 dana.", inactive_service: "Usluga više nije dostupna. Ponovo izaberi uslugu.", inactive_location: "Lokacija više nije dostupna. Ponovo izaberi lokaciju." };
const draftKey = "vule-booking-selection";
const withdrawnMessage = "Deo sačuvanog izbora više nije u ponudi. Preostale usluge su sačuvane. Pregledaj izbor i izaberi vreme.";
export function BookingForm({ locations, services, user, today, initial }: { locations: Location[]; services: Service[]; user: User; today: string; initial: { location?: string; service?: string; resume?: boolean } }) {
  const router = useRouter();
  const navigation = bookingNavigation(locations);
  const [location, setLocation] = useState(""), [selection, setSelection] = useState<string[]>([]);
  const [date, setDate] = useState(today), [start, setStart] = useState("");
  const [step, setStep] = useState(0), [ready, setReady] = useState(false), [needsReview, setNeedsReview] = useState(false);
  const [availability, setAvailable] = useState<(Availability & { query: string }) | null>(null), [loading, setLoading] = useState(false), [reload, setReload] = useState(0);
  const [other, setOther] = useState(false), [attendee, setAttendee] = useState("");
  const [attendeeError, setAttendeeError] = useState("");
  const attendeeInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [pending, setPending] = useState<Pending | null>(null);
  const [success, setSuccess] = useState<Appointment | null>(null), [notice, setNotice] = useState("");
  const panel = useRef<HTMLElement>(null), hydrated = useRef(""), submitting = useRef(false);
  useEffect(() => { if (ready) { const heading = panel.current?.querySelector("h2"); if (heading) { heading.tabIndex = -1; heading.focus(); } } }, [step, success, ready]);
  const pendingKey = `vule-booking-pending:${user?.id ?? "anonymous"}`;
  useEffect(() => {
    const entry = JSON.stringify([initial.location, initial.service, initial.resume, user?.id]);
    if (hydrated.current === entry) return;
    hydrated.current = entry;
    // Capture before the persistence effect can run for a changed URL/account.
    let saved: Draft | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "null"); } catch {}
    Promise.resolve().then(() => {
      // A matching URL on refresh restores the whole draft, including additions to a direct link.
      const legacyMatch = saved?.entryService === undefined && saved?.service && services.some(s => s.slug === initial.service && s.id === saved.service);
      const direct = !!initial.service && !initial.resume && saved?.entryService !== initial.service && !legacyMatch;
      const ids: string[] = direct ? services.filter(s => s.slug === initial.service).map(s => s.id)
        : Array.isArray(saved?.services) ? saved.services.filter((id: unknown): id is string => typeof id === "string")
        : typeof saved?.service === "string" && saved.service ? [saved.service] : [];
      const remaining = services.filter(s => ids.includes(s.id)).map(s => s.id);
      const withdrawn = (direct && !remaining.length) || remaining.length !== new Set(ids).size;
      const loc = bookingNavigation(locations, initial.location, saved?.location).location;
      setLocation(loc); setSelection(remaining);
      const validDate = typeof saved?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.date) && saved.date >= today && saved.date <= addCalendarDays(today, 14);
      if (validDate && saved?.date) setDate(saved.date);
      const restoredStart = !direct && validDate && !withdrawn && typeof saved?.start === "string" && Number.isFinite(Date.parse(saved.start)) ? saved.start : "";
      setStart(restoredStart);
      setOther(saved?.other === true); setAttendee(typeof saved?.attendee === "string" ? saved.attendee : "");
      const review = withdrawn || saved?.needsReview === true;
      setNeedsReview(review);
      if (review) setNotice(withdrawnMessage);
      setStep(!loc ? 0 : review || !remaining.length ? 1 : direct ? 2 : saved?.step === 1 ? 1 : saved?.step === 3 && restoredStart ? 3 : 2);
      try {
        const request = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null");
        // Validate without replacing the original object, order or legacy scalar format.
        if (user && parseConfirmation(request)) {
          setPending(request); setLocation(request.location); setStart(request.start); setDate(businessDate(request.start)); setStep(3);
          const requestIds: string[] = "services" in request ? request.services : [request.service];
          setSelection(services.filter(s => requestIds.includes(s.id)).map(s => s.id));
          setOther(!!request.attendee_name); setAttendee(request.attendee_name ?? ""); setNotice("");
        }
      } catch {}
      setReady(true);
    });
  }, [initial.location, initial.service, initial.resume, locations, services, today, user, pendingKey]);
  useEffect(() => {
    if (!ready || pending) return;
    const remaining = selection.filter(id => services.some(s => s.id === id));
    if (remaining.length !== selection.length) Promise.resolve().then(() => {
      setSelection(remaining); setStart(""); setNeedsReview(true); setStep(location ? 1 : 0); setNotice(withdrawnMessage);
    });
  }, [services, selection, ready, pending, location]);
  useEffect(() => { if (ready && !success && !pending) { try { sessionStorage.setItem(draftKey, JSON.stringify({ location, services: selection, date, start, step, other, attendee, needsReview, entryService: initial.service })); } catch {} } }, [location, selection, date, start, step, other, attendee, needsReview, initial.service, ready, success, pending]);
  const query = new URLSearchParams({ date, location }); selection.forEach(id => query.append("services", id));
  const queryString = query.toString();
  const catalogueSnapshot = JSON.stringify(selectionSnapshot(services, selection));
  const available = availability?.query === queryString ? availability : null;
  useEffect(() => {
    if (!ready || pending || !location || !selection.length) return;
    const controller = new AbortController();
    Promise.resolve().then(() => { if (!controller.signal.aborted) { setLoading(true); setAvailable(null); } });
    fetch(`/api/availability?${queryString}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body as Availability; })
      .then(data => { if (!controller.signal.aborted) {
        if (data.reason === "inactive_service") { setStart(""); setStep(1); setNeedsReview(true); setNotice(withdrawnMessage); router.refresh(); return; }
        const expected: ServiceSnapshot[] = JSON.parse(catalogueSnapshot);
        if (data.items && (data.items.length !== expected.length || data.items.some(item => !expected.some(s => s.service_id === item.service_id && s.service_name === item.service_name && s.duration_minutes === item.duration_minutes)))) {
          setStart(""); setStep(1); setNeedsReview(true); setNotice("Naziv ili trajanje usluga su promenjeni. Pregledaj osveženi izbor pre nastavka."); router.refresh(); return;
        }
        setAvailable({ ...data, query: queryString });
        setStart(current => {
          if (current && !data.slots.some(s => s.start === current)) { setError("Početak više nije dostupan za ovaj izbor. Izaberi drugo vreme; lokacija, datum i usluge su sačuvani."); return ""; }
          return current;
        });
      } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || "Slobodni termini trenutno nisu dostupni."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [queryString, catalogueSnapshot, selection.length, location, ready, reload, pending, router]);
  const selectedLocation = locations.find(l => l.id === location);
  const items: ServiceSnapshot[] = pending ? "services" in pending ? pending.expected_items
    : [{ service_id: pending.service, service_name: pending.expected_service_name, duration_minutes: pending.expected_duration }]
    : selectionSnapshot(services, selection);
  const total = pending?.expected_duration ?? items.reduce((sum, item) => sum + item.duration_minutes, 0);
  const slot = available?.slots.find(s => s.start === start);
  const end = start && total ? new Date(Date.parse(start) + total * 60000).toISOString() : "";
  const summary = <><p>Lokacija: <strong>{selectedLocation?.name ?? location}</strong></p><ul aria-label="Izabrane usluge">{items.map(item => <li key={item.service_id}>{item.service_name} · {item.duration_minutes} min</li>)}</ul><p aria-live="polite"><strong>Ukupno trajanje: {total} min</strong></p></>;
  function clearPending() { setPending(null); try { sessionStorage.removeItem(pendingKey); } catch {} }
  async function confirm() {
    if (submitting.current || !user || (!pending && (!user.complete || !slot || !items.length || !selectedLocation || needsReview))) return;
    if (!pending && other && (!attendee.trim() || [...attendee.trim()].length > 120)) { setAttendeeError("Unesi ime osobe koja dolazi (do 120 znakova)."); attendeeInput.current?.focus(); return; }
    submitting.current = true; setBusy(true); setError("");
    let request = pending;
    try {
      if (!request) {
        const response = await fetch(`/api/availability?${queryString}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const fresh = await response.json();
        if (!response.ok) throw new Error(fresh.error);
        if (fresh.reason === "inactive_service") { setStart(""); setStep(1); setNeedsReview(true); setNotice(withdrawnMessage); router.refresh(); return; }
        if (!fresh.slots.some((s: { start: string }) => s.start === start)) { setStart(""); setStep(2); setReload(n => n + 1); setError("Ovaj termin je upravo zauzet ili je raspored promenjen. Izaberi drugi slobodan termin."); return; }
        request = { request_key: crypto.randomUUID(), location, services: items.map(item => item.service_id), start, schedule_revision: fresh.schedule_revision, expected_items: items, expected_duration: total, attendee_name: other ? attendee.trim() : null };
        setPending(request); try { sessionStorage.setItem(pendingKey, JSON.stringify(request)); } catch {}
      }
      const response = await postBooking("/api/reservations", request);
      if (!response.ok) {
        setError(response.error);
        if (!response.retry_same_key) {
          clearPending();
          if (response.error === messages.inactive_service) { setStart(""); setStep(1); setNeedsReview(true); setNotice(withdrawnMessage); router.refresh(); }
          else if (response.status === 409) { setStart(""); setStep(1); setNeedsReview(true); setNotice("Pregledaj usluge i ponovo izaberi vreme."); setReload(n => n + 1); router.refresh(); }
        }
        return;
      }
      setSuccess(response.reservation); clearPending(); try { sessionStorage.removeItem(draftKey); } catch {}
    } catch { setError(request ? "Ishod potvrde još nije poznat. Proveri isti zahtev dugmetom ispod; nemoj zakazivati novi termin dok ne proveriš Moje termine." : "Dostupnost trenutno ne može da se proveri. Pokušaj ponovo."); }
    finally { submitting.current = false; setBusy(false); }
  }
  if (success) return <section ref={panel} className="booking-panel" aria-label="Potvrđena rezervacija"><p className="eyebrow">REZERVACIJA JE POTVRĐENA</p><h2>Vidimo se <em>uskoro.</em></h2><dl className="appointment-facts"><div><dt>Usluge</dt><dd>{success.service_name} · {success.duration_minutes} min</dd></div><div><dt>Lokacija</dt><dd>{success.location_name ?? selectedLocation?.name}</dd></div><div><dt>Termin</dt><dd>{dateLabel(success.starts_at)} · {timeLabel(success.starts_at)}–{timeLabel(success.ends_at)} ({offsetLabel(success.starts_at)})</dd></div><div><dt>Osoba</dt><dd>{success.attendee_name}</dd></div></dl><AppointmentServices items={success.items} total={success.duration_minutes} /><p>Potvrda je sačuvana u aplikaciji. Obaveštenja vidiš kada otvoriš Moje termine; ne šaljemo booking mejlove.</p><Link className="button" href="/moji-termini">Moji termini</Link></section>;
  return <section ref={panel} className="booking-panel" aria-label="Zakazivanje termina">
    <ol className="booking-progress">{navigation.steps.map((i, index) => <li key={i}><button type="button" aria-current={step === i ? "step" : undefined} disabled={!ready || busy || !!pending || (i > 0 && !location) || (i > 1 && (!items.length || needsReview)) || (i > 2 && (!slot || loading))} onClick={() => { setStep(i); setError(""); }}>{index + 1}. {["Lokacija", "Usluge", "Termin", "Pregled"][i]}</button></li>)}</ol>
    <p className="field-help">Vreme u Srbiji · izbor nije rezervacija niti zauzeće termina.</p>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="booking-empty">{notice}</p>}
    {!ready ? <p role="status">Učitavamo sačuvani izbor…</p> : <>
      {step === 0 && <><h2>Izaberi lokaciju</h2><div className="booking-options">{locations.map(l => <button type="button" className="booking-option" aria-pressed={location === l.id} key={l.id} onClick={() => { if (location !== l.id) { setLocation(l.id); setStart(""); } setStep(items.length && initial.service && !needsReview ? 2 : 1); setError(""); }}>{l.name}</button>)}</div></>}
      {step === 1 && <><h2>Usluge</h2><p>Izaberi jednu ili više usluga za jednu osobu.</p><p>Lokacija: <strong>{selectedLocation?.name}</strong></p><ServicePicker services={services} selected={selection} onChange={ids => { setSelection(ids); setError(""); }} /><button type="button" className="button" disabled={!items.length || busy} onClick={() => { setNeedsReview(false); setNotice(""); setStep(2); }}>Izaberi vreme</button></>}
      {step === 2 && <><h2>Izaberi datum i vreme</h2>{summary}<button type="button" className="text-button" disabled={busy} onClick={() => setStep(1)}>Dodaj ili promeni usluge</button><label className="booking-field">Datum<input type="date" min={today} max={addCalendarDays(today, 14)} value={date} onChange={e => { setDate(e.target.value); setStart(""); setError(""); }} /></label><button type="button" className="text-button" onClick={() => { setError(""); setReload(n => n + 1); }}>Osveži slobodne termine</button>
        {loading ? <p role="status">Proveravamo slobodne termine…</p> : available && !available.slots.length ? <p className="booking-empty">{messages[available.reason] ?? "Za ovaj izbor nema slobodnih termina."}</p> : <SlotPicker slots={available?.slots ?? []} selected={start} onChange={value => { setStart(value); setError(""); }} />}
        {slot && <p>Izbor: {dateLabel(start)} · {timeLabel(start)}–{timeLabel(slot.end)}</p>}
        <button type="button" className="button" disabled={!slot || loading || needsReview || !items.length} onClick={() => setStep(3)}>Pregled rezervacije</button></>}
      {step === 3 && <><h2>Proveri svoj izbor</h2>{summary}{!pending && <button type="button" className="text-button" disabled={busy} onClick={() => setStep(1)}>Dodaj ili promeni usluge</button>}<dl className="appointment-facts"><div><dt>Termin</dt><dd>{start && dateLabel(start)} · {start && timeLabel(start)}–{end && timeLabel(end)} ({start && offsetLabel(start)})</dd></div><div><dt>Kontakt</dt><dd>{user?.email ?? "Prijava je potrebna za potvrdu."}</dd></div></dl>
        {pending ? <><p role="status">Postoji zahtev nepoznatog ishoda. Najpre proveri isti sačuvani zahtev. <Link href="/moji-termini">Moji termini</Link></p><p>Osoba koja dolazi: <strong>{pending.attendee_name ?? user?.name}</strong></p><button type="button" className="button" disabled={busy} onClick={confirm}>{busy ? "Proveravamo potvrdu…" : "Proveri isti zahtev"}</button></> : !user ? <Link className="button" prefetch={false} href={`/prijava?next=${encodeURIComponent("/rezervacija?nastavi=1")}`}>Prijavi se i nastavi</Link> : !user.complete ? <Link className="button" prefetch={false} href={`/profil?next=${encodeURIComponent("/rezervacija?nastavi=1")}`}>Dopuni profil i nastavi</Link> : <><fieldset disabled={busy}><legend>Ko dolazi?</legend><label className="choice-line"><input type="radio" name="attendee" checked={!other} onChange={() => { setOther(false); setAttendeeError(""); }} /> Ja — {user.name}</label><label className="choice-line"><input type="radio" name="attendee" checked={other} onChange={() => { setOther(true); setAttendeeError(""); }} /> Druga osoba</label>{other && <label className="booking-field"><span id="booking-attendee-label">Ime osobe koja dolazi</span><input aria-labelledby="booking-attendee-label" ref={attendeeInput} maxLength={120} value={attendee} aria-invalid={!!attendeeError} aria-describedby="booking-attendee-error" onChange={e => { setAttendee(e.target.value); setAttendeeError(""); }} /><span id="booking-attendee-error" className="field-error" role={attendeeError ? "alert" : undefined}>{attendeeError}</span></label>}</fieldset><p className="field-help">Sve izabrane usluge pripadaju osobi koja dolazi: <strong>{other ? attendee || "Unesi ime" : user.name}</strong>. Otkazivanje je moguće najmanje 30 minuta pre početka.</p><button type="button" className="button" disabled={busy || !slot || loading || needsReview} onClick={confirm}>{busy ? "Proveravamo potvrdu…" : "Potvrdi rezervaciju"}</button></>}
      </>}
      {step > navigation.firstStep && <button type="button" className="back-link" disabled={busy || !!pending} onClick={() => { setStep(step - 1); setError(""); }}>← Prethodni korak</button>}
    </>}
  </section>;
}
