import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// No URL, credentials, network connection or persistent database directory.
const db = await PGlite.create();
const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");
const ids = {
  existing: "90000000-0000-4000-8000-000000000001",
  admin: "90000000-0000-4000-8000-000000000002",
  user: "90000000-0000-4000-8000-000000000003",
  other: "90000000-0000-4000-8000-000000000004",
  unverified: "90000000-0000-4000-8000-000000000005",
};
let passed = 0;

async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${passed} - ${label}`);
  } catch (error) {
    throw new Error(label, { cause: error });
  }
}

async function scalar(sql, params = []) {
  const { rows } = await db.query(sql, params);
  return Object.values(rows[0])[0];
}

async function expectError(sql, code, { rollback = false } = {}) {
  let caught;
  try {
    await db.exec(sql);
  } catch (error) {
    caught = error;
  } finally {
    if (rollback) await db.exec("rollback;");
  }
  assert.ok(caught, `Expected PostgreSQL error ${code}`);
  const expectedCodes = Array.isArray(code) ? code : [code];
  assert.ok(expectedCodes.includes(caught.code), `${caught.code}: ${caught.message}; expected ${expectedCodes.join(" or ")}`);
}

async function as(role, id, fn) {
  assert.ok(["anon", "authenticated"].includes(role));
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({
      role,
      ...(id ? { sub: id } : {}),
      user_metadata: { is_admin: true, role: "admin" },
    }),
  ]);
  await db.exec(`set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

