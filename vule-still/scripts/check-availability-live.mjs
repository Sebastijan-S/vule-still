// Read-only probe. No email, accounts, reservations or schedule writes.
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || new URL(url).hostname !== "xfbjgxtgvlyndonhlupm.supabase.co" || !key) throw new Error("Restricted to Vule-still-test");
const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
async function request(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(20000), ...options });
  if (!response.ok) throw new Error(`Public API returned ${response.status} for ${path.split("?")[0]}`);
  return response.json();
}
const locations = await request("locations?select=id,slug&is_active=eq.true"), services = await request("services?select=id,duration_minutes&is_active=eq.true");
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); const date = d.toISOString().slice(0, 10);
let passed = 0;
for (const location of locations) for (const minutes of [20, 40]) {
  const service = services.find(s => s.duration_minutes === minutes);
  const context = await request("rpc/availability_context", { method: "POST", body: JSON.stringify({ p_date: date, p_location: location.id, p_service: service.id }) });
  assert.ok(context.server_time); assert.equal(context.service.minutes, minutes);
  assert.equal(context.week?.entries.some(s => s.date === date && s.location_id === location.id), true);
  assert.ok(context.occupied.every(b => Object.keys(b).sort().join() === "end,location_id,start"));
  const response = await fetch(`http://127.0.0.1:3100/api/availability?date=${date}&location=${location.id}&service=${service.id}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json(); assert.equal(result.reason, "available"); assert.ok(result.slots.length > 0);
  assert.ok(result.slots.every(s => Date.parse(s.end) - Date.parse(s.start) === minutes * 60000));
  console.log(`ok ${++passed} - ${location.slug} ${minutes} min: ${result.slots.length} starts; ${result.slots[0].local_start}–${result.slots.at(-1).local_start}`);
}
const invalid = await fetch("http://127.0.0.1:3100/api/availability?date=2026-02-30", { signal: AbortSignal.timeout(20000) }); assert.equal(invalid.status, 400);
console.log(JSON.stringify({ result: "PASS", checks: passed + 1, date, writes: 0 }));
