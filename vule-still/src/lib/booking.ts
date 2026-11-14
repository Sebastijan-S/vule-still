// Request contract only. All authority, timing and availability checks live in SQL.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ConfirmInput = { request_key: string; location: string; service: string; start: string; schedule_revision: number; expected_service_name: string; expected_duration: number; attendee_name: string | null };
type CancelInput = { request_key: string; reservation: string };
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

export function parseConfirmation(value: unknown): ConfirmInput | null {
  const v = object(value);
  if (!v || !isUuid(v.request_key) || !isUuid(v.location) || !isUuid(v.service)
    || typeof v.start !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(v.start)
    || !Number.isFinite(Date.parse(v.start)) || new Date(v.start).toISOString() !== v.start
    || typeof v.schedule_revision !== "number" || !Number.isSafeInteger(v.schedule_revision) || v.schedule_revision < 1
    || typeof v.expected_service_name !== "string" || !v.expected_service_name.trim()
    || typeof v.expected_duration !== "number" || !Number.isSafeInteger(v.expected_duration) || v.expected_duration <= 0 || v.expected_duration % 10 !== 0
    || (v.attendee_name !== undefined && v.attendee_name !== null && typeof v.attendee_name !== "string")) return null;
  const attendee = typeof v.attendee_name === "string" ? v.attendee_name.trim() : null;
  if (attendee !== null && (!attendee || [...attendee].length > 120)) return null;
  return { request_key: v.request_key, location: v.location, service: v.service, start: v.start,
    schedule_revision: v.schedule_revision, expected_service_name: v.expected_service_name, expected_duration: v.expected_duration, attendee_name: attendee };
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
