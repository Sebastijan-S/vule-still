// Request contract only. All authority, timing and availability checks live in SQL.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ServiceSnapshot = { service_id: string; service_name: string; duration_minutes: number };
export type ServiceSelection = { service: string; expected_service_name: string; expected_duration: number }
  | { services: string[]; expected_items: ServiceSnapshot[]; expected_duration: number };
type ConfirmInput = ServiceSelection & { request_key: string; location: string; start: string; schedule_revision: number; attendee_name: string | null };
type CancelInput = { request_key: string; reservation: string };
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

export function parseServiceIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length || !value.every(isUuid)) return null;
  const ids = value.map(id => id.toLowerCase()).sort();
  return new Set(ids).size === ids.length ? ids : null;
}
export function parseServiceSelection(value: Record<string, unknown>): ServiceSelection | null {
  if (typeof value.expected_duration !== "number" || !Number.isSafeInteger(value.expected_duration)
    || value.expected_duration <= 0 || value.expected_duration > 2147483647 || value.expected_duration % 10 !== 0) return null;
  if ("services" in value) {
    if ("service" in value || "expected_service_name" in value) return null;
    const ids = parseServiceIds(value.services);
    if (!ids || !Array.isArray(value.expected_items) || value.expected_items.length !== ids.length) return null;
    const items: ServiceSnapshot[] = [];
    for (const entry of value.expected_items) {
      const item = object(entry);
      if (!item || !isUuid(item.service_id) || typeof item.service_name !== "string" || !item.service_name.trim()
        || typeof item.duration_minutes !== "number" || !Number.isSafeInteger(item.duration_minutes)
        || item.duration_minutes <= 0 || item.duration_minutes % 10 !== 0) return null;
      items.push({ service_id: item.service_id.toLowerCase(), service_name: item.service_name, duration_minutes: item.duration_minutes });
    }
    items.sort((a, b) => a.service_id.localeCompare(b.service_id));
    if (items.some((item, i) => item.service_id !== ids[i]) || items.reduce((sum, item) => sum + item.duration_minutes, 0) !== value.expected_duration) return null;
    return { services: ids, expected_items: items, expected_duration: value.expected_duration };
  }
  if (!isUuid(value.service) || "expected_items" in value || typeof value.expected_service_name !== "string" || !value.expected_service_name.trim()) return null;
  return { service: value.service, expected_service_name: value.expected_service_name, expected_duration: value.expected_duration };
}

export function parseConfirmation(value: unknown): ConfirmInput | null {
  const v = object(value);
  if (!v || !isUuid(v.request_key) || !isUuid(v.location)
    || typeof v.start !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(v.start)
    || !Number.isFinite(Date.parse(v.start)) || new Date(v.start).toISOString() !== v.start
    || typeof v.schedule_revision !== "number" || !Number.isSafeInteger(v.schedule_revision) || v.schedule_revision < 1
    || (v.attendee_name !== undefined && v.attendee_name !== null && typeof v.attendee_name !== "string")) return null;
  const attendee = typeof v.attendee_name === "string" ? v.attendee_name.trim() : null;
  if (attendee !== null && (!attendee || [...attendee].length > 120)) return null;
  const selection = parseServiceSelection(v);
  if (!selection) return null;
  return { request_key: v.request_key, location: v.location, ...selection, start: v.start,
    schedule_revision: v.schedule_revision, attendee_name: attendee };
}

export function parseCancellation(value: unknown): CancelInput | null {
  const v = object(value);
  return v && isUuid(v.request_key) && isUuid(v.reservation) ? { request_key: v.request_key, reservation: v.reservation } : null;
}

export function bookingFailure(message: string) {
  const failures: Record<string, { status: number; error: string }> = {
    SESSION_REQUIRED: { status: 401, error: "Prijavi se ponovo da nastaviš." },
    BOOKING_BLOCKED: { status: 403, error: "Ovom nalogu je onemogućeno novo zakazivanje. Kontaktiraj salon." },
    PROFILE_REQUIRED: { status: 422, error: "Pre rezervacije popuni ime, prezime i telefon u profilu." },
    SLOT_TAKEN: { status: 409, error: "Ovaj termin je upravo zauzet. Izaberi drugi slobodan termin." },
    SCHEDULE_CHANGED: { status: 409, error: "Raspored je promenjen. Ponovo izaberi slobodan termin." },
    SERVICE_CHANGED: { status: 409, error: "Naziv ili trajanje usluge su promenjeni. Osveži stranicu i ponovo proveri izbor pre potvrde." },
    UNPUBLISHED: { status: 409, error: "Raspored još nije objavljen." },
    TIME_BOUNDARY: { status: 409, error: "Termin mora biti najmanje 15 minuta unapred, u narednih 14 dana." },
    INACTIVE_LOCATION: { status: 409, error: "Lokacija više nije dostupna za rezervaciju." },
    INACTIVE_SERVICE: { status: 409, error: "Usluga više nije dostupna. Ponovo izaberi uslugu." },
    KEY_REUSED: { status: 409, error: "Ovaj zahtev je već korišćen za drugi izbor. Osveži podatke pre novog pokušaja." },
    RESERVATION_NOT_FOUND: { status: 404, error: "Rezervacija nije pronađena." },
    CANCELLATION_TOO_LATE: { status: 409, error: "Otkazivanje je dozvoljeno najmanje 30 minuta pre početka. Kontaktiraj salon." },
    INVALID_INPUT: { status: 400, error: "Proveri izabrane podatke rezervacije." },
    INVALID_ATTENDEE: { status: 400, error: "Unesi ispravno ime osobe koja dolazi." },
    NOTIFICATION_NOT_FOUND: { status: 404, error: "Obaveštenje nije pronađeno." },
    OWNER_REQUIRED: { status: 403, error: "Ova radnja je dostupna samo vlasniku." },
    RESERVATION_CHANGED: { status: 409, error: "Rezervacija je u međuvremenu promenjena. Osveži pregled pre izmene." },
    RESERVATION_CLOSED: { status: 409, error: "Otkazana rezervacija se ne menja. Napravi novu rezervaciju." },
    EDIT_TOO_LATE: { status: 409, error: "Izmena koja oslobađa postojeći termin dozvoljena je najmanje 30 minuta pre njegovog početka. Kasni izuzeci nisu dostupni." },
    LINKED_PROFILE_CONTACT: { status: 400, error: "Kontakt registrovanog klijenta vodi se u njegovom profilu; ne kopira se u rezervaciju." },
  };
  return failures[message] ?? { status: 503, error: "Ishod zahteva trenutno nije poznat. Ponovi isti zahtev, sa istim ključem, pre novog zakazivanja." };
}
