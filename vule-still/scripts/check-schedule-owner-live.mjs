// Mutates only schedule revisions in the disposable test project. Uses the
// already-provisioned synthetic owner/customer in an ignored local JSON file.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || new URL(url).hostname !== "xfbjgxtgvlyndonhlupm.supabase.co" || !key) throw new Error("Restricted to Vule-still-test");
const fixture = JSON.parse(await readFile(new URL("../.env.phase6-state.local", import.meta.url), "utf8"));
for (const account of [fixture.owner, fixture.customer]) {
  if (!/^vule-phase6-(owner|customer)-.+@example\.invalid$/.test(account.email)) throw new Error("Synthetic accounts required");
}
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) }) } });
const anonymous = client(), owner = client(), customer = client();
let passed = 0;
const check = async (name, fn) => { await fn(); console.log(`ok ${++passed} - ${name}`); };
async function rpc(db, name, args = {}) { const { data, error } = await db.rpc(name, args); if (error) throw new Error(`${name}: ${error.code}`); return data; }
for (const [db, account] of [[owner, fixture.owner], [customer, fixture.customer]]) {
  const { error } = await db.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error("Synthetic password login failed");
  assert.equal(await rpc(db, "ensure_session_access"), true);
}
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monday = new Date(`${date}T12:00:00Z`); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
const week = monday.toISOString().slice(0, 10), args = { p_week: week };
try {
  await check("anonymous and real customer cannot read owner schedules or publish", async () => {
    for (const db of [anonymous, customer]) {
      assert.ok((await db.rpc("get_owner_schedule", args)).error);
      assert.ok((await db.rpc("publish_schedule_week", { ...args, p_expected_revision: 0 })).error);
      assert.ok((await db.from("schedule_weeks").select("*")).error);
    }
  });
  let state = await rpc(owner, "prepare_schedule_week", args);
  const original = structuredClone(state.draft), gap = state.travel_gap_minutes;
  await check("owner prepares/reads a real draft; public sees no unpublished draft", async () => {
    assert.equal(original.length > 0, true);
    const published = await rpc(anonymous, "published_schedule", args);
    if (state.published === null) assert.equal(published, null);
    else assert.deepEqual(published.entries, state.published);
  });
  await check("concurrent same-revision saves allow exactly one writer", async () => {
    const { data: { session } } = await owner.auth.getSession();
    const result = await Promise.all([0, 1].map(async () => {
      try {
        const response = await fetch(`${url}/rest/v1/rpc/save_schedule_draft`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${session.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ ...args, p_expected_revision: state.draft_revision, p_entries: original, p_gap: gap }), signal: AbortSignal.timeout(12000) });
        const data = await response.json(); return response.ok ? { data, error: null } : { data: null, error: data };
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
        return { data: null, error: { code: "client_timeout" } };
      }
    }));
    assert.equal(result.filter(r => !r.error).length, 1);
    const loser = result.find(r => r.error)?.error;
    assert.ok(["40001", "client_timeout"].includes(loser?.code), `Unexpected result: ${loser?.code}`);
    const after = await rpc(owner, "get_owner_schedule", args);
    assert.equal(after.draft_revision, state.draft_revision + 1, "Exactly one revision may be written, even if conflict response times out");
    assert.deepEqual(after.draft, original);
    console.log(JSON.stringify({ concurrency: "one write, no lost update", losingResponse: loser.code }));
    state = after;
  });
  await check("real database rejects missing fields and overlap", async () => {
    for (const entries of [[{}], [...original, { ...original[0], start_minute: original[0].start_minute + 10 }]]) {
      assert.ok((await owner.rpc("save_schedule_draft", { ...args, p_expected_revision: state.draft_revision, p_entries: entries, p_gap: gap })).error);
    }
  });
  await check("owner publishes saved week and anonymous API sees its snapshot", async () => {
    await rpc(owner, "publish_schedule_week", { ...args, p_expected_revision: state.draft_revision });
    assert.deepEqual((await rpc(anonymous, "published_schedule", args)).entries, original);
  });
  await check("new saved draft leaves live published data unchanged", async () => {
    const changed = structuredClone(original); changed[0].breaks = [{ start_minute: changed[0].start_minute + 30, end_minute: changed[0].start_minute + 40 }];
    const revision = await rpc(owner, "save_schedule_draft", { ...args, p_expected_revision: state.draft_revision, p_entries: changed, p_gap: gap });
    assert.deepEqual((await rpc(anonymous, "published_schedule", args)).entries, original);
    await rpc(owner, "save_schedule_draft", { ...args, p_expected_revision: revision, p_entries: original, p_gap: gap });
    state = await rpc(owner, "get_owner_schedule", args);
    assert.deepEqual(state.draft, original);
  });
  console.log(JSON.stringify({ result: "PASS", checks: passed, project: new URL(url).hostname, week, note: "Original draft preserved; current test week published; no email sent" }));
} finally { await owner.auth.signOut({ scope: "local" }); await customer.auth.signOut({ scope: "local" }); }
