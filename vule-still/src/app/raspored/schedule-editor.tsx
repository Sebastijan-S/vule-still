"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Break = { start_minute: number; end_minute: number };
type Shift = { date: string; location_id: string; start_minute: number; end_minute: number; breaks: Break[] };
type Week = { draft: Shift[]; draft_revision: number; published: Shift[] | null; published_revision: number; travel_gap_minutes: number; published_gap_minutes: number | null };
type Location = { id: string; name: string };
type Editing = { index: number | null; shift: Shift };
const labels = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const shortLabels = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const pad = (n: number) => String(n).padStart(2, "0");
const toTime = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
const fromTime = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
};
const localDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
const dateLabel = (date: string) => new Intl.DateTimeFormat("sr-Latn-RS", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
function parseWeek(value: unknown): Week | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const w = value as Partial<Week>;
  if (!Array.isArray(w.draft) || typeof w.draft_revision !== "number" || typeof w.travel_gap_minutes !== "number") return null;
  return w as Week;
}

function ShiftDialog({ editing, location, onApply, onRemove, onClose }: {
  editing: Editing; location: string; onApply: (shift: Shift) => void; onRemove: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shift, setShift] = useState(() => structuredClone(editing.shift));
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close() { dialog.current?.close(); onClose(); }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    const breaks = [...shift.breaks].sort((a, b) => a.start_minute - b.start_minute);
    let previousEnd = shift.start_minute;
    if (!(shift.start_minute >= 0 && shift.end_minute <= 1440 && shift.end_minute > shift.start_minute)) {
      setError("Kraj smene mora biti posle početka, u istom danu."); return;
    }
    for (const pause of breaks) {
      if (!(pause.start_minute >= previousEnd && pause.end_minute > pause.start_minute && pause.end_minute <= shift.end_minute)) {
        setError("Pauze moraju biti unutar smene i bez međusobnog preklapanja."); return;
      }
      previousEnd = pause.end_minute;
    }
    dialog.current?.close();
    onApply({ ...shift, breaks });
  }
  return <dialog ref={dialog} className="shift-dialog" aria-labelledby="shift-title" onCancel={event => { event.preventDefault(); close(); }} onClose={onClose}>
    <form onSubmit={apply}>
      <div className="shift-dialog-heading"><div><p className="eyebrow">{location}</p><h2 id="shift-title">{editing.index === null ? "Nova smena" : "Izmeni smenu"}</h2><p className="muted">{dateLabel(shift.date)}</p></div><button type="button" className="calendar-icon-button" aria-label="Zatvori izmenu smene" onClick={close}>×</button></div>
      <div className="shift-time-fields"><label>Početak smene<input type="time" required value={toTime(shift.start_minute)} onChange={e => setShift({ ...shift, start_minute: fromTime(e.target.value) })} /></label><label>Kraj smene<input type="time" required value={toTime(shift.end_minute % 1440)} onChange={e => setShift({ ...shift, end_minute: fromTime(e.target.value) || 1440 })} /></label></div>
      <p className="field-help">Kraj u 00:00 označava ponoć na kraju izabranog dana.</p>
      <div className="shift-break-heading"><h3>Pauze</h3><button type="button" className="text-button" disabled={shift.breaks.length >= 12} onClick={() => setShift({ ...shift, breaks: [...shift.breaks, { start_minute: shift.start_minute + 60, end_minute: shift.start_minute + 80 }] })}>+ Dodaj pauzu</button></div>
      {!shift.breaks.length && <p className="muted">Nema pauza u ovoj smeni.</p>}
      {shift.breaks.map((pause, index) => <div className="shift-break-fields" key={index}><label>Pauza {index + 1} od<input type="time" required value={toTime(pause.start_minute)} onChange={e => setShift({ ...shift, breaks: shift.breaks.map((b, i) => i === index ? { ...b, start_minute: fromTime(e.target.value) } : b) })} /></label><label>Pauza {index + 1} do<input type="time" required value={toTime(pause.end_minute % 1440)} onChange={e => setShift({ ...shift, breaks: shift.breaks.map((b, i) => i === index ? { ...b, end_minute: fromTime(e.target.value) || 1440 } : b) })} /></label><button type="button" className="calendar-icon-button" aria-label={`Ukloni pauzu ${index + 1}`} onClick={() => setShift({ ...shift, breaks: shift.breaks.filter((_, i) => i !== index) })}>×</button></div>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="shift-dialog-actions">{editing.index !== null && <button type="button" className="text-button danger-text" onClick={() => { dialog.current?.close(); onRemove(); }}>Ukloni smenu</button>}<button type="button" className="text-button" onClick={close}>Odustani</button><button className="button" type="submit">Primeni u nacrtu</button></div>
    </form>
  </dialog>;
}

export function ScheduleEditor({ locations }: { locations: Location[] }) {
  const [monday, setMonday] = useState(() => mondayOf(localDate()));
  const [week, setWeek] = useState<Week | null>(null);
  const [draft, setDraft] = useState<Shift[]>([]);
  const [gap, setGap] = useState(60);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<"draft" | "published">("draft");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [db] = useState(createClient);
  const dirty = !!week && (JSON.stringify(draft) !== JSON.stringify(week.draft) || gap !== week.travel_gap_minutes);
  useEffect(() => {
    let live = true;
    Promise.resolve(db.rpc("get_owner_schedule", { p_week: monday }).abortSignal(AbortSignal.timeout(15000))).then(({ data, error: requestError }) => {
      if (!live) return;
      setLoading(false);
      if (requestError) { setError("Raspored trenutno nije dostupan. Pokušaj ponovo."); return; }
      const next = parseWeek(data); setWeek(next); setDraft(next?.draft ?? []); setGap(next?.travel_gap_minutes ?? 60);
      setError(""); setMessage("");
    }).catch(() => { if (live) { setLoading(false); setError("Veza je prekinuta. Pokušaj ponovo."); } });
    return () => { live = false; };
  }, [monday, db, reload]);
  function changeWeek(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (dirty && !window.confirm("Nacrt ima nesačuvane izmene. Pređi na drugu nedelju i odbaci ih?")) return;
    setLoading(true); setWeek(null); setDraft([]); setView("draft"); setMessage(""); setError(""); setMonday(mondayOf(date)); setReload(n => n + 1);
  }
  async function prepare() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: requestError } = await db.rpc("prepare_schedule_week", { p_week: monday }).abortSignal(AbortSignal.timeout(12000));
      if (requestError) throw requestError;
      const next = parseWeek(data); if (!next) throw new Error("Invalid schedule");
      setWeek(next); setDraft(next.draft); setGap(next.travel_gap_minutes);
      setMessage("Početni raspored je pripremljen kao nacrt. Još nije objavljen.");
    } catch { setError("Nacrt nije pripremljen. Proveri vezu i pokušaj ponovo."); } finally { setBusy(false); }
  }
  async function save() {
    if (!week) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: requestError } = await db.rpc("save_schedule_draft", { p_week: monday, p_expected_revision: week.draft_revision, p_entries: draft, p_gap: gap }).abortSignal(AbortSignal.timeout(12000));
      if (requestError) throw requestError;
      const saved = structuredClone(draft);
      setWeek({ ...week, draft: saved, draft_revision: data, travel_gap_minutes: gap }); setDraft(saved);
      setMessage("Nacrt je sačuvan. Objavljeni raspored nije promenjen.");
    } catch { setError("Čuvanje nije potvrđeno. Proveri smene, pauze i razmak između lokacija. Osveži stranicu pre ponovnog čuvanja da vidiš poslednju sačuvanu verziju."); } finally { setBusy(false); }
  }
  async function publish() {
    if (!week || dirty) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: requestError } = await db.rpc("publish_schedule_week", { p_week: monday, p_expected_revision: week.draft_revision }).abortSignal(AbortSignal.timeout(12000));
      if (requestError) throw requestError;
      setWeek({ ...week, published: structuredClone(week.draft), published_revision: data, published_gap_minutes: gap });
      setMessage("Raspored je objavljen za obe lokacije.");
    } catch { setError("Objava nije potvrđena. Osveži raspored da proveriš objavljenu verziju pre ponovnog pokušaja."); } finally { setBusy(false); }
  }
  function addShift(date: string, location: Location) {
    const start = location.name === "Neuzin" ? 1020 : 600;
    setEditing({ index: null, shift: { date, location_id: location.id, start_minute: start, end_minute: location.name === "Neuzin" ? 1200 : 900, breaks: [] } });
  }
  const entries = view === "draft" ? draft : week?.published ?? [];
  const startHour = Math.min(8, ...entries.map(s => Math.floor(s.start_minute / 60)));
  const endHour = Math.max(21, ...entries.map(s => Math.ceil(s.end_minute / 60)));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const range = (endHour - startHour) * 60;
  return <>
    <p className="eyebrow">ADMINISTRACIJA · RASPORED RADA</p><h1>Dve lokacije.<br /><em>Jedan raspored.</em></h1><p className="muted">Pripremi smene u kalendaru svake lokacije. Termini se otvaraju tek kada objaviš nedelju.</p>
    <div className="schedule-toolbar"><div className="schedule-week-nav"><button type="button" className="calendar-icon-button" aria-label="Prethodna nedelja" disabled={busy || loading} onClick={() => changeWeek(addDays(monday, -7))}>←</button><label className="schedule-date-label"><span>{dateLabel(monday)} — {dateLabel(addDays(monday, 6))}</span><input aria-label="Izaberi nedelju" type="date" value={monday} disabled={busy || loading} onChange={e => changeWeek(e.target.value)} /></label><button type="button" className="calendar-icon-button" aria-label="Sledeća nedelja" disabled={busy || loading} onClick={() => changeWeek(addDays(monday, 7))}>→</button></div><button type="button" className="text-button" disabled={busy || loading} onClick={() => changeWeek(localDate())}>Ova nedelja</button></div>
    {error && <div className="form-error" role="alert">{error}{!week && <button className="text-button" type="button" onClick={() => { setLoading(true); setError(""); setReload(n => n + 1); }}>Pokušaj ponovo</button>}</div>}{message && <p className="form-success" role="status">{message}</p>}
    {loading ? <p className="page-loading" role="status">Učitavamo kalendare…</p> : !week ? !error && <div className="empty-state"><h2>Nedelja još nije pripremljena.</h2><p>Pripremi kalendare za Zrenjanin i Neuzin iz početnog šablona. Nedelja ostaje zatvorena dok je ne objaviš.</p><button className="button" disabled={busy} onClick={prepare}>Pripremi nedelju</button></div> : <>
      <div className="schedule-meta"><div className="schedule-view" aria-label="Verzija rasporeda"><button type="button" aria-pressed={view === "draft"} onClick={() => setView("draft")}>Nacrt <span>v{week.draft_revision}</span></button><button type="button" aria-pressed={view === "published"} onClick={() => setView("published")}>Objavljeno <span>{week.published ? `v${week.published_revision}` : "—"}</span></button></div><span className={`schedule-badge${dirty ? " is-dirty" : ""}`}>{dirty ? "Nesačuvane izmene" : week.published ? "Objavljena verzija je aktivna" : "Nedelja još nije objavljena"}</span></div>
      <div className="schedule-controls"><label>Razmak između lokacija (min)<input type="number" min="0" step="1" disabled={busy || view === "published"} value={view === "published" ? week.published_gap_minutes ?? gap : gap} onChange={e => setGap(Number(e.target.value))} /></label><p className="field-help">Jedan frizer radi na obe lokacije. Smene se ne smeju preklapati.</p></div>
      {view === "published" && !week.published ? <div className="empty-state"><h2>Raspored još nije objavljen.</h2><p>Vrati se na nacrt, sačuvaj izmene i objavi nedelju.</p></div> : <div className="location-calendars">{locations.map((location, locationIndex) => <section key={location.id} className={`location-calendar location-calendar-${locationIndex}`} aria-labelledby={`calendar-${location.id}`}>
        <div className="calendar-heading"><div><p className="eyebrow">LOKACIJA {pad(locationIndex + 1)}</p><h2 id={`calendar-${location.id}`}>{location.name}</h2></div><p>{view === "draft" ? "Nacrt nedelje" : "Objavljeni raspored"}<span>Vreme u Srbiji · 24h</span></p></div>
        <p className="calendar-help">{view === "draft" ? "Izaberi smenu za izmenu ili + za novu smenu." : "Ovo je raspored koji određuje dostupnost termina."}<span> Na telefonu prevuci kalendar ulevo ili udesno.</span></p>
        <div className="calendar-scroll" tabIndex={0} role="region" aria-label={`Nedeljni kalendar — ${location.name}`}><div className="calendar-grid">
          <div className="calendar-corner">SATI</div>{labels.map((label, day) => { const date = addDays(monday, day); return <div className={`calendar-day-label${date === localDate() ? " is-today" : ""}`} key={date}><span><abbr title={label}>{shortLabels[day]}</abbr><strong>{Number(date.slice(8))}.{Number(date.slice(5, 7))}.</strong></span>{view === "draft" && <button type="button" aria-label={`Dodaj smenu — ${location.name}, ${label}`} disabled={busy || draft.length >= 28} onClick={() => addShift(date, location)}>+</button>}</div>; })}
          <div className="calendar-hours" style={{ height: (endHour - startHour) * 44 }}>{hours.map(hour => <span key={hour} style={{ top: (hour - startHour) * 44 }}>{pad(hour)}:00</span>)}</div>
          {labels.map((label, day) => { const date = addDays(monday, day); const shifts = entries.map((shift, index) => ({ shift, index })).filter(({ shift }) => shift.date === date && shift.location_id === location.id); return <div className={`calendar-day-column${date === localDate() ? " is-today" : ""}`} style={{ height: (endHour - startHour) * 44 }} key={date}>{!shifts.length && <span className="calendar-closed">Neradno</span>}{shifts.map(({ shift, index }) => <button type="button" className="calendar-shift" key={index} style={{ top: `${(shift.start_minute - startHour * 60) / range * 100}%`, height: `${(shift.end_minute - shift.start_minute) / range * 100}%` }} disabled={busy || view === "published"} aria-label={`${location.name}, ${label} ${toTime(shift.start_minute)}–${toTime(shift.end_minute)}, ${shift.breaks.length} pauza. Izmeni smenu`} onClick={() => setEditing({ index, shift })}><span className="calendar-shift-time">{toTime(shift.start_minute)}<br />— {toTime(shift.end_minute)}</span><span className="calendar-shift-label">Radno vreme</span>{shift.breaks.map((pause, i) => <span className="calendar-break" key={i} style={{ top: `${(pause.start_minute - shift.start_minute) / (shift.end_minute - shift.start_minute) * 100}%`, height: `${(pause.end_minute - pause.start_minute) / (shift.end_minute - shift.start_minute) * 100}%` }} title={`Pauza ${toTime(pause.start_minute)}–${toTime(pause.end_minute)}`}><span>Pauza {toTime(pause.start_minute)}–{toTime(pause.end_minute)}</span></span>)}</button>)}</div>; })}
        </div></div>
      </section>)}</div>}
      <div className="schedule-actions"><p>{dirty ? "Sačuvaj izmene pre objavljivanja." : "Objava važi za obe lokacije izabrane nedelje."}</p><button type="button" className="button schedule-save" disabled={busy || !dirty} onClick={save}>{busy ? "Obrađujemo…" : "Sačuvaj nacrt"}</button><button type="button" className="button" disabled={busy || dirty} onClick={publish}>Objavi nedelju</button></div>
    </>}
    {editing && <ShiftDialog editing={editing} location={locations.find(l => l.id === editing.shift.location_id)?.name ?? ""} onClose={() => setEditing(null)} onRemove={() => { setDraft(old => old.filter((_, i) => i !== editing.index)); setEditing(null); }} onApply={shift => { setDraft(old => editing.index === null ? [...old, shift] : old.map((s, i) => i === editing.index ? shift : s)); setEditing(null); setMessage(""); }} />}
  </>;
}
