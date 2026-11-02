import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = await PGlite.create();
let passed = 0;
const check = async (name, fn) => { await fn(); console.log(`ok ${++passed} - ${name}`); };
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql", import.meta.url), "utf8"));
  const dir = new URL("../migrations/", import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, dir), "utf8"));
  const today = (await db.query("select (statement_timestamp() at time zone 'Europe/Belgrade')::date::text as date")).rows[0].date;
  const location = (await db.query("select id from public.locations where slug='zrenjanin'")).rows[0].id;
  const service = (await db.query("select id from public.services where is_active limit 1")).rows[0].id;
  const rpc = async (date = today, loc = location, svc = service) => (await db.query("select public.availability_context($1,$2,$3) as result", [date, loc, svc])).rows[0].result;
  await check("strict schedule validation rejects missing fields, nulls, fractions and non-Monday", async () => {
    for (const value of [{}, { date: "2026-11-02", location_id: location, start_minute: null, end_minute: 800, breaks: [] }, { date: "2026-11-02", location_id: location, start_minute: 600.5, end_minute: 800, breaks: [] }]) {
      assert.equal((await db.query("select app_private.validate_schedule('2026-11-02',$1,60) as valid", [JSON.stringify([value])])).rows[0].valid, false);
    }
    assert.equal((await db.query("select app_private.validate_schedule('2026-11-03','[]',60) as valid")).rows[0].valid, false);
  });
  await db.exec("set role anon");
  await check("anonymous availability uses server clock and unpublished snapshot", async () => {
    const result = await rpc(); assert.equal(result.week, null); assert.ok(result.server_time); assert.ok(result.service.active);
  });
  await check("horizon and inactive ids are checked before exposing occupied intervals", async () => {
    const beyond = (await db.query("select ((statement_timestamp() at time zone 'Europe/Belgrade')::date+15)::text as date")).rows[0].date;
    assert.equal((await rpc(beyond)).reason, "outside_horizon");
    assert.equal((await rpc(today, "00000000-0000-0000-0000-000000000000")).reason, "inactive_location");
    assert.equal((await rpc(today, location, "00000000-0000-0000-0000-000000000000")).reason, "inactive_service");
  });
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await check(`${role} cannot read or insert private reservation rows`, async () => {
      await assert.rejects(db.query("select * from public.reservations"));
      await assert.rejects(db.query("insert into public.reservations default values"));
    });
  }
  await db.exec("reset role");
  const staff = (await db.query("select id from public.staff limit 1")).rows[0].id;
  await db.query("insert into public.reservations(staff_id,location_id,starts_at,ends_at,status) values ($1,$2,$3::date+interval '10 hours',$3::date+interval '11 hours','confirmed'),($1,$2,$3::date+interval '12 hours',$3::date+interval '13 hours','cancelled')", [staff, location, today]);
  await db.exec("set role anon");
  await check("public context exposes confirmed occupancy without row ids or customer data", async () => {
    const result = await rpc(); assert.equal(result.occupied.length, 1);
    assert.deepEqual(Object.keys(result.occupied[0]).sort(), ["end", "location_id", "start"]);
  });
} finally { await db.close(); }
