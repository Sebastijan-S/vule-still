import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const owner = "90000000-0000-4000-8000-000000000071", customer = "90000000-0000-4000-8000-000000000072";
const session = "90000000-0000-4000-8000-000000000073", customerSession = "90000000-0000-4000-8000-000000000074";
let passed = 0;
async function check(name, fn) { await fn(); console.log(`ok ${++passed} - ${name}`); }
async function as(role, id, sid, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, role, session_id: sid })]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql", import.meta.url), "utf8"));
  const migrations = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(migrations)).filter(n => n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(name, migrations), "utf8"));
  // Exercise both locations, including future reactivation, in this regression fixture.
  await db.exec("update public.locations set booking_enabled=true");
  for (const [id, sid] of [[owner, session], [customer, customerSession]]) {
    await db.query("insert into auth.users (id,email,email_confirmed_at) values ($1,$2,now())", [id, `${id}@example.invalid`]);
    await db.query("insert into auth.sessions (id,user_id) values ($1,$2)", [sid, id]);
  }
  await db.query("insert into public.admin_memberships (user_id) values ($1)", [owner]);
  await check("anonymous and ordinary customer cannot read/write defaults or settings directly", async () => {
    for (const [role, id, sid] of [["anon", customer, customerSession], ["authenticated", customer, customerSession]]) await as(role, id, sid, async () => {
      if (role === "authenticated") await rpc("ensure_session_access");
      await assert.rejects(rpc("get_owner_schedule_template"));
      await assert.rejects(rpc("save_owner_schedule_template", [0, "[]", 60]));
      await assert.rejects(db.query("select * from public.schedule_template_settings"));
      await assert.rejects(db.query("delete from public.schedule_templates"));
    });
  });
  await as("authenticated", owner, session, async () => {
    await rpc("ensure_session_access");
    const original = await rpc("get_owner_schedule_template");
    const prepared = await rpc("prepare_schedule_week", ["2026-11-02"]);
    await rpc("publish_schedule_week", ["2026-11-02", prepared.draft_revision]);
    const existing = await rpc("get_owner_schedule", ["2026-11-02"]);
    const sunday = { ...original.entries[0], weekday: 7, breaks: [{ start_minute: 660, end_minute: 680 }] };
    const next = [...original.entries, sunday];
    await check("owner saves Sunday, breaks and default travel gap", async () => {
      const saved = await rpc("save_owner_schedule_template", [original.revision, JSON.stringify(next), 90]);
      assert.equal(saved.revision, original.revision + 1); assert.equal(saved.travel_gap_minutes, 90);
      assert.deepEqual(saved.entries.find(e => e.weekday === 7), sunday);
    });
    await check("template save and preparing again never overwrite existing draft/published week", async () => {
      assert.deepEqual(await rpc("get_owner_schedule", ["2026-11-02"]), existing);
      assert.deepEqual(await rpc("prepare_schedule_week", ["2026-11-02"]), existing);
    });
    await check("only new week inherits saved Sunday/breaks/gap and remains unpublished", async () => {
      const fresh = await rpc("prepare_schedule_week", ["2026-11-09"]);
      assert.equal(fresh.travel_gap_minutes, 90); assert.equal(fresh.published, null);
      const shift = fresh.draft.find(e => e.date === "2026-11-15");
      assert.deepEqual(shift.breaks, sunday.breaks); assert.equal(shift.location_id, sunday.location_id);
    });
    await check("stale revision cannot overwrite saved defaults", async () => {
      await assert.rejects(rpc("save_owner_schedule_template", [original.revision, JSON.stringify(original.entries), 60]), /TEMPLATE_CHANGED/);
      assert.equal((await rpc("get_owner_schedule_template")).entries.length, 13);
    });
    const stable = await rpc("get_owner_schedule_template");
    await check("overlap, travel gap, duplicate and malformed/missing fields roll back atomically", async () => {
      const invalids = [
        [...next, next[0]],
        next.map((e, i) => i === 1 ? { ...e, start_minute: 800 } : e),
        next.map((e, i) => i === 1 ? { ...e, start_minute: 930 } : e),
        [{ ...sunday, weekday: 8 }], [{ ...sunday, start_minute: null }],
        [{ ...sunday, breaks: [{ start_minute: 610 }] }],
        [{ ...sunday, breaks: [{ start_minute: 500, end_minute: 650 }] }],
        [{ ...sunday, location_id: "90000000-0000-4000-8000-000000000099" }],
      ];
      for (const invalid of invalids) {
        await assert.rejects(rpc("save_owner_schedule_template", [stable.revision, JSON.stringify(invalid), 90]));
        assert.deepEqual(await rpc("get_owner_schedule_template"), stable);
      }
    });
    await check("closed template is valid and does not remove existing weeks", async () => {
      const closed = await rpc("save_owner_schedule_template", [stable.revision, "[]", 0]);
      assert.deepEqual(closed.entries, []);
      assert.deepEqual(await rpc("get_owner_schedule", ["2026-11-02"]), existing);
      assert.deepEqual((await rpc("prepare_schedule_week", ["2026-11-16"])).draft, []);
    });
  });
} finally { await db.close(); }
