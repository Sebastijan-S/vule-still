import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = await PGlite.create();
let passed = 0;
const ids = [1,2,3,4,5].map(n=>`70000000-0000-4000-8000-${String(n).padStart(12,"0")}`);
const sessions = ids.map(id=>id.replace("70000000","71000000"));
const [owner,alice,bob,incomplete,blocked] = ids;
const key = n=>`72000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const check = async (name,fn)=>{await fn(); console.log(`ok ${++passed} - ${name}`);};
async function as(user,fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:sessions[ids.indexOf(user)],role:user?"authenticated":"anon"})]);
  await db.exec(`set role ${user?"authenticated":"anon"}`);
  try{return await fn();}finally{await db.exec("reset role");}
}
async function rpc(name,args=[]) {return (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args)).rows[0].result;}
async function rejects(fn,message){await assert.rejects(fn,e=>e.message.includes(message));}
const counts = async()=> (await db.query("select (select count(*)::int from public.reservations) r,(select count(*)::int from public.booking_notifications) n,(select count(*)::int from public.booking_audit) a,(select count(*)::int from public.booking_mutation_keys) k")).rows[0];
try {
  await db.exec(await readFile(new URL("./auth-fixture.sql",import.meta.url),"utf8"));
  const dir=new URL("../migrations/",import.meta.url);
  for(const name of (await readdir(dir)).filter(f=>f.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(name,dir),"utf8"));
  // Exercise both locations, including future reactivation, in this regression fixture.
  await db.exec("update public.locations set booking_enabled=true");
  // This overlap regression intentionally exercises a reactivated 40-minute service.
  await db.exec("update public.services set is_active=true where category='premium'");
  for (let i=0;i<ids.length;i++) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[ids[i],`booking-${i}@example.invalid`]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[sessions[i],ids[i]]);
    if(ids[i]!==incomplete) await db.query("update public.profiles set first_name='Test',last_name='Korisnik',phone='+381641234567' where id=$1",[ids[i]]);
    await as(ids[i],()=>rpc("ensure_session_access"));
  }
  await db.query("insert into public.admin_memberships(user_id) values($1)",[owner]);
  await db.query("update public.profiles set booking_blocked=true where id=$1",[blocked]);
  const locs=(await db.query("select id,slug from public.locations")).rows;
  const zr=locs.find(l=>l.slug==="zrenjanin").id, ne=locs.find(l=>l.slug==="neuzin").id;
  const services=(await db.query("select * from public.services order by duration_minutes")).rows;
  const svc=services.find(s=>s.duration_minutes===20), premium=services.find(s=>s.duration_minutes===40);
  const { day,week }=(await db.query("with d as (select (clock_timestamp() at time zone 'Europe/Belgrade')::date+1 as day) select (case when extract(isodow from day)=7 then day+1 else day end)::text as day,date_trunc('week',case when extract(isodow from day)=7 then day+1 else day end)::date::text as week from d")).rows[0];
  const at=async(time)=> (await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' as t",[day,time])).rows[0].t.toISOString();
  const t10=await at("10:00"),t1020=await at("10:20"),t1040=await at("10:40"),t11=await at("11:00");
  const confirm=(n,start=t10,location=zr,service=svc.id,revision=1,attendee=null)=>rpc("confirm_reservation",[key(n),location,service,start,revision,attendee]);
  let original;
  await as(owner,async()=>{original=await rpc("prepare_schedule_week",[week]);await rpc("publish_schedule_week",[week,0]);});
  await check("15-minute / 14-day and 30-minute equality use precise database boundaries",async()=>{
    const r=(await db.query(`select
      app_private.booking_time_valid('2026-11-03 10:15+01','2026-11-03 10:00+01') a,
      app_private.booking_time_valid('2026-11-03 10:15+01','2026-11-03 10:00:00.001+01') b,
      app_private.booking_time_valid('2026-11-17 23:40+01','2026-11-03 10:00+01') c,
      app_private.booking_time_valid('2026-11-18 00:00+01','2026-11-03 10:00+01') d,
      app_private.cancellation_time_valid('2026-11-03 10:30+01','2026-11-03 10:00+01') e,
      app_private.cancellation_time_valid('2026-11-03 10:30+01','2026-11-03 10:00:00.001+01') f`)).rows[0];
    assert.deepEqual(r,{a:true,b:false,c:true,d:false,e:true,f:false});
  });
  await check("database DST boundaries match first/last repeated instant and reject missing time",async()=>{
    const r=(await db.query("select app_private.local_boundary('2026-10-25',150,false) a,app_private.local_boundary('2026-10-25',150,true) b")).rows[0];
    assert.equal(r.b-r.a,3600000);
    await rejects(()=>db.query("select app_private.local_boundary('2026-03-29',150)"),"INVALID_SCHEDULE");
  });
  await check("anonymous, incomplete and blocked customers cannot confirm",async()=>{
    await as(null,()=>assert.rejects(confirm(1)));
    await as(incomplete,()=>rejects(()=>confirm(1),"PROFILE_REQUIRED"));
    await as(blocked,()=>rejects(()=>confirm(1),"BOOKING_BLOCKED"));
  });
  await check("unverified account, expired activity and revoked Auth session are rejected directly",async()=>{
    await db.query("update auth.users set email_confirmed_at=null where id=$1",[alice]);
    await as(alice,()=>rejects(()=>confirm(1),"SESSION_REQUIRED"));
    await db.query("update auth.users set email_confirmed_at=now() where id=$1",[alice]);
    await db.query("update public.account_activity set last_activity_at=now()-interval '30 days' where user_id=$1",[alice]);
    await as(alice,()=>rejects(()=>confirm(1),"SESSION_REQUIRED"));
    await db.query("update public.account_activity set last_activity_at=now() where user_id=$1",[alice]);
    await db.query("delete from auth.sessions where id=$1",[sessions[2]]);
    await as(bob,()=>rejects(()=>confirm(1),"SESSION_REQUIRED"));
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[sessions[2],bob]);
    await as(bob,()=>rpc("ensure_session_access"));
  });
  let first;
  await check("confirmation persists snapshot, owner, attendee and exactly one event of each kind",async()=>{
    const before=await counts();first=await as(alice,()=>confirm(1));
    assert.equal(first.service_name,svc.name);assert.equal(first.duration_minutes,20);assert.equal(first.attendee_name,"Test Korisnik");
    const after=await counts();assert.deepEqual(after,{r:before.r+1,n:before.n+1,a:before.a+1,k:before.k+1});
    const r=(await db.query("select * from public.reservations where id=$1",[first.id])).rows[0];
    assert.equal(r.user_id,alice);assert.equal(r.guest_phone,null);assert.equal(r.guest_name,null);
    assert.equal(Object.hasOwn(r,"phone"),false);
  });
  await check("response-loss retry returns exact original result without duplicates",async()=>{
    const before=await counts();assert.deepEqual(await as(alice,()=>confirm(1)),first);assert.deepEqual(await counts(),before);
  });
  await check("incompatible reuse of key is rejected without partial state",async()=>{
    const before=await counts();await as(alice,()=>rejects(()=>confirm(1,t1020),"KEY_REUSED"));assert.deepEqual(await counts(),before);
  });
  await check("same slot with different key/customer and overlapping premium service fail",async()=>{
    for(const user of [alice,bob]) await as(user,()=>rejects(()=>confirm(2),"SLOT_TAKEN"));
    await as(bob,()=>rejects(()=>confirm(3,t10,zr,premium.id),"SLOT_TAKEN"));
  });
  let second;
  await check("touching appointments succeed; another person remains under account ownership",async()=>{
    second=await as(bob,()=>confirm(2,t1020,zr,svc.id,1,"Druga osoba"));assert.equal(second.attendee_name,"Druga osoba");
    await as(bob,async()=>assert.equal((await db.query("select count(*)::int n from public.reservations")).rows[0].n,1));
  });
  await check("RLS isolates reservations and notifications; direct writes/internal/audit/key access denied",async()=>{
    await as(alice,async()=>{
      assert.equal((await db.query("select * from public.reservations where id=$1",[second.id])).rows.length,0);
      assert.equal((await db.query("select * from public.booking_notifications where user_id=$1",[bob])).rows.length,0);
      for(const table of ["reservations","booking_notifications","booking_audit","booking_mutation_keys"]) {
        await assert.rejects(db.query(`insert into public.${table} default values`));
        await assert.rejects(db.query(`delete from public.${table}`));
      }
      await assert.rejects(db.query("update public.reservations set status='cancelled'"));
      await assert.rejects(db.query("update public.booking_notifications set read_at=now()"));
      await assert.rejects(db.query("select * from public.booking_audit"));
      await assert.rejects(db.query("select * from public.booking_mutation_keys"));
      await assert.rejects(db.query("select app_private.booking_result($1)",[second.id]));
      await rejects(()=>rpc("cancel_reservation",[key(4),second.id]),"RESERVATION_NOT_FOUND");
    });
  });
  await check("caller cannot forge off-grid start, stale revision, inactive service or location",async()=>{
    const offGrid=await at("10:45");
    await as(alice,()=>rejects(()=>confirm(5,offGrid),"SLOT_TAKEN"));
    await as(alice,()=>rejects(()=>confirm(5,t1040,zr,svc.id,99),"SCHEDULE_CHANGED"));
    await db.query("update public.services set is_active=false where id=$1",[svc.id]);
    await as(alice,()=>rejects(()=>confirm(5,t1040),"INACTIVE_SERVICE"));
    await db.query("update public.services set is_active=true where id=$1",[svc.id]);
    await db.query("update public.locations set is_active=false where id=$1",[zr]);
    await as(alice,()=>rejects(()=>confirm(5,t1040),"INACTIVE_LOCATION"));
    await db.query("update public.locations set is_active=true where id=$1",[zr]);
  });
  await check("private appointment read model and notification acknowledgements stay with their recipient",async()=>{
    const page=await as(alice,()=>rpc("get_my_appointments"));
    assert.equal(page.reservations.length,1);assert.equal(page.reservations[0].id,first.id);
    assert.equal(page.reservations[0].location_name,"Zrenjanin");assert.ok(page.server_time);
    const notice=page.notifications[0];assert.equal(notice.read_at,null);
    await as(bob,()=>rejects(()=>rpc("mark_booking_notification_read",[notice.id]),"NOTIFICATION_NOT_FOUND"));
    const stamp=await as(alice,()=>rpc("mark_booking_notification_read",[notice.id]));
    assert.deepEqual(await as(alice,()=>rpc("mark_booking_notification_read",[notice.id])),stamp);
    assert.equal(Date.parse((await as(alice,()=>rpc("get_my_appointments"))).notifications[0].read_at),new Date(stamp).getTime());
    await as(null,()=>assert.rejects(()=>rpc("get_my_appointments")));
  });
  await check("service edits and current profile phone never rewrite a booked snapshot",async()=>{
    await db.query("update public.services set name='New name',duration_minutes=40 where id=$1",[svc.id]);
    await as(alice,()=>db.query("update public.profiles set phone='+381641234568' where id=$1",[alice]));
    assert.deepEqual(await db.query("select service_name,duration_minutes from public.reservations where id=$1",[first.id]).then(x=>x.rows[0]),{service_name:svc.name,duration_minutes:20});
    await rejects(()=>db.query("update public.reservations set service_name='Tampered' where id=$1",[first.id]),"IMMUTABLE_SERVICE_SNAPSHOT");
    await db.query("update public.services set name=$2,duration_minutes=20 where id=$1",[svc.id,svc.name]);
  });
  await check("database trigger rejects direct trusted overlapping writes",async()=>{
    await rejects(()=>db.query("insert into public.reservations(staff_id,location_id,starts_at,ends_at,guest_name,attendee_name,service_id,service_name,duration_minutes) select staff_id,location_id,starts_at,ends_at,'Guest','Guest',service_id,service_name,duration_minutes from public.reservations where id=$1",[first.id]),"SLOT_TAKEN");
  });
  await check("reviewed confirmation rejects changed service snapshots without partial state",async()=>{
    const before=await counts();
    await as(alice,()=>rejects(()=>rpc("confirm_reviewed_reservation",[key(40),zr,svc.id,t1040,1,"Old reviewed name",20,null]),"SERVICE_CHANGED"));
    assert.deepEqual(await counts(),before);
    const confirmed=await as(alice,()=>rpc("confirm_reviewed_reservation",[key(40),zr,svc.id,t1040,1,svc.name,20,null]));
    await db.query("update public.services set name='Changed after success' where id=$1",[svc.id]);
    assert.deepEqual(await as(alice,()=>rpc("confirm_reviewed_reservation",[key(40),zr,svc.id,t1040,1,svc.name,20,null])),confirmed);
    await db.query("update public.services set name=$2 where id=$1",[svc.id,svc.name]);
    await as(alice,()=>rpc("cancel_reservation",[key(41),confirmed.id]));
  });
  await check("range constraint independently rejects overlap across locations",async()=>{
    assert.equal((await db.query("select contype from pg_constraint where conrelid='public.reservations'::regclass and conname='reservations_no_overlap'")).rows[0].contype,"x");
    // Disable only the trigger in this isolated fixture to prove that the
    // constraint itself enforces the shared barber, including maintenance paths.
    await db.exec("alter table public.reservations disable trigger reservation_overlap_guard");
    try {
      await assert.rejects(()=>db.query("insert into public.reservations(staff_id,location_id,starts_at,ends_at,guest_name,attendee_name,service_id,service_name,duration_minutes) select staff_id,$2,starts_at,ends_at,'Guest','Guest',service_id,service_name,duration_minutes from public.reservations where id=$1",[first.id,ne]),e=>e.code==="23P01");
    } finally { await db.exec("alter table public.reservations enable trigger reservation_overlap_guard"); }
  });
  await check("failed durable notification rolls reservation, audit and idempotency back together",async()=>{
    await db.exec("create function app_private.test_event_failure() returns trigger language plpgsql as $$ begin raise exception 'TEST_EVENT_FAILURE'; end $$; create trigger test_event_failure before insert on public.booking_notifications for each row execute function app_private.test_event_failure()");
    const before=await counts();await as(alice,()=>rejects(()=>confirm(6,t1040),"TEST_EVENT_FAILURE"));assert.deepEqual(await counts(),before);
    await db.exec("drop trigger test_event_failure on public.booking_notifications; drop function app_private.test_event_failure()");
  });
  await check("customer cancellation releases capacity and same/new-key repeats create no extra events",async()=>{
    const cancelled=await as(bob,()=>rpc("cancel_reservation",[key(7),second.id]));assert.equal(cancelled.status,"cancelled");
    const before=await counts();assert.deepEqual(await as(bob,()=>rpc("cancel_reservation",[key(7),second.id])),cancelled);assert.deepEqual(await counts(),before);
    await as(bob,()=>rpc("cancel_reservation",[key(8),second.id]));
    const after=await counts();assert.equal(after.n,before.n);assert.equal(after.a,before.a);
    second=await as(alice,()=>confirm(9,t1020));assert.equal(second.status,"confirmed");
    await as(bob,()=>rejects(()=>confirm(7,t1040),"KEY_REUSED"));
  });
  await check("late customer cancellation is rejected and blocked accounts retain cancellation/history",async()=>{
    const row=(await db.query("insert into public.reservations(staff_id,location_id,user_id,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at) select id,$1,$2,'Late fixture',$3,'Late fixture',20,date_trunc('minute',clock_timestamp())+interval '20 minutes',date_trunc('minute',clock_timestamp())+interval '40 minutes' from public.staff returning id",[zr,alice,svc.id])).rows[0];
    await as(alice,()=>rejects(()=>rpc("cancel_reservation",[key(10),row.id]),"CANCELLATION_TOO_LATE"));
    await db.query("update public.profiles set booking_blocked=true where id=$1",[alice]);
    await as(alice,async()=>{assert.ok((await db.query("select * from public.reservations")).rows.length);await rpc("cancel_reservation",[key(11),second.id]);});
    await db.query("update public.profiles set booking_blocked=false where id=$1",[alice]);
    await db.query("update public.reservations set status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason='Fixture cleanup' where id=$1",[row.id]);
  });
  await check("public availability never exposes attendee, ownership or reservation identifiers",async()=>{
    const value=await as(null,()=>rpc("availability_context",[day,zr,svc.id]));
    assert.equal(value.occupied.length,1);
    assert.deepEqual(Object.keys(value.occupied[0]).sort(),["end","location_id","start","travel_gap_minutes"]);
  });
  let revision;
  await check("conflicting publication is rejected with reservations/events/published snapshot unchanged",async()=>{
    const before=await counts();
    const published=await as(null,()=>rpc("published_schedule",[week]));
    await as(owner,async()=>{
      revision=await rpc("save_schedule_draft",[week,0,JSON.stringify(original.draft.filter(s=>s.date!==day)),60]);
      await rejects(()=>rpc("publish_schedule_week",[week,revision]),"SCHEDULE_RESERVATION_CONFLICT");
    });
    assert.deepEqual(await counts(),before);
    assert.deepEqual(await as(null,()=>rpc("published_schedule",[week])),published);
    assert.equal((await db.query("select status from public.reservations where id=$1",[first.id])).rows[0].status,"confirmed");
  });
  await check("new booking after saving draft also prevents publication without partial cancellation",async()=>{
    second=await as(bob,()=>confirm(12,t1040));const before=await counts();
    await as(owner,()=>rejects(()=>rpc("publish_schedule_week",[week,revision]),"SCHEDULE_RESERVATION_CONFLICT"));
    assert.deepEqual(await counts(),before);
    assert.equal((await db.query("select status from public.reservations where id=$1",[first.id])).rows[0].status,"confirmed");
  });
  await check("only individual permitted cancellation resolves conflict; publication itself cancels nothing",async()=>{
    await as(alice,()=>rpc("cancel_reservation",[key(14),first.id]));
    await as(owner,()=>rejects(()=>rpc("publish_schedule_week",[week,revision]),"SCHEDULE_RESERVATION_CONFLICT"));
    await as(bob,()=>rpc("cancel_reservation",[key(14),second.id]));
    const before=await counts();
    await as(owner,()=>rpc("publish_schedule_week",[week,revision]));
    const after=await counts();assert.equal(after.n,before.n);assert.equal(after.a,before.a+1);
    assert.equal((await db.query("select count(*)::int n from public.reservations where status='confirmed'")).rows[0].n,0);
    await as(alice,()=>rejects(()=>confirm(13,t11,zr,svc.id,1),"SCHEDULE_CHANGED"));
    await as(alice,()=>rejects(()=>confirm(13,t11,zr,svc.id,2),"SLOT_TAKEN"));
  });
  await check("ordinary customer cannot publish and no mass-cancellation RPC exists; expired replay denied",async()=>{
    await as(alice,()=>rejects(()=>rpc("publish_schedule_week",[week,revision]),"OWNER_REQUIRED"));
    assert.equal((await db.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('preview_schedule_publication','publish_schedule_with_impact')")).rows[0].n,0);
    await db.query("update public.account_activity set last_activity_at=now()-interval '31 days' where user_id=$1",[alice]);
    await as(alice,()=>rejects(()=>confirm(1),"SESSION_REQUIRED"));
    await db.query("update public.account_activity set last_activity_at=now() where user_id=$1",[alice]);
    // Cached response represents original operation; current truth is read separately.
    assert.deepEqual(await as(alice,()=>confirm(1)),first);
  });
  await check("cross-day/neighbor-week travel and missing DST schedule boundaries fail closed",async()=>{
    const entry=(date,location,start,end)=>({date,location_id:location,start_minute:start,end_minute:end,breaks:[]});
    await rejects(()=>db.query("select app_private.validate_published_neighbors('2026-11-02',$1,60)",[JSON.stringify([entry("2026-11-02",zr,1380,1440),entry("2026-11-03",ne,0,60)])]),"SCHEDULE_TRAVEL_CONFLICT");
    await rejects(()=>db.query("select app_private.validate_published_neighbors('2026-03-23',$1,0)",[JSON.stringify([entry("2026-03-29",zr,150,240)])]),"INVALID_SCHEDULE");
    await db.query("insert into public.schedule_weeks(week_start,draft,published,published_gap_minutes) values('2026-12-07',$1,$1,60)",[JSON.stringify([entry("2026-12-13",zr,1380,1440)])]);
    await rejects(()=>db.query("select app_private.validate_published_neighbors('2026-12-14',$1,0)",[JSON.stringify([entry("2026-12-14",ne,0,60)])]),"SCHEDULE_TRAVEL_CONFLICT");
  });
  await check("private helper functions expose no default PUBLIC/anon execution grants",async()=>{
    const r=(await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and (has_function_privilege('anon',p.oid,'execute') or (has_function_privilege('authenticated',p.oid,'execute') and p.proname not in ('session_permitted','is_admin')))")).rows;
    assert.deepEqual(r,[]);
  });
  console.log(JSON.stringify({result:"PASS",checks:passed,engine:"PGlite in-memory; Auth/session fixtures; sequential transactions, NOT live concurrency"}));
} catch(error) {
  console.error(JSON.stringify({result:"FAIL",afterChecks:passed,message:error.message,code:error.code,where:error.where,query:error.query}));
  process.exitCode=1;
} finally {await db.close();}
