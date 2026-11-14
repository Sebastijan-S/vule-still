import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "xfbjgxtgvlyndonhlupm.supabase.co");
const fixture = JSON.parse(await readFile(new URL("../.env.phase6-state.local", import.meta.url), "utf8"));
assert.match(fixture.owner.email, /^vule-phase6-owner-.+@example\.invalid$/);
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let original, lastSaved;
async function rpc(name, args = {}) {
  const result = await db.rpc(name, args); assert.equal(result.error, null, `${name}: ${result.error?.message}`); return result.data;
}
try {
  assert.equal((await db.auth.signInWithPassword(fixture.owner)).error, null);
  assert.equal((await db.rpc("ensure_session_access")).data, true);
  original = await rpc("get_owner_schedule_template");
  const date = new Date("2099-01-05T12:00:00Z"); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); const week = date.toISOString().slice(0, 10);
  assert.equal(await rpc("get_owner_schedule", { p_week: week }), null, "Never overwrite an existing future week");
  const args = { p_expected_revision: original.revision, p_entries: original.entries, p_gap: original.travel_gap_minutes };
  const started = Date.now(), concurrent = await Promise.all([db.rpc("save_owner_schedule_template", args), db.rpc("save_owner_schedule_template", args)]);
  assert.equal(concurrent.filter(r => !r.error).length, 1); assert.equal(concurrent.find(r => r.error)?.error.message, "TEMPLATE_CHANGED");
  lastSaved = concurrent.find(r => !r.error).data;
  console.log(JSON.stringify({ check: "parallel template saves", pass: true, elapsed_ms: Date.now() - started, statuses: concurrent.map(r => r.status) }));
  const sunday = { ...original.entries[0], weekday: 7, start_minute: 600, end_minute: 720, breaks: [{ start_minute: 660, end_minute: 680 }] };
  const entries = [...original.entries.filter(e => e.weekday !== 7), sunday];
  lastSaved = await rpc("save_owner_schedule_template", { p_expected_revision: lastSaved.revision, p_entries: entries, p_gap: 90 });
  const statePath = new URL("../.env.phase10-template-state.local", import.meta.url);
  await writeFile(statePath, JSON.stringify({ week, wasAbsent: true, planned: lastSaved, created: null }));
  const fresh = await rpc("prepare_schedule_week", { p_week: week });
  await writeFile(statePath, JSON.stringify({ week, wasAbsent: true, planned: lastSaved, created: fresh }));
  assert.equal(fresh.published, null); assert.equal(fresh.travel_gap_minutes, 90);
  assert.deepEqual(fresh.draft.find(e => e.date === new Date(Date.parse(`${week}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)).breaks, sunday.breaks);
  const again = await rpc("prepare_schedule_week", { p_week: week }); assert.deepEqual(again, fresh);
  console.log(JSON.stringify({ check: "new future draft inherits Sunday/breaks/gap; repeat prepare preserves it", pass: true, week, cleanup: "Exact created snapshot recorded for conditional SQL removal" }));
} finally {
  try {
    if (original && lastSaved) {
      const current = await rpc("get_owner_schedule_template"); assert.deepEqual(current, lastSaved, "Concurrent defaults change; refuse to overwrite");
      const restored = await rpc("save_owner_schedule_template", { p_expected_revision: current.revision, p_entries: original.entries, p_gap: original.travel_gap_minutes });
      assert.deepEqual(restored.entries, original.entries); assert.equal(restored.travel_gap_minutes, original.travel_gap_minutes);
      console.log(JSON.stringify({ check: "original defaults restored", pass: true, revision: restored.revision }));
    }
  } finally { await db.auth.signOut({ scope: "local" }); }
}
