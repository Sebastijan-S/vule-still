// Pure time-rule engine. The clock and all facts come from the database RPC;
// customer requests cannot provide occupied intervals, duration or current time.
export const BUSINESS_ZONE = "Europe/Belgrade";
const MINUTE = 60_000;
type Interval = { start: number; end: number };
type Shift = { date: string; location_id: string; start_minute: number; end_minute: number; breaks: { start_minute: number; end_minute: number }[] };
export type AvailabilityContext = {
  server_time: string;
  reason?: "outside_horizon" | "inactive_location" | "inactive_service";
  service?: { minutes: number; active: boolean };
  week?: { entries: Shift[]; travel_gap_minutes: number; revision: number } | null;
  occupied?: { start: string; end: string; location_id: string }[];
};
export type AvailabilityReason = "available" | "unpublished" | "closed" | "fully_booked" | "insufficient_duration" | "cutoff" | "outside_horizon" | "inactive_location" | "inactive_service" | "invalid_schedule";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function parts(instant: number) {
  const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, wall: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) };
}
export function addCalendarDays(date: string, days: number) {
  const instant = new Date(`${date}T12:00:00Z`); instant.setUTCDate(instant.getUTCDate() + days); return instant.toISOString().slice(0, 10);
}
export function isCalendarDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
// Discover the zone's offsets around the requested day; do not assume CET/CEST.
// A skipped wall time returns no instant; a repeated time returns both instants.
export function localMinuteInstants(date: string, minute: number): number[] {
  const wall = Date.parse(`${date}T00:00:00Z`) + minute * MINUTE;
  const wanted = new Date(wall).toISOString().slice(0, 16);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wall + hours * 60 * MINUTE;
    offsets.add(parts(sample).wall - sample);
  }
  return [...offsets].map(offset => wall - offset).filter(instant => {
    const p = parts(instant); return `${p.date}T${p.time}` === wanted;
  }).sort((a, b) => a - b);
}
function localInterval(date: string, start: number, end: number): Interval {
  const starts = localMinuteInstants(date, start), ends = localMinuteInstants(date, end);
  if (!starts.length || !ends.length) throw new Error("Nonexistent local schedule boundary");
  // A repeated local boundary opens at its first occurrence, closes at its last.
  return { start: starts[0], end: ends[ends.length - 1] };
}
function merge(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const next of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && next.start <= last.end) last.end = Math.max(last.end, next.end);
    else result.push({ ...next });
  }
  return result;
}
function subtract(periods: Interval[], blocks: Interval[]) {
  let free = merge(periods);
  for (const block of merge(blocks)) free = free.flatMap(period => {
    if (block.end <= period.start || block.start >= period.end) return [period];
    return [period.start < block.start ? { start: period.start, end: block.start } : null,
      block.end < period.end ? { start: block.end, end: period.end } : null].filter((x): x is Interval => x !== null);
  });
  return free;
}

export function calculateAvailability(date: string, locationId: string, context: AvailabilityContext) {
  const now = Date.parse(context.server_time);
  if (!isCalendarDate(date) || !Number.isFinite(now)) throw new Error("Invalid availability context");
  const base = { date, timezone: BUSINESS_ZONE, server_time: context.server_time, schedule_revision: context.week?.revision ?? null, duration_minutes: context.service?.minutes ?? null };
  const result = (reason: AvailabilityReason, slots: { start: string; end: string; local_start: string; utc_offset_minutes: number }[] = []) => ({ ...base, reason, slots });
  const today = parts(now).date;
  if (date < today || date > addCalendarDays(today, 14)) return result("outside_horizon");
  if (context.reason) return result(context.reason);
  if (!context.service?.active || !Number.isInteger(context.service.minutes) || context.service.minutes <= 0) return result("inactive_service");
  if (!context.week) return result("unpublished");
  const shifts = context.week.entries.filter(s => s.date === date && s.location_id === locationId);
  if (!shifts.length) return result("closed");
  try {
    const work = shifts.map(s => localInterval(date, s.start_minute, s.end_minute));
    const breaks = shifts.flatMap(s => s.breaks.map(b => localInterval(date, b.start_minute, b.end_minute)));
    const occupied = (context.occupied ?? []).map(b => {
      const buffer = b.location_id === locationId ? 0 : context.week!.travel_gap_minutes * MINUTE;
      const start = Date.parse(b.start) - buffer, end = Date.parse(b.end) + buffer;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid occupied interval");
      return { start, end };
    });
    const free = subtract(work, [...breaks, ...occupied]);
    if (!free.length) return result(occupied.some(b => work.some(w => b.start < w.end && b.end > w.start)) ? "fully_booked" : "insufficient_duration");
    const duration = context.service.minutes * MINUTE;
    const candidates = free.flatMap(period => {
      const starts: number[] = [];
      for (let start = period.start; start + duration <= period.end; start += duration) starts.push(start);
      return starts;
    });
    if (!candidates.length) return result("insufficient_duration");
    const slots = candidates.filter(start => start >= now + 15 * MINUTE).map(start => {
      const local = parts(start);
      return { start: new Date(start).toISOString(), end: new Date(start + duration).toISOString(), local_start: local.time, utc_offset_minutes: (local.wall - start) / MINUTE };
    });
    return result(slots.length ? "available" : "cutoff", slots);
  } catch { return result("invalid_schedule"); }
}
