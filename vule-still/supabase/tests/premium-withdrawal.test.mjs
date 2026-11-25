import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const id = n => `83000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, customer] = [1, 2].map(id);
let passed = 0;
const check = async (name, fn) => { await fn(); console.log(`ok ${++passed} - ${name}`); };
const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;
async function as(user, fn) {
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, session_id: user?.replace("83000000", "84000000"), role: user ? "authenticated" : "anon" })]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql", import.meta.url), "utf8"));
  const dir = new URL("../migrations/", import.meta.url);
  const files = (await readdir(dir)).filter(n => n.endsWith(".sql")).sort();
  const withdrawal = files.find(n => n.endsWith("_withdraw_premium_services.sql"));
  assert.ok(withdrawal);
  for (const name of files.filter(n => n < withdrawal)) await db.exec(await readFile(new URL(name, dir), "utf8"));
  for (const user of [owner, customer]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [user, `${user}@example.invalid`]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [user.replace("83000000", "84000000"), user]);
    await db.query("update public.profiles set first_name='Premium',last_name='Test',phone='+381641234567' where id=$1", [user]);
    await as(user, () => rpc("ensure_session_access"));
  }
  await db.query("insert into public.admin_memberships(user_id) values($1)", [owner]);
  const location = (await db.query("select id from public.locations where slug='neuzin'")).rows[0].id;
  const original = (await db.query("select id,slug,name,category,duration_minutes,sort_order,is_active from public.services order by sort_order")).rows;
  const premium = original.filter(s => s.category === "premium");
  const day = (await db.query("select ((now() at time zone 'Europe/Belgrade')::date+1)::text as day")).rows[0].day;
  const week = (await db.query("select date_trunc('week',$1::date)::date::text as week", [day])).rows[0].week;
  const at = async hour => (await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' as t", [day, `${hour}:00`])).rows[0].t.toISOString();
  await as(owner, async () => {
    await rpc("prepare_schedule_week", [week]);
    await rpc("save_schedule_draft", [week, 0, JSON.stringify([{ date: day, location_id: location, start_minute: 600, end_minute: 1080, breaks: [] }]), 60]);
    await rpc("publish_schedule_week", [week, 1]);
  });
  const confirmArgs = [id(10), location, premium[2].id, await at(10), 1, premium[2].name, premium[2].duration_minutes, null];
  const manualArgs = [id(11), location, premium[1].id, await at(11), 1, "Premium gost", premium[1].name, premium[1].duration_minutes, null];
  const booked = await as(customer, () => rpc("confirm_reviewed_reservation", confirmArgs));
  const manual = await as(owner, () => rpc("owner_create_reservation", manualArgs));
  const cancelled = await as(customer, async () => rpc("confirm_reviewed_reservation", [id(12), location, premium[0].id, await at(12), 1, premium[0].name, premium[0].duration_minutes, null]));
  await as(customer, () => rpc("cancel_reservation", [id(13), cancelled.id]));
  const snapshots = (await db.query("select * from public.reservations order by id")).rows;
  const migration = await readFile(new URL(withdrawal, dir), "utf8");
  await db.exec(migration);
  await check("withdrawal preserves all catalogue fields and every reservation snapshot", async () => {
    assert.deepEqual((await db.query("select id,slug,name,category,duration_minutes,sort_order,is_active from public.services order by sort_order")).rows, original.map(s => ({ ...s, is_active: s.category !== "premium" })));
    assert.deepEqual((await db.query("select * from public.reservations order by id")).rows, snapshots);
    await db.exec(migration); // Reapplying the data change is harmless.
  });
  await check("anonymous, customer and owner active catalogues contain four standard services", async () => {
    for (const user of [null, customer, owner]) await as(user, async () => {
      const rows = (await db.query("select category from public.services where is_active")).rows;
      assert.equal(rows.length, 4); assert.ok(rows.every(s => s.category === "standard"));
    });
  });
  await check("each withdrawn service rejects availability and direct public/manual confirmations", async () => {
    for (const [i, svc] of premium.entries()) {
      await as(null, async () => assert.equal((await rpc("availability_context", [day, location, svc.id])).reason, "inactive_service"));
      await as(customer, () => assert.rejects(rpc("confirm_reservation", [id(20 + i), location, svc.id, confirmArgs[3], 1, null]), /INACTIVE_SERVICE/));
      await as(customer, () => assert.rejects(rpc("confirm_reviewed_reservation", [id(30 + i), location, svc.id, confirmArgs[3], 1, svc.name, svc.duration_minutes, null]), /INACTIVE_SERVICE/));
      await as(owner, () => assert.rejects(rpc("owner_create_reservation", [id(40 + i), location, svc.id, confirmArgs[3], 1, "Gost", svc.name, svc.duration_minutes, null]), /INACTIVE_SERVICE/));
    }
    assert.deepEqual((await db.query("select * from public.reservations order by id")).rows, snapshots);
  });
  await check("existing public and manual request keys still resolve after withdrawal", async () => {
    assert.deepEqual(await as(customer, () => rpc("confirm_reviewed_reservation", confirmArgs)), booked);
    assert.deepEqual(await as(owner, () => rpc("owner_create_reservation", manualArgs)), manual);
  });
  await check("confirmed and cancelled premium visits remain in customer and owner history", async () => {
    const mine = await as(customer, () => rpc("get_my_appointments"));
    const all = await as(owner, () => rpc("get_owner_reservations", [day, day, null]));
    for (const [expected, rows] of [[booked, mine.reservations], [cancelled, mine.reservations], [manual, all.reservations]]) {
      const row = rows.find(r => r.id === expected.id);
      assert.equal(row.service_name, expected.service_name); assert.equal(row.duration_minutes, expected.duration_minutes);
    }
    assert.equal(mine.reservations.find(r => r.id === cancelled.id).status, "cancelled");
  });
  await check("owner can move a withdrawn-service visit with its original duration", async () => {
    const moved = await as(owner, async () => rpc("owner_update_reservation", [id(50), manual.id, manual.version, location, await at(14), 1, "Premium gost", null]));
    assert.equal(moved.service_name, manual.service_name); assert.equal(moved.duration_minutes, manual.duration_minutes);
    assert.equal(Date.parse(moved.ends_at) - Date.parse(moved.starts_at), manual.duration_minutes * 60000);
    await as(customer, () => rpc("cancel_reservation", [id(51), booked.id]));
    await as(owner, () => rpc("owner_cancel_reservation", [id(52), manual.id]));
  });
  await check("reactivating the same rows restores all seven services and booking without UI changes", async () => {
    await db.exec("update public.services set is_active=true where category='premium'");
    assert.deepEqual((await db.query("select id,slug,name,category,duration_minutes,sort_order,is_active from public.services order by sort_order")).rows, original);
    for (const [i, svc] of premium.entries()) {
      const result = await as(customer, async () => rpc("confirm_reviewed_reservation", [id(60 + i), location, svc.id, await at(10), 1, svc.name, svc.duration_minutes, null]));
      assert.equal(result.service_id, svc.id); assert.equal(result.duration_minutes, svc.duration_minutes);
      await as(customer, () => rpc("cancel_reservation", [id(70 + i), result.id]));
    }
  });
  console.log(JSON.stringify({ result: "PASS", checks: passed, scope: "isolated premium withdrawal and reactivation" }));
} finally { await db.close(); }
