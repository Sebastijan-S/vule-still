"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { dateLabel, timeLabel, offsetLabel, postBooking, type Appointment, type Notice } from "@/lib/appointment-display";
export type AppointmentsState = { server_time: string; reservations: Appointment[]; notifications: Notice[] };
export function Appointments({ userId, phone, initialData }: { userId: string; phone: string | null; initialData: AppointmentsState }) {
  const [data, setData] = useState<AppointmentsState | null>(initialData), [error, setError] = useState(""), [message, setMessage] = useState(""), [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reservations", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setData(result); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Termini trenutno nisu dostupni."); return false; }
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
      setMessage("Rezervacija je otkazana. Termin je ponovo slobodan."); await load();
    } catch { setError("Ishod otkazivanja nije poznat. Osveži termine ili ponovi otkazivanje; sačuvani zahtev sprečava duplikate."); }
    finally { setBusy(""); }
  }
  async function mark(notice: Notice) {
    setBusy(notice.id); setError("");
    try { const response = await postBooking("/api/notifications/read", { notification: notice.id }); if (!response.ok) throw new Error(response.error); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Čitanje nije sačuvano. Pokušaj ponovo."); }
    finally { setBusy(""); }
  }
  const now = data ? Date.parse(data.server_time) : 0;
  const future = data?.reservations.filter(r => r.status === "confirmed" && Date.parse(r.starts_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) ?? [];
  const history = data?.reservations.filter(r => !future.includes(r)) ?? [];
  const card = (r: Appointment) => <article className="appointment-card" key={r.id} data-reservation={r.id}><div className="appointment-card-top"><h3>{r.service_name}</h3><span className={r.status === "cancelled" ? "status-cancelled" : "status-confirmed"}>{r.status === "cancelled" ? "Otkazana" : "Potvrđena"}</span></div><p><strong>{dateLabel(r.starts_at)} · {timeLabel(r.starts_at)}–{timeLabel(r.ends_at)}</strong> · {r.location_name}</p><p>{r.attendee_name} · {r.duration_minutes} min</p><details><summary>Detalji rezervacije</summary><dl className="appointment-facts"><div><dt>Vreme u Srbiji</dt><dd>{offsetLabel(r.starts_at)}</dd></div><div><dt>Kontakt naloga</dt><dd>{phone ?? "Telefon nije unet."}</dd></div><div><dt>Broj rezervacije</dt><dd>{r.id}</dd></div></dl>{r.cancellation_reason && <p>{r.cancellation_reason}</p>}</details>{r.status === "confirmed" && Date.parse(r.starts_at) >= now && (Date.parse(r.starts_at) - now >= 30 * 60000 ? <button type="button" className="outline-link" disabled={!!busy} onClick={() => cancel(r)}>{busy === r.id ? "Proveravamo…" : "Otkaži rezervaciju"}</button> : <p className="field-help">Za otkazivanje je ostalo manje od 30 minuta. Kontaktiraj salon; aplikacija ne dozvoljava kasno otkazivanje.</p>)}</article>;
  return <div className="appointments-layout"><div><div className="booking-toolbar"><Link className="button" href="/rezervacija">Nova rezervacija</Link><button type="button" className="text-button" disabled={!!busy} onClick={() => { setError(""); void load(); }}>Osveži termine</button></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}{!data ? !error && <p role="status">Učitavamo tvoje termine…</p> : <><section aria-labelledby="upcoming-title"><h2 id="upcoming-title">Budući termini</h2>{future.length ? future.map(card) : <p className="booking-empty">Nemaš budućih potvrđenih rezervacija.</p>}</section><section aria-labelledby="history-title"><h2 id="history-title">Prethodni i otkazani termini</h2>{history.length ? history.map(card) : <p className="booking-empty">Ovde će ostati istorija tvojih termina.</p>}</section></>}</div><aside className="notification-panel" aria-labelledby="notification-title"><h2 id="notification-title">Obaveštenja {data && <span className="unread-count">{data.notifications.filter(n => !n.read_at).length} nepročitanih</span>}</h2><p className="field-help">Promene su sačuvane ovde. Vidiš ih kada otvoriš aplikaciju; nema mejlova niti podsetnika.</p>{data?.notifications.length === 0 && <p>Nema novih obaveštenja.</p>}{data?.notifications.map(n => <article className={`notification${n.read_at ? "" : " is-unread"}`} key={n.id}><p><strong>{n.read_at ? "Pročitano" : "Nepročitano"}</strong> · {dateLabel(n.created_at)} {timeLabel(n.created_at)}</p><p>{n.message}</p><small>Rezervacija {n.reservation_id.slice(0, 8)}</small>{!n.read_at && <button className="text-button" type="button" disabled={!!busy} onClick={() => mark(n)}>Označi kao pročitano</button>}</article>)}</aside></div>;
}
