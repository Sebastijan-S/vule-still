import type { ServiceSnapshot } from "@/lib/booking";

type Service = { id: string; name: string; duration_minutes: number; category?: string };

// Advisory catalogue totals only; SQL remains authoritative at availability/confirmation.
export function ServicePicker({ services, selected, onChange }: { services: Service[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const groups = ["standard", "premium"].map(category => ({ category, items: services.filter(s => (s.category ?? "standard") === category) })).filter(g => g.items.length);
  return <div>{groups.map(({ category, items }) => <fieldset key={category}><legend>{groups.length === 1 ? "Usluge" : category === "premium" ? "Premium usluge" : "Standardne usluge"}</legend><div className="booking-options">{items.map(s => <label className="booking-option service-choice" key={s.id}>
    <input type="checkbox" checked={selected.includes(s.id)} onChange={e => onChange(services.filter(item => item.id === s.id ? e.target.checked : selected.includes(item.id)).map(item => item.id))} />
    <strong>{s.name}</strong><span>{s.duration_minutes} min</span>
  </label>)}</div></fieldset>)}<p role="status"><strong>Ukupno trajanje: {services.filter(s => selected.includes(s.id)).reduce((sum, s) => sum + s.duration_minutes, 0)} min</strong></p></div>;
}

export function selectionSnapshot(services: Service[], selected: string[]): ServiceSnapshot[] {
  return services.filter(s => selected.includes(s.id)).map(s => ({ service_id: s.id, service_name: s.name, duration_minutes: s.duration_minutes }));
}
