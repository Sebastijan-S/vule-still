// Real parallel HTTP requests, exclusively against the disposable test project.
// --preflight logs in existing synthetic accounts and probes the RPC with null
// input; it creates no account/booking/schedule data. Full run requires the gate.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { calculateAvailability, addCalendarDays } from "../src/lib/availability.ts";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || new URL(url).hostname!=="xfbjgxtgvlyndonhlupm.supabase.co" || !key) throw new Error("Restricted to Vule-still-test");
const fixture=JSON.parse(await readFile(new URL("../.env.phase6-state.local",import.meta.url),"utf8"));
for (const [role,account] of Object.entries(fixture)) {
  if (!["owner","customer"].includes(role) || !new RegExp(`^vule-phase6-${role}-.+@example\\.invalid$`).test(account.email)) throw new Error("Existing synthetic accounts required");
}
const makeClient=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
const owner=makeClient(), alice=makeClient(), bob=makeClient();
const tokens=new Map(); let checks=0, original=null, week=null, scheduleTouched=false, fixtureDate=null;
const run=`F7 ${randomUUID()}`;
const logCheck=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
async function login(client,account) {
  const {data,error}=await client.auth.signInWithPassword(account);
  assert.equal(error,null,"Synthetic login failed");tokens.set(client,data.session.access_token);
  const access=await client.rpc("ensure_session_access");assert.equal(access.error,null);assert.equal(access.data,true);
}
async function call(client,name,args) {
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:"POST",headers:{apikey:key,authorization:`Bearer ${tokens.get(client)??key}`,"content-type":"application/json"},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});
  const data=await response.json();
  return {ok:response.ok,status:response.status,data:response.ok?data:null,error:response.ok?null:data};
}
async function rpc(client,name,args) {
  const result=await call(client,name,args);
  assert.equal(result.ok,true,`${name}: ${result.status}/${result.error?.code}/${result.error?.message}`);return result.data;
}
async function rows(client,table) {
  const result=await client.from(table).select("*");assert.equal(result.error,null,`${table} read failed`);return result.data;
}
async function cleanup() {
  for (const client of [alice,bob]) if (tokens.has(client)) {
    for (const r of (await rows(client,"reservations")).filter(r=>r.attendee_name===run && r.status==="confirmed")) {
      await rpc(client,"cancel_reservation",{p_request_key:randomUUID(),p_reservation:r.id});
    }
  }
  if (fixtureDate && tokens.has(owner)) {
    const state=await rpc(owner,"get_owner_reservations",{p_from:fixtureDate,p_to:fixtureDate});
    for (const r of state.reservations.filter(r=>r.attendee_name===run && r.status==="confirmed")) {
      await rpc(owner,"owner_cancel_reservation",{p_request_key:randomUUID(),p_reservation:r.id});
    }
  }
}
async function save(entries,gap) {
  const current=await rpc(owner,"get_owner_schedule",{p_week:week});
  return rpc(owner,"save_schedule_draft",{p_week:week,p_expected_revision:current.draft_revision,p_entries:entries,p_gap:gap});
}
async function restore() {
  if (!original || !scheduleTouched) return;
  let rev=await save(original.published,original.published_gap_minutes);
  await rpc(owner,"publish_schedule_week",{p_week:week,p_expected_revision:rev});
  await save(original.draft,original.travel_gap_minutes);
  const after=await rpc(owner,"get_owner_schedule",{p_week:week});
  assert.deepEqual(after.draft,original.draft);assert.deepEqual(after.published,original.published);
  assert.equal(after.travel_gap_minutes,original.travel_gap_minutes);assert.equal(after.published_gap_minutes,original.published_gap_minutes);
  scheduleTouched=false;
}

