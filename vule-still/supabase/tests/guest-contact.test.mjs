import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const id = n => `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [owner, phoneGuest, emailGuest, duplicateContact, unverified] = [1, 2, 3, 4, 5].map(id);
let passed = 0;
const check = async (name, fn) => { await fn(); console.log(`ok ${++passed} - ${name}`); };
const rpc = async (name, args = []) => (await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as result`, args)).rows[0].result;
async function as(user, fn) {
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, session_id: user ? user.replace("81000000", "82000000") : null, role: user ? "authenticated" : "anon", user_metadata: { is_admin: true } })]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql", import.meta.url), "utf8"));
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter(n => n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(name, dir), "utf8"));
  await check("updated catalogue and reversible Neuzin-only booking gate", async () => {
    const services = (await db.query("select slug,name,duration_minutes from public.services")).rows;
    for (const [slug, minutes] of [["sisanje-i-brada", 30], ["brada", 10], ["tretman-toplim-peskirom", 20], ["oblikovanje-obrva-britvom", 10]]) assert.equal(services.find(s => s.slug === slug).duration_minutes, minutes);
    assert.equal(services.find(s => s.slug === "tretman-toplim-peskirom").name, "Sređivanje brade sa toplim peškirom");
    assert.deepEqual((await db.query("select slug,booking_enabled,is_active from public.locations order by slug")).rows, [
      { slug: "neuzin", booking_enabled: true, is_active: true }, { slug: "zrenjanin", booking_enabled: false, is_active: true },
    ]);
  });
  for (const user of [owner, phoneGuest, emailGuest, duplicateContact, unverified]) {
    const guest = [phoneGuest, emailGuest, duplicateContact].includes(user);
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,$3,$4)", [user, guest ? null : `${user}@example.invalid`, user === owner ? new Date() : null, guest]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)", [user.replace("81000000", "82000000"), user]);
    await as(user, () => rpc("ensure_session_access"));
  }
  await db.query("insert into public.admin_memberships(user_id) values($1)", [owner]);
  for (const user of [phoneGuest, duplicateContact]) await as(user, () => db.query("update public.profiles set first_name='Test',last_name='Gost',phone='+381641234567' where id=$1", [user]));
  await as(emailGuest, () => db.query("update public.profiles set first_name='Mejl',last_name='Gost',contact_email='guest@example.invalid' where id=$1", [emailGuest]));
  const ne = (await db.query("select id from public.locations where slug='neuzin'")).rows[0].id;
  const zr = (await db.query("select id from public.locations where slug='zrenjanin'")).rows[0].id;
  const svc = (await db.query("select * from public.services where slug='sisanje-i-brada'")).rows[0];
  const day = (await db.query("select ((now() at time zone 'Europe/Belgrade')::date+1)::text as day")).rows[0].day;
  const week = (await db.query("select date_trunc('week',$1::date)::date::text as week", [day])).rows[0].week;
  const time = async hour => (await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' as t", [day, `${hour}:00`])).rows[0].t.toISOString();
  await as(owner, async () => {
    await rpc("prepare_schedule_week", [week]);
    await rpc("save_schedule_draft", [week, 0, JSON.stringify([{ date: day, location_id: ne, start_minute: 600, end_minute: 1080, breaks: [] }]), 60]);
    await rpc("publish_schedule_week", [week, 1]);
  });
  const confirm = async (n, hour = 10, loc = ne) => rpc("confirm_reviewed_reservation", [id(n), loc, svc.id, await time(hour), 1, svc.name, 30, null]);
  let first;
  await check("phone-only guest books without verified Auth email; retry stays idempotent", async () => {
    first = await as(phoneGuest, () => confirm(11));
    assert.equal(first.duration_minutes, 30);
    assert.deepEqual(await as(phoneGuest, () => confirm(11)), first);
  });
  await check("email-only guest books without a phone or confirmation", async () => {
    const result = await as(emailGuest, () => confirm(12, 11));
    assert.equal(result.attendee_name, "Mejl Gost");
  });
  await check("same unverified phone creates no access to previous guest's data", async () => {
    await as(duplicateContact, async () => {
      assert.equal((await rpc("get_my_appointments")).reservations.length, 0);
      assert.equal((await db.query("select id from public.profiles where id=$1", [phoneGuest])).rows.length, 0);
      await assert.rejects(rpc("cancel_reservation", [id(13), first.id]), /RESERVATION_NOT_FOUND/);
    });
  });
  await check("unregistered visitor, unverified permanent user and guest owner attempts fail", async () => {
    await as(null, () => assert.rejects(confirm(14)));
    await as(unverified, () => assert.rejects(confirm(14), /SESSION_REQUIRED/));
    await as(phoneGuest, async () => {
      await assert.rejects(rpc("get_owner_reservations", [day, day, null]), /OWNER_REQUIRED/);
      await assert.rejects(db.query("update public.profiles set booking_blocked=false where id=$1", [phoneGuest]));
      await assert.rejects(db.query("insert into public.admin_memberships(user_id) values($1)", [phoneGuest]));
    });
  });
  await check("closed Zrenjanin rejected by public availability and direct customer/owner writes", async () => {
    await as(null, async () => assert.equal((await rpc("availability_context", [day, zr, svc.id])).reason, "inactive_location"));
    await as(phoneGuest, () => assert.rejects(confirm(15, 12, zr), /INACTIVE_LOCATION/));
    const start = await time(12);
    await as(owner, () => assert.rejects(rpc("owner_create_reservation", [id(15), zr, svc.id, start, 1, "Test", svc.name, 30, null]), /INACTIVE_LOCATION/));
  });
  await check("owner sees optional contact email, while service changes preserve booked snapshots", async () => {
    const data = await as(owner, () => rpc("get_owner_reservations", [day, day, null]));
    assert.equal(data.reservations.find(r => r.user_id === emailGuest).email, "guest@example.invalid");
    await db.query("update public.services set duration_minutes=40 where id=$1", [svc.id]);
    assert.equal((await db.query("select duration_minutes from public.reservations where id=$1", [first.id])).rows[0].duration_minutes, 30);
  });
  await check("guest can cancel own reservation; revoked session cannot read history", async () => {
    await as(phoneGuest, async () => assert.equal((await rpc("cancel_reservation", [id(16), first.id])).status, "cancelled"));
    await db.query("delete from auth.sessions where user_id=$1", [phoneGuest]);
    await as(phoneGuest, () => assert.rejects(rpc("get_my_appointments"), /SESSION_REQUIRED/));
  });
  console.log(JSON.stringify({ result: "PASS", checks: passed, scope: "in-memory SQL with Auth session fixtures" }));
} finally { await db.close(); }
