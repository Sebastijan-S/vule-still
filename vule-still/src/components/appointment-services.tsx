import type { AppointmentItem } from "@/lib/appointment-display";

// Legacy durable responses may have no items. Their saved label/total still render.
export function AppointmentServices({ items, total }: { items?: AppointmentItem[]; total: number }) {
  if (!items || items.length < 2) return null;
  return <div className="visit-services"><ul aria-label="Usluge ovog dolaska">{items.map(item =>
    <li key={item.service_id}>{item.service_name} · {item.duration_minutes} min</li>
  )}</ul><p><strong>Ukupno trajanje: {total} min</strong></p></div>;
}