try {
  await login(owner,fixture.owner);await login(alice,fixture.customer);
  const probe=await call(alice,"confirm_reservation",{p_request_key:null,p_location:null,p_service:null,p_start:null,p_expected_revision:null});
  if (probe.error?.code==="PGRST202") throw new Error("MIGRATION_MISSING: phase-7 RPC is absent; no booking, account or schedule fixtures were created");
  assert.equal(probe.error?.message,"INVALID_INPUT",`Unexpected phase-7 contract: ${probe.status}/${probe.error?.code}`);
  if (process.argv.includes("--preflight")) {
    console.log(JSON.stringify({result:"PASS",scope:"authenticated RPC readiness only; no concurrency claims",project:new URL(url).hostname}));
  } else {
    const settings=await fetch(`${url}/auth/v1/settings`,{headers:{apikey:key},signal:AbortSignal.timeout(20000)}).then(r=>r.json());
    assert.equal(settings.mailer_autoconfirm,true,"No email may be requested by this test");
    const accountPath=new URL("../.env.phase7-state.local",import.meta.url);
    let account;
    try { account=JSON.parse(await readFile(accountPath,"utf8")); }
    catch (error) {
      if (error.code!=="ENOENT") throw error;
      account={email:`vule-phase7-customer-${randomUUID()}@example.invalid`,password:randomBytes(24).toString("base64url")};
      // Persist before signup so an interrupted run does not lose its fixture.
      await writeFile(accountPath,JSON.stringify(account),{flag:"wx"});
      const result=await bob.auth.signUp(account);assert.equal(result.error,null,"Synthetic signup failed");
    }
    assert.match(account.email,/^vule-phase7-customer-.+@example\.invalid$/);
    await login(bob,account);
    for (const client of [alice,bob]) {
      const own=await rows(client,"profiles");assert.equal(own.length,1);
      if (!own[0].first_name || !own[0].last_name || !own[0].phone) {
        const result=await client.from("profiles").update({first_name:"Test",last_name:"Rezervacija",phone:"+381641234567"}).eq("id",own[0].id);
        assert.equal(result.error,null);
      }
    }
    const locations=await rows(alice,"locations"),services=await rows(alice,"services");
    const zr=locations.find(l=>l.slug==="zrenjanin"),ne=locations.find(l=>l.slug==="neuzin");
    const service=services.find(s=>s.duration_minutes===20 && s.is_active),premium=services.find(s=>s.duration_minutes===40 && s.is_active);
    assert.ok(zr && ne && service && premium);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Belgrade",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    let date,availability;
    for (let offset=1;offset<=14;offset++) {
      const candidate=addCalendarDays(today,offset);
      const context=await rpc(alice,"availability_context",{p_date:candidate,p_location:zr.id,p_service:premium.id});
      const available=calculateAvailability(candidate,zr.id,context);
      if (available.slots.length>=3 && context.occupied.length===0) {date=candidate;availability=available;break;}
    }
    assert.ok(date,"Need an empty published synthetic test day within horizon");
    fixtureDate=date;
    const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);week=d.toISOString().slice(0,10);
    original=await rpc(owner,"get_owner_schedule",{p_week:week});assert.ok(original.published);
    const start=availability.slots[0].start;
    const confirm=(client,requestKey=randomUUID(),location=zr.id,svc=service.id,revision=original.published_revision)=>call(client,"confirm_reservation",{
      p_request_key:requestKey,p_location:location,p_service:svc,p_start:start,p_expected_revision:revision,p_attendee:run});
    const concurrent=async(label,requests)=>{
      const started=Date.now();const results=await Promise.all(requests.map(fn=>fn()));
      console.log(JSON.stringify({scenario:label,elapsed_ms:Date.now()-started,responses:results.map(r=>({status:r.status,code:r.error?.code??null,message:r.error?.message??null}))}));return results;
    };
    await logCheck("real parallel same-slot requests: exactly one winner, loser returns conflict",async()=>{
      const results=await concurrent("same-slot",[()=>confirm(alice),()=>confirm(bob)]);
      assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error.message,"SLOT_TAKEN");
      const created=(await Promise.all([rows(alice,"reservations"),rows(bob,"reservations")])).flat().filter(r=>r.attendee_name===run && r.status==="confirmed");assert.equal(created.length,1);
    });await cleanup();
    await logCheck("parallel overlapping durations and cross-location requests cannot both succeed",async()=>{
      for (const [label,location,svc] of [["overlap-20-40",zr.id,premium.id],["cross-location",ne.id,service.id]]) {
        const results=await concurrent(label,[()=>confirm(alice),()=>confirm(bob,randomUUID(),location,svc)]);
        assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error.message,"SLOT_TAKEN");await cleanup();
      }
    });
    await logCheck("parallel same-key requests and discarded-response retry return one durable reservation",async()=>{
      const requestKey=randomUUID();
      const results=await concurrent("same-key",[()=>confirm(alice,requestKey),()=>confirm(alice,requestKey)]);
      assert.equal(results.every(r=>r.ok),true);assert.deepEqual(results[0].data,results[1].data);
      // Discard both responses; repeat exact payload, as after a lost response.
      const retry=await confirm(alice,requestKey);assert.deepEqual(retry.data,results[0].data);
      const mine=(await rows(alice,"reservations")).filter(r=>r.attendee_name===run && r.status==="confirmed");assert.equal(mine.length,1);
      const notifications=(await rows(alice,"booking_notifications")).filter(n=>n.reservation_id===mine[0].id);assert.equal(notifications.length,1);
      const incompatible=await confirm(alice,requestKey,zr.id,premium.id);assert.equal(incompatible.error.message,"KEY_REUSED");
    });
    await logCheck("foreign reservation/notifications/cancellation and direct write bypass are denied",async()=>{
      const mine=(await rows(alice,"reservations")).find(r=>r.attendee_name===run && r.status==="confirmed");assert.ok(mine);
      assert.equal((await rows(bob,"reservations")).some(r=>r.id===mine.id),false);
      assert.equal((await rows(bob,"booking_notifications")).some(n=>n.reservation_id===mine.id),false);
      const forbidden=await call(bob,"cancel_reservation",{p_request_key:randomUUID(),p_reservation:mine.id});assert.equal(forbidden.error.message,"RESERVATION_NOT_FOUND");
      for (const table of ["reservations","booking_notifications","booking_audit","booking_mutation_keys"]) assert.ok((await bob.from(table).insert({})).error);
      for (const name of ["preview_schedule_publication","publish_schedule_with_impact"]) {
        const response=await call(owner,name,{});assert.equal(response.error.code,"PGRST202","Deferred bulk-cancellation RPC must be absent");
      }
      const publicContext=await rpc(alice,"availability_context",{p_date:date,p_location:zr.id,p_service:service.id});
      assert.ok(publicContext.occupied.every(r=>Object.keys(r).sort().join() === "end,location_id,start,travel_gap_minutes"));
    });await cleanup();
    await logCheck("three real booking/publication races preserve exactly one valid outcome and restore schedule",async()=>{
      for (let i=0;i<3;i++) {
        const current=await rpc(owner,"get_owner_schedule",{p_week:week});
        scheduleTouched=true;
        const revision=await save(original.published.filter(s=>s.date!==date),original.published_gap_minutes);
        const results=await concurrent(`publication-race-${i+1}`,[
          ()=>confirm(alice,randomUUID(),zr.id,service.id,current.published_revision),
          ()=>call(owner,"publish_schedule_week",{p_week:week,p_expected_revision:revision})]);
        assert.equal(results.filter(r=>r.ok).length,1);
        assert.equal(results[0].ok ? results[1].error.message : results[0].error.message,results[0].ok ? "SCHEDULE_RESERVATION_CONFLICT" : "SCHEDULE_CHANGED");
        const after=await rpc(owner,"get_owner_schedule",{p_week:week});
        const booked=(await rows(alice,"reservations")).filter(r=>r.attendee_name===run && r.status==="confirmed");
        assert.equal(booked.length,results[0].ok?1:0);
        if (results[0].ok) assert.deepEqual(after.published,original.published);
        else assert.equal(after.published.some(s=>s.date===date),false);
        await cleanup();await restore();
      }
    });
    await logCheck("real parallel customer/manual owner booking has one winner; customers denied owner RPCs",async()=>{
      const revision=(await rpc(owner,"get_owner_schedule",{p_week:week})).published_revision;
      const results=await concurrent("customer-versus-manual",[
        ()=>confirm(alice,randomUUID(),zr.id,service.id,revision),
        ()=>call(owner,"owner_create_reservation",{p_request_key:randomUUID(),p_location:zr.id,p_service:service.id,p_start:start,p_expected_revision:revision,p_name:run,p_expected_name:service.name,p_expected_duration:service.duration_minutes})]);
      assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error.message,"SLOT_TAKEN");
      const forbidden=await call(alice,"get_owner_reservations",{p_from:date,p_to:date});assert.equal(forbidden.error.message,"OWNER_REQUIRED");
      const readback=await rpc(owner,"get_owner_reservations",{p_from:date,p_to:date});assert.equal(readback.reservations.filter(r=>r.attendee_name===run && r.status==="confirmed").length,1);
    });await cleanup();
    await logCheck("failed owner move retains original; successful linked move keeps snapshot and sends durable change",async()=>{
      const revision=(await rpc(owner,"get_owner_schedule",{p_week:week})).published_revision;
      const made=await confirm(alice,randomUUID(),zr.id,service.id,revision);assert.equal(made.ok,true);
      const context=await rpc(alice,"availability_context",{p_date:date,p_location:zr.id,p_service:service.id});
      const blocking=calculateAvailability(date,zr.id,context).slots[0];assert.ok(blocking);
      const guest=await rpc(owner,"owner_create_reservation",{p_request_key:randomUUID(),p_location:zr.id,p_service:service.id,p_start:blocking.start,p_expected_revision:revision,p_name:run,p_expected_name:service.name,p_expected_duration:service.duration_minutes});
      const before=(await rows(alice,"booking_notifications")).filter(n=>n.reservation_id===made.data.id).length;
      const failed=await call(owner,"owner_update_reservation",{p_request_key:randomUUID(),p_reservation:made.data.id,p_expected_version:1,p_location:zr.id,p_start:blocking.start,p_expected_revision:revision,p_name:run});assert.equal(failed.error.message,"SLOT_TAKEN");
      const unchanged=(await rows(alice,"reservations")).find(r=>r.id===made.data.id);assert.equal(unchanged.version,1);assert.equal(Date.parse(unchanged.starts_at),Date.parse(start));
      assert.equal((await rows(alice,"booking_notifications")).filter(n=>n.reservation_id===made.data.id).length,before);
      await rpc(owner,"owner_cancel_reservation",{p_request_key:randomUUID(),p_reservation:guest.id});
      const moved=await rpc(owner,"owner_update_reservation",{p_request_key:randomUUID(),p_reservation:made.data.id,p_expected_version:1,p_location:zr.id,p_start:blocking.start,p_expected_revision:revision,p_name:run});
      assert.equal(moved.version,2);assert.equal(moved.service_name,service.name);assert.equal(moved.duration_minutes,service.duration_minutes);
      assert.equal((await rows(alice,"booking_notifications")).filter(n=>n.reservation_id===made.data.id && n.kind==="changed").length,1);
    });await cleanup();
    console.log(JSON.stringify({result:"PASS",checks,project:new URL(url).hostname,date,scope:"Real parallel Supabase Auth/Data API; no emails; only owned synthetic appointments cancelled; schedule content restored; revisions/audit intentionally retained"}));
  }
} catch(error) {
  console.error(JSON.stringify({result:"FAIL",checks,message:error.message}));process.exitCode=1;
} finally {
  if (!process.argv.includes("--preflight") && original) {
    try {await cleanup();await restore();} catch(error) {console.error(JSON.stringify({cleanup:"FAILED; inspect owned synthetic fixtures before retry",message:error.message}));process.exitCode=1;}
  }
  for (const client of [owner,alice,bob]) if (tokens.has(client)) await client.auth.signOut({scope:"local"});
}