try {
  await db.exec(await read("./auth-fixture.sql"));
  await db.query("insert into auth.users (id, email) values ($1, $2)", [
    ids.existing, "existing@example.invalid",
  ]);

  const migrationDir = new URL("../migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const name of migrationNames) {
    await db.exec(await readFile(new URL(name, migrationDir), "utf8"));
  }
  const bootstrap = await read("../scripts/bootstrap_admin.sql");

  await check("all foundation migrations execute on a fresh PostgreSQL engine", async () => {
    assert.equal(migrationNames.length, 3);
    assert.equal(await scalar("select count(*)::int from pg_tables where schemaname = 'public'"), 5);
  });
  await check("all five business tables have RLS enabled", async () => {
    assert.equal(await scalar("select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity"), 5);
  });
  await check("existing Auth user is backfilled without profile details or authority", async () => {
    assert.equal(await scalar("select count(*)::int from public.profiles where id=$1 and first_name is null and phone is null", [ids.existing]), 1);
    assert.equal(await scalar("select count(*)::int from public.admin_memberships"), 0);
  });
  await check("seed contains exactly two locations and one unnamed barber", async () => {
    assert.deepEqual((await db.query("select name, address, phone from public.locations order by sort_order")).rows, [
      { name: "Zrenjanin", address: null, phone: null },
      { name: "Neuzin", address: null, phone: null },
    ]);
    assert.deepEqual((await db.query("select display_name from public.staff")).rows, [{ display_name: null }]);
  });
  await check("seven initial services have agreed categories and 20/40-minute durations", async () => {
    assert.deepEqual((await db.query("select name, category, duration_minutes from public.services order by sort_order")).rows, [
      { name: "Klasično šišanje", category: "standard", duration_minutes: 20 },
      { name: "Šišanje sa izbrijavanjem", category: "standard", duration_minutes: 20 },
      { name: "Brada", category: "standard", duration_minutes: 20 },
      { name: "Šišanje i brada", category: "standard", duration_minutes: 20 },
      { name: "Oblikovanje obrva britvom", category: "premium", duration_minutes: 40 },
      { name: "Tretman toplim peškirom", category: "premium", duration_minutes: 40 },
      { name: "Tretman ušnim svećama", category: "premium", duration_minutes: 40 },
    ]);
  });
  await check("admin bootstrap refuses an account that does not exist", async () => {
    await expectError(bootstrap, "P0001", { rollback: true });
  });

  await db.query("insert into auth.users (id, email) values ($1, $2)", [ids.admin, "sekosansebastijan@gmail.com"]);
  await check("admin bootstrap refuses an unverified account", async () => {
    await expectError(bootstrap, "P0001", { rollback: true });
  });
  for (const [id, email, verified] of [
    [ids.user, "user@example.invalid", true],
    [ids.other, "other@example.invalid", true],
    [ids.unverified, "unverified@example.invalid", false],
  ]) {
    await db.query("insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ($1,$2,$3,$4)", [
      id, email, verified ? new Date().toISOString() : null,
      JSON.stringify({ is_admin: true, role: "admin", first_name: "Untrusted", phone: "invalid" }),
    ]);
  }
  await check("signup trigger ignores untrusted profile/admin metadata", async () => {
    assert.equal(await scalar("select count(*)::int from public.profiles where id=$1 and first_name is null and phone is null and booking_blocked=false", [ids.user]), 1);
    assert.equal(await scalar("select count(*)::int from public.admin_memberships"), 0);
  });
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [ids.admin]);
  await db.exec(bootstrap);
  await check("verified admin can be provisioned with an incomplete profile", async () => {
    assert.equal(await scalar("select user_id from public.admin_memberships"), ids.admin);
    assert.equal(await scalar("select first_name from public.profiles where id=$1", [ids.admin]), null);
  });
  await check("repeating the same bootstrap is harmless", async () => {
    await db.exec(bootstrap);
    assert.equal(await scalar("select count(*)::int from public.admin_memberships"), 1);
  });
  await check("second admin and second barber are rejected by database constraints", async () => {
    await expectError(`insert into public.admin_memberships (user_id) values ('${ids.user}')`, "23505");
    await expectError("insert into public.staff default values", "23505");
  });
  await check("singleton=false cannot bypass the one-owner/one-barber rules", async () => {
    await expectError(`insert into public.admin_memberships (singleton,user_id) values (false,'${ids.user}')`, "23514");
    await expectError("insert into public.staff (singleton) values (false)", "23514");
  });
  await check("bootstrap does not replace an existing different administrator", async () => {
    await db.exec(`delete from public.admin_memberships; insert into public.admin_memberships (user_id) values ('${ids.user}');`);
    await expectError(bootstrap, "P0001", { rollback: true });
    assert.equal(await scalar("select user_id from public.admin_memberships"), ids.user);
    await db.exec("delete from public.admin_memberships;");
    await db.exec(bootstrap);
  });

  await as("anon", null, async () => {
    await check("anonymous visitors can read public locations/services", async () => {
      assert.equal(await scalar("select count(*)::int from public.locations"), 2);
      assert.equal(await scalar("select count(*)::int from public.services"), 7);
    });
    for (const table of ["profiles", "admin_memberships", "staff"]) {
      await check(`anonymous visitors cannot read ${table}`, () => expectError(`select * from public.${table}`, "42501"));
    }
    await check("anonymous visitors cannot call internal authority helper", () => expectError("select app_private.is_admin()", "42501"));
    await check("anonymous visitors cannot mutate public services", () => expectError("update public.services set duration_minutes=10", "42501"));
  });

  await as("authenticated", ids.user, async () => {
    await check("customer sees only their own profile", async () => {
      assert.deepEqual((await db.query("select id from public.profiles")).rows, [{ id: ids.user }]);
    });
    await check("forged metadata does not give customer admin authority", async () => {
      assert.equal(await scalar("select app_private.is_admin()"), false);
      assert.equal(await scalar("select count(*)::int from public.admin_memberships"), 0);
      assert.equal(await scalar("select count(*)::int from public.staff"), 0);
    });
    await check("customer can update their own name and canonical phone", async () => {
      const result = await db.query("update public.profiles set first_name=$1,last_name=$2,phone=$3 where id=$4 returning first_name,last_name,phone", ["Željko", "O'Neil", "+381641234567", ids.user]);
      assert.deepEqual(result.rows, [{ first_name: "Željko", last_name: "O'Neil", phone: "+381641234567" }]);
    });
    await check("international phone is accepted", async () => {
      await db.exec(`update public.profiles set phone='+447700900123' where id='${ids.user}'`);
    });
    await check("customer cannot read or change another customer's profile", async () => {
      assert.equal(await scalar("select count(*)::int from public.profiles where id=$1", [ids.other]), 0);
      assert.equal((await db.query("update public.profiles set first_name='Changed' where id=$1 returning id", [ids.other])).rows.length, 0);
    });
    for (const [field, value] of [["booking_blocked", "true"], ["id", `'${ids.other}'`], ["created_at", "now()"], ["updated_at", "now()"]]) {
      await check(`customer cannot write protected profile column ${field}`, () => expectError(`update public.profiles set ${field}=${value} where id='${ids.user}'`, "42501"));
    }
    await check("customer cannot assign themselves admin", () => expectError(`insert into public.admin_memberships (user_id) values ('${ids.user}')`, "42501"));
    await check("customer cannot delete or insert profiles", async () => {
      await expectError(`delete from public.profiles where id='${ids.user}'`, "42501");
      await expectError(`insert into public.profiles (id) values ('${ids.user}')`, "42501");
    });
    await check("blank/whitespace names and noncanonical phones are rejected", async () => {
      for (const assignment of ["first_name=''", "last_name='   '", "first_name=' Ana '", "phone='0641234567'", "phone='+381 64 1234567'", "phone='+0123'"]) {
        await expectError(`update public.profiles set ${assignment} where id='${ids.user}'`, "23514");
      }
    });
    await check("customer cannot call signup trigger function as RPC", () => expectError("select app_private.create_profile_for_auth_user()", "42501"));
  });

  await db.query("update public.profiles set phone='+447700900123' where id=$1", [ids.other]);
  await check("phone is contact information, not a unique account identity", async () => {
    assert.equal(await scalar("select count(*)::int from public.profiles where phone='+447700900123'"), 2);
  });
  await db.exec("update public.services set is_active=false where slug='brada'; update public.locations set is_active=false where slug='neuzin';");
  for (const [role, id] of [["anon", null], ["authenticated", ids.user]]) {
    await as(role, id, () => check(`${role} cannot read inactive public reference records`, async () => {
      assert.equal(await scalar("select count(*)::int from public.services"), 6);
      assert.equal(await scalar("select count(*)::int from public.locations"), 1);
    }));
  }

  await as("authenticated", ids.admin, async () => {
    await check("verified admin can read all profiles and inactive reference data", async () => {
      assert.equal(await scalar("select app_private.is_admin()"), true);
      assert.equal(await scalar("select count(*)::int from public.profiles"), 5);
      assert.equal(await scalar("select count(*)::int from public.services"), 7);
      assert.equal(await scalar("select count(*)::int from public.locations"), 2);
      assert.equal(await scalar("select count(*)::int from public.staff"), 1);
    });
    await check("admin can edit their own profile but cannot directly edit another profile", async () => {
      assert.equal((await db.query("update public.profiles set first_name='Admin' where id=$1 returning id", [ids.admin])).rows.length, 1);
      assert.equal((await db.query("update public.profiles set first_name='Changed' where id=$1 returning id", [ids.other])).rows.length, 0);
    });
    await check("admin's browser session cannot bypass future controlled mutations", async () => {
      await expectError("update public.profiles set booking_blocked=true", "42501");
      await expectError("update public.services set duration_minutes=50", "42501");
      await expectError("delete from public.admin_memberships", "42501");
      await expectError("delete from public.locations", "42501");
    });
  });
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [ids.admin]);
  await as("authenticated", ids.admin, () => check("unverified email cannot exercise provisioned admin authority", async () => {
    assert.equal(await scalar("select app_private.is_admin()"), false);
    assert.equal(await scalar("select count(*)::int from public.profiles"), 1);
    assert.equal(await scalar("select count(*)::int from public.staff"), 0);
  }));
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [ids.admin]);

  await check("duration rule rejects zero, negative and non-10-minute values", async () => {
    for (const duration of [0, -10, 15, 25]) {
      await expectError(`update public.services set duration_minutes=${duration} where slug='brada'`, "23514");
    }
  });
  await check("duration accepts 10-minute steps without an arbitrary business maximum", async () => {
    for (const duration of [10, 30, 250, 100000]) {
      await db.exec(`update public.services set duration_minutes=${duration} where slug='brada'`);
    }
  });
  await check("unsupported service category is rejected", () => expectError("update public.services set category='other' where slug='brada'", "23514"));
  await check("current admin account cannot be deleted accidentally", async () => {
    // PostgreSQL versions report RESTRICT as 23001 or foreign_key_violation.
    await expectError(`delete from auth.users where id='${ids.admin}'`, ["23001", "23503"]);
    assert.equal(await scalar("select count(*)::int from public.profiles where id=$1", [ids.admin]), 1);
    assert.equal(await scalar("select user_id from public.admin_memberships"), ids.admin);
  });
  await check("ordinary Auth deletion does not leave an orphan profile", async () => {
    await db.query("delete from auth.users where id=$1", [ids.unverified]);
    assert.equal(await scalar("select count(*)::int from public.profiles where id=$1", [ids.unverified]), 0);
  });
  await check("no trigger/helper has default PUBLIC/anonymous execution privileges", async () => {
    for (const fn of ["is_admin()", "set_updated_at()", "create_profile_for_auth_user()"]) {
      assert.equal(await scalar("select has_function_privilege('anon',$1,'execute')", [`app_private.${fn}`]), false);
    }
    assert.equal(await scalar("select has_schema_privilege('authenticated','app_private','create')"), false);
  });

  console.log(JSON.stringify({ result: "PASS", checks: passed, engine: "PGlite in-memory PostgreSQL", postgres: await scalar("select current_setting('server_version')"), migrations: migrationNames, scope: "SQL/ACL/RLS only; Supabase Auth and Data API are not running" }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", checks: passed, message: error.message, cause: error.cause?.message, code: error.cause?.code ?? error.code }, null, 2));
  process.exitCode = 1;
} finally {
  await db.close();
}
