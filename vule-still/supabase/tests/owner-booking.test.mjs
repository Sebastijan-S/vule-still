import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db=await PGlite.create();let checks=0;
const owner="80000000-0000-4000-8000-000000000001",alice="80000000-0000-4000-8000-000000000002";
const session=user=>user.replace("80000000","81000000"),key=n=>`82000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const check=async(name,fn)=>{await fn();console.log(`ok ${++checks} - ${name}`);};
async function as(user,fn){await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user?session(user):null,role:user?"authenticated":"anon"})]);await db.exec(`set role ${user?"authenticated":"anon"}`);try{return await fn();}finally{await db.exec("reset role");}}
const rpc=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(",")}) as result`,args)).rows[0].result;
const reject=async(fn,message)=>assert.rejects(fn,e=>e.message.includes(message));
const counts=async()=>(await db.query("select (select count(*)::int from public.reservations) r,(select count(*)::int from public.booking_notifications) n,(select count(*)::int from public.booking_audit) a,(select count(*)::int from public.booking_mutation_keys) k")).rows[0];
try{
  await db.exec(await readFile(new URL("./auth-fixture.sql",import.meta.url),"utf8"));
  const dir=new URL("../migrations/",import.meta.url);
  for(const name of (await readdir(dir)).filter(n=>n.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(name,dir),"utf8"));
  for(const user of [owner,alice]){await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,`owner-test-${user.slice(-1)}@example.invalid`]);await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[session(user),user]);await as(user,()=>rpc("ensure_session_access"));}
  await db.query("insert into public.admin_memberships(user_id) values($1)",[owner]);
  await db.query("update public.profiles set first_name='Test',last_name='Klijent',phone='+381641234567' where id=$1",[alice]);
  const {day,week}=(await db.query("with d as (select (clock_timestamp() at time zone 'Europe/Belgrade')::date+1 as day) select (case when extract(isodow from day)=7 then day+1 else day end)::text as day,date_trunc('week',case when extract(isodow from day)=7 then day+1 else day end)::date::text as week from d")).rows[0];
  const zr=(await db.query("select id from public.locations where slug='zrenjanin'")).rows[0].id;
  const ne=(await db.query("select id from public.locations where slug='neuzin'")).rows[0].id;
  const svc=(await db.query("select * from public.services where duration_minutes=20 order by sort_order limit 1")).rows[0];
  const at=async(time)=>(await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' t",[day,time])).rows[0].t.toISOString();
  const t10=await at("10:00"),t1020=await at("10:20"),t1040=await at("10:40");
  await as(owner,async()=>{await rpc("prepare_schedule_week",[week]);await rpc("publish_schedule_week",[week,0]);});
  const create=(n,start=t10,phone=null)=>rpc("owner_create_reservation",[key(n),zr,svc.id,start,1,"Test Klijent",svc.name,20,phone]);
  let guest,linked;
  await check("owner without a customer profile creates a name-only unlinked guest, audit but no fake notification",async()=>{
    const before=await counts();guest=await as(owner,()=>create(1));const after=await counts();assert.deepEqual(after,{r:before.r+1,n:before.n,a:before.a+1,k:before.k+1});
    const row=(await db.query("select * from public.reservations where id=$1",[guest.id])).rows[0];assert.equal(row.user_id,null);assert.equal(row.guest_phone,null);assert.equal(row.guest_name,"Test Klijent");
    assert.deepEqual(await as(owner,()=>create(1)),guest);
  });
  await check("anonymous/customer denied every owner RPC and cannot infer contacts",async()=>{
    for(const user of [null,alice]) await as(user,async()=>{
      for(const [name,args] of [["get_owner_reservations",[day,day,null]],["owner_reservation_context",[day,zr,guest.id]],["owner_create_reservation",[key(2),zr,svc.id,t1020,1,"Guest",svc.name,20,null]],["owner_update_reservation",[key(2),guest.id,1,zr,t1020,1,"Guest",null]],["owner_cancel_reservation",[key(2),guest.id]]]) await assert.rejects(()=>rpc(name,args));
    });
  });
  await check("manual overlap, off-grid start, inactive service and invalid phone fail without partial writes",async()=>{
    const before=await counts();
    await as(owner,()=>reject(()=>create(2),"SLOT_TAKEN"));
    await as(owner,()=>reject(()=>create(2,t1020,"invalid"),"INVALID_INPUT"));
    const offGrid=await at("10:25");await as(owner,()=>reject(()=>create(2,offGrid),"SLOT_TAKEN"));
    await db.query("update public.services set is_active=false where id=$1",[svc.id]);await as(owner,()=>reject(()=>create(2,t1020),"INACTIVE_SERVICE"));await db.query("update public.services set is_active=true where id=$1",[svc.id]);
    assert.deepEqual(await counts(),before);
  });
  await check("failed move retains original reservation, version and all events",async()=>{
    linked=await as(alice,()=>rpc("confirm_reservation",[key(3),zr,svc.id,t1020,1,null]));const before=await counts();
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(4),guest.id,1,zr,t1020,1,"Moved guest",null]),"SLOT_TAKEN"));
    assert.equal((await db.query("select version from public.reservations where id=$1",[guest.id])).rows[0].version,1);assert.deepEqual(await counts(),before);
  });
  await check("failed owner change notification rolls the move, audit and key back",async()=>{
    await db.exec("create function app_private.owner_test_failure() returns trigger language plpgsql as $$ begin raise exception 'OWNER_EVENT_FAILURE'; end $$; create trigger owner_test_failure before insert on public.booking_notifications for each row execute function app_private.owner_test_failure()");
    const before=await counts();
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(20),linked.id,1,zr,t1040,1,"Failed notification",null]),"OWNER_EVENT_FAILURE"));
    assert.deepEqual(await counts(),before);assert.equal((await db.query("select version from public.reservations where id=$1",[linked.id])).rows[0].version,1);
    await db.exec("drop trigger owner_test_failure on public.booking_notifications; drop function app_private.owner_test_failure()");
  });
  await check("owner moves atomically with saved duration even after catalogue deactivation; stale version rejected",async()=>{
    await db.query("update public.services set name='Changed',duration_minutes=40,is_active=false where id=$1",[svc.id]);
    const context=await as(owner,()=>rpc("owner_reservation_context",[day,zr,guest.id]));assert.equal(context.service.minutes,20);
    const moved=await as(owner,()=>rpc("owner_update_reservation",[key(4),guest.id,1,zr,t1040,1,"Moved guest","+381641234568"]));assert.equal(moved.duration_minutes,20);assert.equal(moved.service_name,svc.name);assert.equal(moved.version,2);
    assert.deepEqual(await as(owner,()=>rpc("owner_update_reservation",[key(4),guest.id,1,zr,t1040,1,"Moved guest","+381641234568"])),moved);
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(5),guest.id,1,zr,t10,1,"Old version",null]),"RESERVATION_CHANGED"));guest=moved;
    await db.query("update public.services set name=$2,duration_minutes=20,is_active=true where id=$1",[svc.id,svc.name]);
  });
  await check("owner sees current linked phone, cannot snapshot it, and linked edits create durable change messages",async()=>{
    await db.query("update public.profiles set phone='+381641234569' where id=$1",[alice]);
    const page=await as(owner,()=>rpc("get_owner_reservations",[day,day,null]));assert.equal(page.reservations.find(r=>r.id===linked.id).phone,"+381641234569");
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(6),linked.id,1,zr,t10,1,"Other name","+381641234568"]),"LINKED_PROFILE_CONTACT"));
    const before=await counts();linked=await as(owner,()=>rpc("owner_update_reservation",[key(6),linked.id,1,zr,t10,1,"Other name",null]));const after=await counts();assert.equal(after.n,before.n+1);assert.equal(after.a,before.a+1);
    const notice=(await as(alice,()=>rpc("get_my_appointments"))).notifications.find(n=>n.kind==="changed");assert.ok(notice.message.includes("10:20")&&notice.message.includes("10:00")&&notice.message.includes("Other name"));
  });
  await check("location filters, shared occupancy and regular owner cancellation remain consistent",async()=>{
    assert.equal((await as(owner,()=>rpc("get_owner_reservations",[day,day,ne]))).reservations.length,0);
    const cancelled=await as(owner,()=>rpc("owner_cancel_reservation",[key(7),linked.id]));assert.equal(cancelled.status,"cancelled");const before=await counts();
    assert.deepEqual(await as(owner,()=>rpc("owner_cancel_reservation",[key(7),linked.id])),cancelled);assert.deepEqual(await counts(),before);
    await as(owner,()=>rpc("owner_cancel_reservation",[key(8),guest.id]));
  });
  await check("late edits/cancellations and already started appointments have no owner bypass",async()=>{
    const r=(await db.query("insert into public.reservations(staff_id,location_id,guest_name,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at) select id,$1,'Late','Late',$2,'Late',20,date_trunc('minute',clock_timestamp())+interval '20 minutes',date_trunc('minute',clock_timestamp())+interval '40 minutes' from public.staff returning id",[zr,svc.id])).rows[0];
    await as(owner,()=>reject(()=>rpc("owner_cancel_reservation",[key(9),r.id]),"CANCELLATION_TOO_LATE"));
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(10),r.id,1,zr,t10,1,"Moved late",null]),"EDIT_TOO_LATE"));
    await db.query("update public.reservations set starts_at=date_trunc('minute',clock_timestamp())-interval '10 minutes',ends_at=date_trunc('minute',clock_timestamp())+interval '10 minutes' where id=$1",[r.id]);
    await as(owner,()=>reject(()=>rpc("owner_cancel_reservation",[key(11),r.id]),"CANCELLATION_TOO_LATE"));
    await as(owner,()=>reject(()=>rpc("owner_update_reservation",[key(12),r.id,1,zr,t10,1,"Moved started",null]),"EDIT_TOO_LATE"));
  });
  console.log(JSON.stringify({result:"PASS",checks,engine:"isolated PGlite, synthetic Auth fixtures, sequential; live concurrency separate"}));
}catch(error){console.error(JSON.stringify({result:"FAIL",checks,message:error.message,code:error.code}));process.exitCode=1;}finally{await db.close();}
