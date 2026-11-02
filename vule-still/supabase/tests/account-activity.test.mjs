import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const fixture = new URL("./auth-fixture.sql", import.meta.url);
const migrations = new URL("../migrations/", import.meta.url);
const user = "90000000-0000-4000-8000-000000000021";
const other = "90000000-0000-4000-8000-000000000022";
const phone = "90000000-0000-4000-8000-000000000031";
const desktop = "90000000-0000-4000-8000-000000000032";
const fresh = "90000000-0000-4000-8000-000000000033";
const admin = "90000000-0000-4000-8000-000000000023";
const adminSession = "90000000-0000-4000-8000-000000000034";
let passed = 0;
async function check(label, fn) { await fn(); console.log(`ok ${++passed} - ${label}`); }
async function as(id, session, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, role: "authenticated", session_id: session })]);
  await db.exec("set role authenticated");
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0];
try {
  await db.exec(await readFile(fixture, "utf8"));
  for (const name of (await readdir(migrations)).filter(n => n.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(name, migrations), "utf8"));
  }
  await db.query("insert into auth.users (id,email,email_confirmed_at) values ($1,'phase3-a@example.invalid',now()),($2,'phase3-b@example.invalid',now())", [user, other]);
  await db.query("insert into auth.sessions (id,user_id) values ($1,$3),($2,$3)", [phone, desktop, user]);
  await check("new Auth users get account activity, but no writable access table grant", async () => {
    assert.equal(await scalar("select count(*)::int from public.account_activity"), 2);
    assert.equal(await scalar("select has_table_privilege('authenticated','public.account_activity','UPDATE')"), false);
    assert.equal(await scalar("select has_table_privilege('authenticated','public.session_access','INSERT')"), false);
  });
  await as(user, phone, async () => {
    await check("unregistered session has no private profile access", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 0);
    });
    await check("signed Auth session can register itself", async () => {
      assert.equal(await scalar("select public.ensure_session_access()"), true);
      assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    });
    await check("caller cannot directly edit account activity", async () => {
      await assert.rejects(db.exec("update public.account_activity set last_activity_at=now()"), { code: "42501" });
    });
  });
  await as(user, desktop, async () => {
    await check("second device has independent registration", async () => {
      assert.equal(await scalar("select public.ensure_session_access()"), true);
      assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    });
  });
  await check("repeated access check does not count as activity", async () => {
    const before = await scalar(`select last_activity_at::text from public.account_activity where user_id='${user}'`);
    await as(user, desktop, async () => assert.equal(await scalar("select public.ensure_session_access()"), true));
    const after = await scalar(`select last_activity_at::text from public.account_activity where user_id='${user}'`);
    assert.equal(after, before);
  });
  await db.query("update public.account_activity set last_activity_at=statement_timestamp()-interval '29 days' where user_id=$1", [user]);
  await as(user, phone, async () => {
    await check("activity on phone extends the whole account", async () => {
      assert.equal(await scalar("select public.record_user_activity()"), true);
    });
  });
  await as(user, desktop, async () => {
    await check("desktop remains authorized after phone activity", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    });
  });
  await db.query("update public.account_activity set last_activity_at=statement_timestamp()-interval '30 days' + interval '1 minute' where user_id=$1", [user]);
  await as(user, desktop, async () => {
    await check("one minute before expiry remains authorized", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    });
  });
  await db.query("update public.account_activity set last_activity_at=statement_timestamp()-interval '30 days' where user_id=$1", [user]);
  await as(user, phone, async () => {
    await check("at 30 days old session cannot read, touch or revive", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 0);
      assert.equal(await scalar("select public.record_user_activity()"), false);
      assert.equal(await scalar("select public.ensure_session_access()"), false);
    });
  });
  await db.query("update public.account_activity set last_activity_at=statement_timestamp()-interval '30 days' - interval '1 minute' where user_id=$1", [user]);
  await as(user, desktop, async () => {
    await check("one minute after expiry remains denied", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 0);
    });
  });
  await db.query("insert into auth.sessions (id,user_id) values ($1,$2)", [fresh, user]);
  await as(user, fresh, async () => {
    await check("fresh authentication after expiry resets only new session", async () => {
      assert.equal(await scalar("select public.ensure_session_access()"), true);
      assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    });
  });
  await db.query("insert into auth.users (id,email,email_confirmed_at) values ($1,'sekosansebastijan@gmail.com',now())", [admin]);
  await db.query("insert into auth.sessions (id,user_id) values ($1,$2)", [adminSession, admin]);
  await db.exec(await readFile(new URL("../scripts/bootstrap_admin.sql", import.meta.url), "utf8"));
  await as(admin, adminSession, async () => {
    await check("verified owner needs registered session for admin reads", async () => {
      assert.equal(await scalar("select count(*)::int from public.staff"), 0);
      assert.equal(await scalar("select public.ensure_session_access()"), true);
      assert.equal(await scalar("select count(*)::int from public.staff"), 1);
    });
  });
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [admin]);
  await as(admin, adminSession, async () => {
    await check("owner with unverified email loses admin access", async () => {
      assert.equal(await scalar("select count(*)::int from public.staff"), 0);
    });
  });
  await as(user, desktop, async () => {
    await check("old desktop session stays denied after fresh login", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 0);
      assert.equal(await scalar("select public.ensure_session_access()"), false);
    });
  });
  await as(other, phone, async () => {
    await check("forged user/session pairing cannot register", async () => {
      assert.equal(await scalar("select public.ensure_session_access()"), false);
    });
  });
  await db.query("delete from auth.sessions where id=$1", [fresh]);
  await as(user, fresh, async () => {
    await check("revoked Auth session loses direct profile access", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles"), 0);
    });
  });
  console.log(JSON.stringify({ result: "PASS", checks: passed, engine: "isolated PGlite; Auth claims and sessions are fixtures" }));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", checks: passed, message: error.message, code: error.code }));
  process.exitCode = 1;
} finally { await db.close(); }
