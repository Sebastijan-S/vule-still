import assert from "node:assert/strict";
import test from "node:test";
import { calculateAvailability, localMinuteInstants, isCalendarDate } from "../src/lib/availability.ts";

const location = "zrenjanin", other = "neuzin", day = "2026-11-02";
const instant = (date, minute) => new Date(localMinuteInstants(date, minute)[0]).toISOString();
const shift = (start = 600, end = 900, overrides = {}) => ({ date: day, location_id: location, start_minute: start, end_minute: end, breaks: [], ...overrides });
const context = (minutes = 20, overrides = {}) => ({ server_time: instant(day, 480), service: { minutes, active: true }, week: { entries: [shift()], travel_gap_minutes: 60, revision: 1 }, occupied: [], ...overrides });
const run = (c = context(), date = day, city = location) => calculateAvailability(date, city, c);
const times = result => result.slots.map(s => s.local_start);
test("PRD: Zrenjanin 20 and 40 minute sequences fit the entire shift", () => {
  const twenty = run(); assert.equal(twenty.slots.length, 15); assert.equal(times(twenty)[0], "10:00"); assert.equal(times(twenty).at(-1), "14:40");
  assert.deepEqual(times(run(context(40))), ["10:00", "10:40", "11:20", "12:00", "12:40", "13:20", "14:00"]);
});
test("PRD: Neuzin 40 minute sequence", () => {
  const c = context(40); c.week.entries = [shift(1020, 1200, { location_id: other })];
  assert.deepEqual(times(run(c, day, other)), ["17:00", "17:40", "18:20", "19:00"]);
});
test("PRD: occupied interval splits and reseeds the free period", () => {
  const c = context(40); c.occupied = [{ start: instant(day, 640), end: instant(day, 660), location_id: location }];
  assert.deepEqual(times(run(c)), ["10:00", "11:00", "11:40", "12:20", "13:00", "13:40", "14:20"]);
});
test("PRD: cutoff filters original grid without shifting it", () => {
  assert.equal(times(run(context(20, { server_time: instant(day, 610) })))[0], "10:40");
  assert.equal(times(run(context(20, { server_time: instant(day, 585) })))[0], "10:00");
  assert.equal(times(run(context(20, { server_time: new Date(Date.parse(instant(day, 585)) + 1).toISOString() })))[0], "10:20");
});
test("horizon includes today and local date today+14, excludes yesterday and +15", () => {
  const c = context(); c.week.entries = [shift(600, 900, { date: "2026-11-16" })];
  assert.equal(run(c, "2026-11-16").reason, "available");
  assert.equal(run(c, "2026-11-17").reason, "outside_horizon"); assert.equal(run(c, "2026-11-01").reason, "outside_horizon");
  c.server_time = "2026-11-01T23:30:00Z"; assert.equal(run(c, "2026-11-01").reason, "outside_horizon");
});
test("half-open touching intervals allow immediate next start and preserve short gaps", () => {
  const c = context(); c.occupied = [{ start: instant(day, 580), end: instant(day, 600), location_id: location }, { start: instant(day, 620), end: instant(day, 640), location_id: location }];
  assert.deepEqual(times(run(c)).slice(0, 2), ["10:00", "10:40"]);
});
test("breaks, overlapping occupied intervals and adjacent shifts use union and subtraction", () => {
  const c = context(); c.week.entries = [shift(600, 660), shift(660, 720, { breaks: [{ start_minute: 680, end_minute: 700 }] })];
  c.occupied = [{ start: instant(day, 620), end: instant(day, 640), location_id: location }, { start: instant(day, 630), end: instant(day, 650), location_id: location }];
  assert.deepEqual(times(run(c)), ["10:00", "10:50", "11:40"]);
});
test("travel blocks shared barber across locations, with exact and zero-gap boundaries", () => {
  const c = context(); c.occupied = [{ start: instant(day, 540), end: instant(day, 570), location_id: other }];
  assert.equal(times(run(c))[0], "10:30");
  c.week.travel_gap_minutes = 30; assert.equal(times(run(c))[0], "10:00");
  c.week.travel_gap_minutes = 0; c.occupied = [{ start: instant(day, 620), end: instant(day, 640), location_id: other }];
  assert.deepEqual(times(run(c)).slice(0, 2), ["10:00", "10:40"]);
});
test("cross-midnight occupied intervals and travel from adjacent day are considered", () => {
  const c = context(20, { server_time: instant("2026-11-01", 600) }); c.week.entries = [shift(0, 120)];
  c.occupied = [{ start: instant("2026-11-01", 1410), end: instant(day, 10), location_id: other }];
  assert.deepEqual(times(run(c)), ["01:10", "01:30"]);
});
test("empty states distinguish unpublished, closed, booked, too short, cutoff and inactive", () => {
  assert.equal(run(context(20, { week: null })).reason, "unpublished");
  const c = context(); c.week.entries = []; assert.equal(run(c).reason, "closed");
  c.week.entries = [shift(600, 610)]; assert.equal(run(c).reason, "insufficient_duration");
  c.week.entries = [shift()]; c.occupied = [{ start: instant(day, 600), end: instant(day, 900), location_id: location }]; assert.equal(run(c).reason, "fully_booked");
  assert.equal(run(context(20, { server_time: instant(day, 900) })).reason, "cutoff");
  assert.equal(run(context(20, { service: { minutes: 20, active: false } })).reason, "inactive_service");
  assert.equal(run(context(20, { reason: "inactive_location" })).reason, "inactive_location");
});
test("spring DST skips missing hour and uses real elapsed service duration", () => {
  const date = "2027-03-28"; const c = context(20, { server_time: instant("2027-03-27", 600) }); c.week.entries = [shift(60, 240, { date })];
  const result = run(c, date); assert.equal(result.slots.length, 6);
  assert.deepEqual(times(result), ["01:00", "01:20", "01:40", "03:00", "03:20", "03:40"]);
  assert.equal(localMinuteInstants(date, 150).length, 0);
  c.week.entries = [shift(150, 240, { date })]; assert.equal(run(c, date).reason, "invalid_schedule");
});
test("autumn DST returns repeated starts with distinct instants and offsets", () => {
  const date = "2026-10-25"; const c = context(20, { server_time: instant("2026-10-24", 600) }); c.week.entries = [shift(60, 240, { date })];
  const result = run(c, date); assert.equal(result.slots.length, 12);
  const repeated = result.slots.filter(s => s.local_start === "02:00"); assert.equal(repeated.length, 2);
  assert.notEqual(repeated[0].start, repeated[1].start); assert.notEqual(repeated[0].utc_offset_minutes, repeated[1].utc_offset_minutes);
});
test("device timezone cannot change business dates or slot instants", () => {
  const original = process.env.TZ;
  try { process.env.TZ = "Pacific/Honolulu"; const west = run(); process.env.TZ = "Asia/Tokyo"; assert.deepEqual(run(), west); }
  finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test("public result exposes only times and facts, validates dates", () => {
  assert.deepEqual(Object.keys(run().slots[0]).sort(), ["end", "local_start", "start", "utc_offset_minutes"]);
  assert.equal(isCalendarDate("2026-02-30"), false); assert.equal(isCalendarDate("2028-02-29"), true);
  assert.equal(isCalendarDate(""), false);
});
