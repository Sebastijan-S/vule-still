import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const user = "90000000-0000-4000-8000-000000000041";
const session = "90000000-0000-4000-8000-000000000042";
const week = "2026-11-02";
let passed = 0;
async function check(name, fn) { await fn(); console.log(`ok ${++passed} - ${name}`); }
async function as(role, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, role, session_id: session })]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const rpc = (name, args) => db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`, args);
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql", import.meta.url), "utf8"));
  const migrations = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(migrations)).filter(n=>n.endsWith(".sql")).sort()) {
    try { await db.exec(await readFile(new URL(name,migrations), "utf8")); }
    catch (error) { console.error(name,error.message,error.position); throw error; }
  }
  await check("template has six days, two shifts per day, no Sunday", async () => {
    assert.equal((await db.query("select count(*)::int as n from public.schedule_templates")).rows[0].n,12);
  });
  await check("unpublished week has no public schedule", async () => {
    assert.equal((await rpc("published_schedule",[week])).rows[0].result,null);
  });
  await as("anon", async () => {
    await check("anonymous cannot prepare or read owner data", async () => {
      await assert.rejects(rpc("prepare_schedule_week",[week]));
      await assert.rejects(db.query("select * from public.schedule_weeks"));
    });
  });
  await db.query("insert into auth.users (id,email,email_confirmed_at) values ($1,'owner@example.invalid',now())",[user]);
  await db.query("insert into auth.sessions (id,user_id) values ($1,$2)",[session,user]);
  await db.query("insert into public.admin_memberships (user_id) values ($1)",[user]);
  await as("authenticated",async()=> {
    await rpc("ensure_session_access",[]);
    await check("non-Monday cannot be prepared",async()=>{
      await assert.rejects(rpc("prepare_schedule_week",["2026-11-03"]));
    });
    const prepared=(await rpc("prepare_schedule_week",[week])).rows[0].result;
    await check("owner prepares draft but public still sees none",async()=>{
      assert.equal(prepared.draft.length,12);
      assert.equal((await rpc("published_schedule",[week])).rows[0].result,null);
    });
    const reduced=prepared.draft.filter(e=>e.date!=="2026-11-03");
    const rev=(await rpc("save_schedule_draft",[week,0,JSON.stringify(reduced),60])).rows[0].result;
    await check("draft edit increments revision and rejects stale write",async()=>{
      assert.equal(rev,1);
      await assert.rejects(rpc("save_schedule_draft",[week,0,JSON.stringify(reduced),60]));
    });
    await check("overlap and insufficient travel gap fail",async()=>{
      const overlap=[...reduced,{...reduced[0],start_minute:650,end_minute:700}];
      await assert.rejects(rpc("save_schedule_draft",[week,1,JSON.stringify(overlap),60]));
      const tooClose=[...reduced];
      const second=tooClose.find(e=>e.date===week && e.start_minute===1020);
      second.start_minute=930;
      await assert.rejects(rpc("save_schedule_draft",[week,1,JSON.stringify(tooClose),60]));
    });
    await check("invalid break fails",async()=>{
      const broken=structuredClone(reduced);
      broken[0].breaks=[{start_minute:700,end_minute:900},{start_minute:800,end_minute:850}];
      await assert.rejects(rpc("save_schedule_draft",[week,1,JSON.stringify(broken),60]));
    });
    await check("date outside week and duplicate shifts fail",async()=>{
      await assert.rejects(rpc("save_schedule_draft",[week,1,JSON.stringify([...reduced,{...reduced[0],date:"2026-11-09"}]),60]));
      await assert.rejects(rpc("save_schedule_draft",[week,1,JSON.stringify([...reduced,reduced[0]]),60]));
    });
    const published=(await rpc("publish_schedule_week",[week,1])).rows[0].result;
    await check("publish exposes only snapshot and rejects stale revision",async()=>{
      assert.equal(published,1);
      assert.equal((await rpc("published_schedule",[week])).rows[0].result.entries.length,10);
      await assert.rejects(rpc("publish_schedule_week",[week,0]));
    });
    await rpc("save_schedule_draft",[week,1,JSON.stringify(prepared.draft),0]);
    await check("new draft and gap leave published snapshot unchanged",async()=>{
      const live=(await rpc("published_schedule",[week])).rows[0].result;
      assert.equal(live.entries.length,10);
      assert.equal(live.travel_gap_minutes,60);
    });
  });
  await as("anon",async()=>{
    await check("anonymous sees published facts, never draft",async()=>{
      const result=(await rpc("published_schedule",[week])).rows[0].result;
      assert.equal(result.entries.length,10);
      assert.equal(result.draft,undefined);
      await assert.rejects(rpc("get_owner_schedule",[week]));
    });
  });
} finally { await db.close(); }
