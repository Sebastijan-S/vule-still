"use client";
import Link from "next/link";
import { AppointmentServices } from "@/components/appointment-services";
import { useCallback, useEffect, useState } from "react";
import { dateLabel, timeLabel, offsetLabel, postBooking, type Appointment, type Notice } from "@/lib/appointment-display";
export type AppointmentsState = { server_time: string; reservations: Appointment[]; notifications: Notice[] };
export function Appointments({ userId, contact, initialData }: { userId: string; contact: string | null; initialData: AppointmentsState }) {
  const [{ data, receivedAt }, setSnapshot] = useState(() => ({ data: initialData, receivedAt: 0 }));
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState("");
  const [elapsed, setElapsed] = useState(0);
  // Advance from server time, including after a background tab resumes. The API
  // remains authoritative for the 30-minute cancellation boundary.
  useEffect(() => {
    const origin = receivedAt || Date.now();
    const update = () => setElapsed(Math.max(0, Date.now() - origin));
    const interval = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", update); };
  }, [receivedAt]);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reservations", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json(); if (!response.ok) { setError(result.error ?? "Termini trenutno nisu dostupni. Pokušaj ponovo."); return false; }
      setSnapshot({ data: result, receivedAt: Date.now() }); setElapsed(0); return true;
    } catch { setError("Ne možemo da osvežimo termine. Prethodni prikaz je sačuvan. Proveri vezu i pokušaj ponovo."); return false; }
  }, []);
  async function cancel(r: Appointment) {
    if (!window.confirm(`Otkaži ${r.service_name}, ${dateLabel(r.starts_at)} u ${timeLabel(r.starts_at)}? Novi termin se rezerviše zasebno.`)) return;
    setBusy(r.id); setError(""); setMessage("");
    const storageKey = `vule-cancel:${userId}:${r.id}`;
    let requestKey: string;
    try { requestKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID(); sessionStorage.setItem(storageKey, requestKey); } catch { requestKey = crypto.randomUUID(); }
    try {
      const response = await postBooking("/api/reservations/cancel", { request_key: requestKey, reservation: r.id });
      if (!response.ok) { setError(response.error); if (!response.retry_same_key) { try { sessionStorage.removeItem(storageKey); } catch {} } return; }
      try { sessionStorage.removeItem(storageKey); } catch {}
      setMessage("Rezervacija je otkazana. Termin je ponovo slobodan. Sačuvana je u istoriji.");
      if (await load()) document.getElementById("upcoming-title")?.focus();
    } catch { setError("Ishod otkazivanja nije poznat. Osveži termine ili ponovi otkazivanje; sačuvani zahtev sprečava duplikate."); }
    finally { setBusy(""); }
  }
  async function mark(notice: Notice) {
    setBusy(notice.id); setError("");
    try {
      const response = await postBooking("/api/notifications/read", { notification: notice.id });
      if (!response.ok) throw new Error(response.error);
      setMessage("Obaveštenje je označeno kao pročitano. Dostupno je u pročitanim obaveštenjima.");
      if (await load()) document.getElementById("notification-title")?.focus();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Čitanje nije sačuvano. Pokušaj ponovo."); }
    finally { setBusy(""); }
  }
  const now = Date.parse(data.server_time) + elapsed;
  const future = data.reservations.filter(r => r.status === "confirmed" && Date.parse(r.starts_at) >= now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const history = data.reservations.filter(r => !future.includes(r)).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  const unread = data.notifications.filter(n => !n.read_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const read = data.notifications.filter(n => n.read_at).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const card = (r: Appointment) => <article className="appointment-card" key={r.id} data-reservation={r.id}><div className="appointment-card-top"><h3>{r.service_name}</h3><span className={r.status === "cancelled" ? "status-cancelled" : "status-confirmed"}>{r.status === "cancelled" ? "Otkazana" : "Potvrđena"}</span></div><p><strong><time dateTime={r.starts_at}>{dateLabel(r.starts_at)} · {timeLabel(r.starts_at)}</time>–{timeLabel(r.ends_at)}</strong> · {r.location_name}</p><p>Dolazi: <strong>{r.attendee_name}</strong> · {r.duration_minutes} min</p><AppointmentServices items={r.items} total={r.duration_minutes} /><details><summary>Detalji rezervacije</summary><dl className="appointment-facts"><div><dt>Vreme u Srbiji</dt><dd>{offsetLabel(r.starts_at)}</dd></div><div><dt>Kontakt naloga</dt><dd>{contact ?? "Kontakt nije unet."}</dd></div><div><dt>Broj rezervacije</dt><dd>{r.id}</dd></div></dl>{r.cancellation_reason && <p>{r.cancellation_reason}</p>}</details>{r.status === "confirmed" && Date.parse(r.starts_at) >= now && (Date.parse(r.starts_at) - now >= 30 * 60000 ? <button type="button" className="outline-link danger-text" disabled={!!busy} onClick={() => cancel(r)}>{busy === r.id ? "Proveravamo…" : "Otkaži rezervaciju"}</button> : <p className="field-help">Za otkazivanje je ostalo manje od 30 minuta. Kontaktiraj salon; aplikacija ne dozvoljava kasno otkazivanje.</p>)}</article>;
  const notification = (n: Notice) => <article className={`notification${n.read_at ? "" : " is-unread"}`} key={n.id} data-notification={n.id}><p><strong>{n.read_at ? "Pročitano" : "Nepročitano"}</strong> · <time dateTime={n.created_at}>{dateLabel(n.created_at)} {timeLabel(n.created_at)}</time></p><p>{n.message}</p><AppointmentServices items={n.items} total={n.duration_minutes ?? 0} /><small>Rezervacija {n.reservation_id.slice(0, 8)}</small>{!n.read_at && <button className="text-button" type="button" disabled={!!busy} onClick={() => mark(n)}>Označi kao pročitano</button>}</article>;
  async function refresh() {
    setBusy("refresh"); setError(""); setMessage("");
    await load(); setBusy("");
  }
  return <><div className="booking-toolbar"><Link className="button" href="/rezervacija">Nova rezervacija</Link><button type="button" className="text-button" disabled={!!busy} onClick={refresh}>{busy === "refresh" ? "Učitavamo…" : "Osveži termine"}</button></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<div className="appointments-layout customer-appointments">
    <section className="next-visit" aria-labelledby="upcoming-title"><h2 tabIndex={-1} id="upcoming-title">Naredni dolazak</h2>{future.length ? card(future[0]) : <p className="booking-empty">Nemaš budućih potvrđenih rezervacija.</p>}</section>
    <aside className="notification-panel" aria-labelledby="notification-title"><h2 tabIndex={-1} id="notification-title">Nepročitane promene <span className="unread-count">{unread.length} nepročitanih</span></h2><p className="field-help">Potvrde i promene vidiš ovde kada otvoriš aplikaciju. Nema mejlova niti podsetnika.</p>{unread.length ? unread.map(notification) : <p className="booking-empty">Nema nepročitanih promena.</p>}<details className="account-disclosure read-notifications"><summary>Pročitana obaveštenja ({read.length})</summary>{read.length ? read.map(notification) : <p className="booking-empty">Ovde će ostati pročitana obaveštenja.</p>}</details></aside>
    {future.length > 1 && <section className="other-visits" aria-labelledby="other-visits-title"><h2 id="other-visits-title">Ostali budući termini ({future.length - 1})</h2>{future.slice(1).map(card)}</section>}
    <details className="account-disclosure appointment-history"><summary>Prethodni i otkazani termini ({history.length})</summary>{history.length ? history.map(card) : <p className="booking-empty">Ovde će ostati istorija tvojih termina.</p>}</details>
  </div></>;
}
