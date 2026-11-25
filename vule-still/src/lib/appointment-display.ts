export type AppointmentItem = { service_id: string; service_name: string; duration_minutes: number; position: number };
export type Appointment = {
  id: string; status: "confirmed" | "cancelled"; location_id: string; location_name: string;
  service_id: string; service_name: string; duration_minutes: number; starts_at: string; ends_at: string;
  attendee_name: string; version: number; cancellation_reason?: string | null;
  user_id?: string | null; phone?: string | null; email?: string | null;
  service_count?: number; items?: AppointmentItem[];
};
export type Notice = { id: string; reservation_id: string; kind: string; message: string; created_at: string; read_at: string | null; items?: AppointmentItem[]; duration_minutes?: number };
export const businessDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
export const dateLabel = (value: string) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
export const timeLabel = (value: string) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
export const offsetLabel = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", timeZoneName: "shortOffset" }).formatToParts(new Date(value)).find(p => p.type === "timeZoneName")?.value;
export async function postBooking(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  return { ok: response.ok, status: response.status, ...data };
}
