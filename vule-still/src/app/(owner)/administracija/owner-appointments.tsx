"use client";
import { AppointmentServices } from "@/components/appointment-services";
import { ServicePicker, selectionSnapshot } from "@/components/service-picker";
import { useEffect, useRef, useState } from "react";
import { addCalendarDays } from "@/lib/availability";
import { businessDate, dateLabel, timeLabel, offsetLabel, postBooking, type Appointment } from "@/lib/appointment-display";
import type { parseOwnerMutation } from "@/lib/owner-booking";
type Mutation = NonNullable<ReturnType<typeof parseOwnerMutation>>;
type Location = { id: string; name: string };
type Service = { id: string; name: string; duration_minutes: number };
type Availability = { reason: string; schedule_revision: number; slots: { start: string; end: string; local_start: string }[] };
export type OwnerState = { server_time: string; reservations: Appointment[] };

function ReservationForm({ row, day, today, locations, services, disabled, onSubmit, onClose }: { row: Appointment | null; day: string; today: string; locations: Location[]; services: Service[]; disabled: boolean; onSubmit: (value: Mutation) => void; onClose: () => void }) {
  const formPanel = useRef<HTMLElement>(null);
  useEffect(() => { formPanel.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, []);
  const [location, setLocation] = useState(row?.location_id ?? locations[0]?.id ?? ""), [selection, setSelection] = useState<string[]>([]);
  const [date, setDate] = useState(row ? businessDate(row.starts_at) : day < today ? today : day), [start, setStart] = useState(row ? new Date(row.starts_at).toISOString() : "");
  const [name, setName] = useState(row?.attendee_name ?? ""), [phone, setPhone] = useState(row?.user_id ? "" : row?.phone ?? "");
  const [availability, setAvailability] = useState<Availability | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const query = new URLSearchParams({ date, location });
  selection.forEach(id => query.append("services", id));
  const path = row ? `/api/owner/availability?date=${date}&location=${location}&reservation=${row.id}` : `/api/availability?${query}`;
  const [loadedPath, setLoadedPath] = useState("");
  useEffect(() => {
    if (!row && !selection.length) return;
    const controller = new AbortController();
    Promise.resolve().then(() => { setLoading(true); setAvailability(null); setError(""); });
    fetch(path, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as Availability; })
      .then(result => { if (!controller.signal.aborted) { setAvailability(result); setLoadedPath(path); setStart(current => result.slots.some(s => s.start === current) ? current : ""); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message ?? "Slobodni termini trenutno nisu dostupni."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, selection.length, row, reload]);
  const items = selectionSnapshot(services, selection);
  const total = row?.duration_minutes ?? items.reduce((sum, item) => sum + item.duration_minutes, 0);
  const current = loadedPath === path && (row || selection.length) ? availability : null;
  const slot = current?.slots.find(s => s.start === start);
  return <section ref={formPanel} className="booking-panel owner-form" aria-label={row ? "Izmena rezervacije" : "Ručna rezervacija"}><h2>{row ? "Izmeni rezervaciju" : "Ručna rezervacija"}</h2><p className="field-help">{row?.user_id ? "Termin je povezan sa nalogom. Kontakt se čita iz trenutnog profila, a promena ostaje u obaveštenjima klijenta." : "Gost nema nalog i neće dobiti obaveštenje u aplikaciji. Dovoljno je ime; kontakt je opcion."}</p>{row && <p>Sačuvana usluga: <strong>{row.service_name} · {row.duration_minutes} min</strong>. Za promenu usluge otkaži termin i unesi novi.</p>}
    {row && <AppointmentServices items={row.items} total={row.duration_minutes} />}{error && <p className="form-error" role="alert">{error}</p>}
    <form onSubmit={event => {
      event.preventDefault(); if (!current || !slot || disabled || loading) return;
      const common = { request_key: crypto.randomUUID(), location, start, schedule_revision: current.schedule_revision, name: name.trim(), phone: phone.trim() || null };
      if (row) onSubmit({ ...common, operation: "update", reservation: row.id, version: row.version });
      else if (items.length) onSubmit({ ...common, operation: "create", services: items.map(item => item.service_id), expected_items: items, expected_duration: total });
    }}>
      <fieldset disabled={disabled}><legend className="sr-only">Podaci rezervacije</legend>
        <label className="booking-field">Ime osobe koja dolazi<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        {!row?.user_id && <label className="booking-field">Telefon gosta (opciono)<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={40} placeholder="064… ili međunarodni pozivni kod" /><span className="field-help">Srpski lokalni broj ili međunarodni broj sa +.</span></label>}
        <label className="booking-field">Lokacija rezervacije<select value={location} onChange={e => { setLocation(e.target.value); setStart(""); }}>{locations.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
        {!row && <><p>Sve izabrane usluge pripadaju jednoj osobi koja dolazi.</p><ServicePicker services={services} selected={selection} onChange={setSelection} /></>}
        <label className="booking-field">Datum rezervacije<input type="date" value={date} min={today} max={addCalendarDays(today, 14)} onChange={e => { setDate(e.target.value); setStart(""); }} required /></label>
        <button type="button" className="text-button" onClick={() => setReload(n => n + 1)}>Osveži slobodne termine</button>
        {!row && !items.length ? <p>Izaberi najmanje jednu uslugu.</p> : loading ? <p role="status">Proveravamo dostupnost…</p> : current && !current.slots.length ? <p className="booking-empty">{current.reason === "unpublished" ? "Raspored još nije objavljen." : "Nema slobodnog termina za ovaj izbor. Proveri datum ili lokaciju."}</p> : <div className="slot-options" aria-label="Slobodni termini za vlasnika">{current?.slots.map(s => <button type="button" key={s.start} aria-pressed={start === s.start} onClick={() => setStart(s.start)}>{s.local_start}<small>{offsetLabel(s.start)}</small></button>)}</div>}
        {slot && <p>Izbor: {dateLabel(start)} · {timeLabel(start)}–{timeLabel(slot.end)} · ukupno {total} min</p>}
        <p className="field-help">Važe objavljene smene, 15 minuta do novog početka i horizont 14 dana. Postojeći termin se može menjati najmanje 30 minuta pre početka.</p>
        <div className="booking-toolbar"><button className="button" type="submit" disabled={!name.trim() || !slot || loading || disabled}>{row ? "Sačuvaj izmenu" : "Potvrdi ručni termin"}</button><button type="button" className="text-button" onClick={onClose} disabled={disabled}>Odustani</button></div>
      </fieldset>
    </form>
  </section>;
}
export function OwnerAppointments({ userId, today, locations, services, initialData }: { userId: string; today: string; locations: Location[]; services: Service[]; initialData: OwnerState }) {
  const [data, setData] = useState(initialData), [date, setDate] = useState(today), [view, setView] = useState("day"), [filter, setFilter] = useState(""), [status, setStatus] = useState("");
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [pending, setPending] = useState<Mutation | null>(null);
  const [editing, setEditing] = useState<Appointment | "new" | null>(null);
  const storageKey = `vule-owner-pending:${userId}`;
  useEffect(() => { Promise.resolve().then(() => { try { const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); if (saved?.request_key && ["create", "update", "cancel"].includes(saved.operation)) setPending(saved); } catch {} }); }, [storageKey]);
  async function load(day = date, mode = view) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/owner/reservations?from=${day}&to=${mode === "week" ? addCalendarDays(day, 6) : day}`, { cache: "no-store", signal: AbortSignal.timeout(15000) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pokušaj ponovo."); }
    finally { setBusy(false); }
  }
  async function mutate(body: Mutation) {
    setBusy(true); setError(""); setMessage(""); setPending(body);
    try { sessionStorage.setItem(storageKey, JSON.stringify(body)); } catch {}
    try {
      const result = await postBooking("/api/owner/reservations", body);
      if (!result.ok) { setError(result.error); if (!result.retry_same_key) { setPending(null); try { sessionStorage.removeItem(storageKey); } catch {} } return; }
      setPending(null); try { sessionStorage.removeItem(storageKey); } catch {}
      setEditing(null); const day = businessDate(result.reservation.starts_at); setDate(day); setStatus("");
      setMessage(body.operation === "cancel" ? "Rezervacija je otkazana." : body.operation === "update" ? "Izmena je sačuvana." : "Ručni termin je potvrđen. Gost bez naloga nema obaveštenje u aplikaciji.");
      await load(day);
    } catch { setError("Ishod zahteva nije poznat. Proveri isti zahtev dugmetom ispod pre nove izmene; ne unosi drugi ručni termin."); }
    finally { setBusy(false); }
  }
  const visible = data.reservations.filter(r => (!filter || r.location_id === filter) && (!status || r.status === status)), now = Date.parse(data.server_time);
  return <><div className="booking-toolbar"><button type="button" className="button" disabled={busy || !!pending} onClick={() => { setEditing("new"); setError(""); setMessage(""); }}>Dodaj ručni termin</button><button className="text-button" type="button" disabled={busy} onClick={() => void load()}>Osveži pregled</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
    {pending && <div className="booking-empty" role="status"><p>Postoji nedovršen zahtev. Proveri ga pre nove radnje; ponavlja se isti ključ.</p><button type="button" className="button" disabled={busy} onClick={() => void mutate(pending)}>Proveri isti zahtev</button></div>}
    <p className="field-help">Ručni termin rezerviše dolazak klijenta. Radne smene i slobodne periode uređuj kroz „Radno vreme“.</p><div className="booking-toolbar"><button type="button" className="outline-link" disabled={busy} onClick={() => { setDate(today); void load(today); }}>Danas</button><button type="button" className="outline-link" disabled={busy} onClick={() => { const next = addCalendarDays(today, 1); setDate(next); void load(next); }}>Sutra</button></div>
    <div className="owner-filters"><label className="booking-field">Datum pregleda<input type="date" value={date} disabled={busy} onChange={e => { if (e.target.value) { setDate(e.target.value); void load(e.target.value); } }} /></label><label className="booking-field">Prikaz<select value={view} disabled={busy} onChange={e => { setView(e.target.value); void load(date, e.target.value); }}><option value="day">Dan</option><option value="week">Sedam dana od izabranog datuma</option></select></label><label className="booking-field">Filter lokacije<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">Obe lokacije</option>{locations.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label><label className="booking-field">Filter statusa<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Svi statusi</option><option value="confirmed">Potvrđene</option><option value="cancelled">Otkazane</option></select></label></div>
    <p className="field-help">Jedan frizer: zauzetost na obe lokacije proverava se zajedno. Ukupno potvrđenih u periodu: {data.reservations.filter(r => r.status === "confirmed").length}; prikazano: {visible.length}. Otkazane rezervacije ostaju u pregledu.</p>
    {editing && <ReservationForm key={editing === "new" ? "new" : editing.id} row={editing === "new" ? null : editing} day={date} today={today} locations={locations} services={services} disabled={busy || !!pending} onSubmit={body => void mutate(body)} onClose={() => setEditing(null)} />}
    <section aria-label="Pregled rezervacija" className="owner-reservations">{busy && <p role="status">Proveravamo podatke…</p>}{!visible.length && <p className="booking-empty">Nema rezervacija za izabrani period i lokaciju.</p>}{visible.map(r => <article className="appointment-card" data-reservation={r.id} key={r.id}><div className="appointment-card-top"><h2>{dateLabel(r.starts_at)} · {timeLabel(r.starts_at)}–{timeLabel(r.ends_at)}</h2><span className={r.status === "cancelled" ? "status-cancelled" : "status-confirmed"}>{r.status === "cancelled" ? "Otkazana" : "Potvrđena"}</span></div><h3>{r.attendee_name}</h3><p className="owner-contact">{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : "Kontakt nije unet."}</p><p>{r.location_name} · {r.service_name} · {r.duration_minutes} min</p><AppointmentServices items={r.items} total={r.duration_minutes} /><details><summary>Detalji i kontakt</summary><dl className="appointment-facts"><div><dt>Telefon</dt><dd>{r.phone ?? "Kontakt nije unet."}</dd></div><div><dt>Nalog</dt><dd>{r.user_id ? r.email ?? "Povezan nalog" : "Ručni gost — nema naloga ni obaveštenja u aplikaciji."}</dd></div><div><dt>Sačuvana usluga</dt><dd>{r.service_name} · {r.duration_minutes} min</dd></div></dl>{r.cancellation_reason && <p>{r.cancellation_reason}</p>}</details>{r.status === "confirmed" && Date.parse(r.starts_at) - now >= 30 * 60000 ? <div className="booking-toolbar"><button className="outline-link" type="button" disabled={busy || !!pending} onClick={() => { setEditing(r); setError(""); setMessage(""); }}>Izmeni termin</button><button className="text-button" type="button" disabled={busy || !!pending} onClick={() => { if (window.confirm(`Otkaži ${r.attendee_name}, ${dateLabel(r.starts_at)} u ${timeLabel(r.starts_at)}?`)) void mutate({ operation: "cancel", request_key: crypto.randomUUID(), reservation: r.id }); }}>Otkaži termin</button></div> : r.status === "confirmed" && <p className="field-help">Termin je blizu početka ili je već započet/prošao. Redovna izmena i otkazivanje više nisu dostupni.</p>}</article>)}</section>
  </>;
}
