"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShiftDialog, type Shift } from "../../raspored/schedule-editor";

type Entry = Omit<Shift, "date"> & { weekday: number };
export type Template = { entries: Entry[]; revision: number; travel_gap_minutes: number };
const days = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
const time = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const canonical = (entries: Entry[]) => [...entries].sort((a, b) => a.weekday - b.weekday || a.start_minute - b.start_minute);

export function TemplateEditor({ locations, initial }: { locations: { id: string; name: string }[]; initial: Template }) {
  const [saved, setSaved] = useState(initial), [entries, setEntries] = useState(initial.entries), [gap, setGap] = useState(initial.travel_gap_minutes);
  const [editing, setEditing] = useState<{ index: number | null; shift: Shift; weekday: number } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [reloadRequired, setReloadRequired] = useState(false);
  const [db] = useState(createClient);
  const dirty = JSON.stringify(canonical(entries)) !== JSON.stringify(canonical(saved.entries)) || gap !== saved.travel_gap_minutes;
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: failure } = await db.rpc("save_owner_schedule_template", { p_expected_revision: saved.revision, p_entries: canonical(entries), p_gap: gap }).abortSignal(AbortSignal.timeout(12000));
      if (failure) {
        if (failure.code === "22023" || failure.code === "22P02") { setError("Proveri smene, pauze i razmak između lokacija. Uobičajena nedelja nije sačuvana."); return; }
        if (failure.message === "TEMPLATE_CHANGED") { setError("Druga sesija je promenila šablon. Učitaj sačuvanu verziju pre novih izmena."); setReloadRequired(true); return; }
        throw failure;
      }
      if (!data) throw new Error("Missing template");
      const next = data as unknown as Template; setSaved(next); setEntries(next.entries); setGap(next.travel_gap_minutes);
      setMessage("Uobičajena nedelja je sačuvana. Postojeći nacrti i objavljene nedelje nisu promenjeni.");
    } catch { setError("Čuvanje nije potvrđeno. Učitaj sačuvanu verziju da proveriš ishod pre nove izmene."); setReloadRequired(true); }
    finally { setBusy(false); }
  }
  async function reload() {
    if (dirty && !window.confirm("Učitaj poslednju sačuvanu verziju i odbaci lokalne izmene?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: failure } = await db.rpc("get_owner_schedule_template").abortSignal(AbortSignal.timeout(12000));
      if (failure || !data) throw failure;
      const next = data as unknown as Template; setSaved(next); setEntries(next.entries); setGap(next.travel_gap_minutes); setReloadRequired(false);
    } catch { setError("Sačuvana verzija trenutno nije dostupna. Pokušaj ponovo."); }
    finally { setBusy(false); }
  }
  function edit(weekday: number, location: { id: string; name: string }) {
    const index = entries.findIndex(e => e.weekday === weekday && e.location_id === location.id);
    const entry = index < 0 ? { weekday, location_id: location.id, start_minute: location.name === "Neuzin" ? 1020 : 600, end_minute: location.name === "Neuzin" ? 1200 : 900, breaks: [] } : entries[index];
    setEditing({ index: index < 0 ? null : index, weekday, shift: { date: `2000-01-${String(weekday + 2).padStart(2, "0")}`, location_id: entry.location_id, start_minute: entry.start_minute, end_minute: entry.end_minute, breaks: entry.breaks } });
  }
  return <><p className="eyebrow">PODRAZUMEVANI RASPORED</p><h1>Uobičajena <em>nedelja.</em></h1><p className="muted">Sačuvaj smene koje najčešće ponavljaš. Ovaj šablon koristi se samo kada prvi put pripremaš novu nedelju.</p><p className="notice">Promena šablona ne menja postojeće nacrte ni objavljene nedelje. Konkretne promene i objavu uradi kroz „Radno vreme“.</p><p className="field-help">Jedna uobičajena smena po lokaciji i danu, sa pauzama. Za više smena ili izuzetak koristi kalendare konkretne nedelje. Nedelja može biti radna, kao i svaki drugi dan.</p>
    {error && <p role="alert" className="form-error">{error}</p>}{message && <p role="status" className="form-success">{message}</p>}
    <fieldset className="template-fields" disabled={busy || reloadRequired}><legend className="sr-only">Radna nedelja po danima</legend>
      <label className="booking-field">Uobičajeni razmak između lokacija (min)<input type="number" min="0" step="1" value={gap} onChange={e => setGap(Number(e.target.value))} /></label>
      <div className="template-days">{days.map((day, index) => <section className="template-day" key={day}><h2>{day}</h2>{locations.map(location => {
        const entry = entries.find(e => e.weekday === index + 1 && e.location_id === location.id);
        return <div className="template-location" key={location.id}><div><h3>{location.name}</h3><p>{entry ? `${time(entry.start_minute)}–${time(entry.end_minute)}` : "Neradno"}</p>{entry?.breaks.map((b, i) => <p className="field-help" key={i}>Pauza {time(b.start_minute)}–{time(b.end_minute)}</p>)}</div><button type="button" className="outline-link" onClick={() => edit(index + 1, location)} aria-label={`${entry ? "Izmeni" : "Dodaj"} uobičajenu smenu — ${location.name}, ${day}`}>{entry ? "Izmeni" : "+ Radno vreme"}</button></div>;
      })}</section>)}</div>
    </fieldset>
    <div className="booking-toolbar template-actions"><button type="button" className="button" disabled={busy || !dirty || reloadRequired} onClick={() => void save()}>{busy ? "Obrađujemo…" : "Sačuvaj uobičajenu nedelju"}</button><button type="button" className="text-button" disabled={busy} onClick={() => void reload()}>Učitaj sačuvanu verziju</button><Link href="/raspored" className="outline-link">Otvori radno vreme</Link></div>
    {editing && <ShiftDialog target="template" editing={editing} dayLabel={days[editing.weekday - 1]} location={locations.find(l => l.id === editing.shift.location_id)?.name ?? ""} onClose={() => setEditing(null)} onRemove={() => { setEntries(old => old.filter((_, i) => i !== editing.index)); setEditing(null); setMessage(""); }} onApply={shift => { const entry: Entry = { weekday: editing.weekday, location_id: shift.location_id, start_minute: shift.start_minute, end_minute: shift.end_minute, breaks: shift.breaks }; setEntries(old => editing.index === null ? [...old, entry] : old.map((e, i) => i === editing.index ? entry : e)); setEditing(null); setMessage(""); }} />}
  </>;
}
