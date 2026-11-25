import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { calculateAvailability } from "../../src/lib/availability.ts";

const db = await PGlite.create();
const id = n => `85000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const [owner, customer, other] = [1,2,3].map(id);
let passed=0, key=100;
const check=async(name,fn)=>{await fn(); console.log(`ok ${++passed} - ${name}`);};
const rpc=async(name,args=[]) => (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
async function as(user,fn){
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:user?.replace('85000000','86000000'),role:user?'authenticated':'anon',user_metadata:{is_admin:true}})]);
  await db.exec(`set role ${user?'authenticated':'anon'}`);
  try{return await fn();}finally{await db.exec('reset role');}
}
try {
  await db.exec(await readFile(new URL('./auth-fixture.sql',import.meta.url),'utf8'));
  const dir=new URL('../migrations/',import.meta.url), files=(await readdir(dir)).filter(n=>n.endsWith('.sql')).sort();
  const migration=files.find(n=>n.endsWith('_multiple_service_reservations.sql'));
  assert.ok(migration);
  for(const file of files.filter(n=>n<migration)) await db.exec(await readFile(new URL(file,dir),'utf8'));
  for(const user of [owner,customer,other]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[user,`${user}@example.invalid`]);
    await db.query("insert into auth.sessions(id,user_id) values($1,$2)",[user.replace('85000000','86000000'),user]);
    await db.query("update public.profiles set first_name='Multi',last_name='Test',phone='+381641234567' where id=$1",[user]);
    await as(user,()=>rpc('ensure_session_access'));
  }
  await db.query("insert into public.admin_memberships(user_id) values($1)",[owner]);
  const locations=(await db.query("select id,slug from public.locations")).rows;
  const location=locations.find(l=>l.slug==='neuzin').id, zr=locations.find(l=>l.slug==='zrenjanin').id;
  const services=(await db.query('select * from public.services order by sort_order')).rows;
  const haircut=services.find(s=>s.slug==='klasicno-sisanje'), beard=services.find(s=>s.slug==='brada'), premium=services.find(s=>s.category==='premium');
  const ids=[haircut.id,beard.id], items=[haircut,beard].map(s=>({service_id:s.id,service_name:s.name,duration_minutes:s.duration_minutes}));
  const day=(await db.query("select ((now() at time zone 'Europe/Belgrade')::date+1)::text as day")).rows[0].day;
  const week=(await db.query("select date_trunc('week',$1::date)::date::text as week",[day])).rows[0].week;
  const at=async time=>(await db.query("select ($1::date+$2::time) at time zone 'Europe/Belgrade' as t",[day,time])).rows[0].t.toISOString();
  const staff=(await db.query('select id from public.staff')).rows[0].id;
  const old=[];
  for(const [i,status] of ['confirmed','cancelled'].entries()) {
    const start=await at(i===0?'08:00':'09:00');
    old.push((await db.query("insert into public.reservations(staff_id,location_id,user_id,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at,status,cancelled_at,cancellation_reason) values($1,$2,$3,'Historical',$4,'Original saved premium name',50,$5,$5::timestamptz+interval '50 minutes',$6,case when $6='cancelled' then now() else null end,case when $6='cancelled' then 'Fixture' else null end) returning *",[staff,location,customer,premium.id,start,status])).rows[0]);
  }
  const source=await readFile(new URL(migration,dir),'utf8');
  const legacyResult=(await db.query('select app_private.booking_result($1) as result',[old[0].id])).rows[0].result;
  const legacyPayload=(await db.query("select jsonb_build_object('operation','confirm','location',$1::uuid,'service',$2::uuid,'start',$3::timestamptz,'revision',1,'attendee',null) as payload",[location,premium.id,old[0].starts_at.toISOString()])).rows[0].payload;
  await db.query('insert into public.booking_mutation_keys(user_id,request_key,payload,result) values($1,$2,$3,$4)',[customer,id(99),JSON.stringify(legacyPayload),JSON.stringify(legacyResult)]);
  await check('migration failure rolls back all DDL and preserves original visits',async()=>{
    await assert.rejects(db.exec(source.replace(/commit;\s*$/,"select 1/0; commit;")),/division by zero/);
    await db.exec('rollback');
    assert.equal((await db.query("select to_regclass('public.reservation_items') as name")).rows[0].name,null);
    assert.deepEqual((await db.query('select * from public.reservations order by starts_at')).rows,old);
  });
  await db.exec(source);
  await check('pre-migration pending scalar keys return their original durable result after migration',async()=>{
    assert.deepEqual(await as(customer,()=>rpc('confirm_reviewed_reservation',[id(99),location,premium.id,old[0].starts_at.toISOString(),1,legacyResult.service_name,50,null])),legacyResult);
  });
  await check('all historical rows backfill their saved values including withdrawn/cancelled premium',async()=>{
    assert.deepEqual((await db.query('select reservation_id,position,service_id,service_name,duration_minutes from public.reservation_items order by reservation_id')).rows.sort((a,b)=>a.reservation_id.localeCompare(b.reservation_id)),old.map(r=>({reservation_id:r.id,position:1,service_id:r.service_id,service_name:r.service_name,duration_minutes:r.duration_minutes})).sort((a,b)=>a.reservation_id.localeCompare(b.reservation_id)));
    assert.deepEqual((await db.query('select * from public.reservations order by starts_at')).rows,old.map(r=>({...r,service_count:1})));
  });
  await as(customer,()=>rpc('cancel_reservation',[id(key++),old[0].id]));
  await as(owner,async()=>{
    await rpc('prepare_schedule_week',[week]);
    const shifts=[[600,720,[{start_minute:640,end_minute:660}]],[960,990,[]],[1020,1040,[]],[1080,1100,[]],[1110,1120,[]]].map(([start_minute,end_minute,breaks])=>({date:day,location_id:location,start_minute,end_minute,breaks}));
    await rpc('save_schedule_draft',[week,0,JSON.stringify(shifts),60]); await rpc('publish_schedule_week',[week,1]);
  });
  const input=async(time='16:00')=>[id(key++),location,ids,await at(time),1,JSON.stringify(items),30,null];
  const confirm=async(args)=>as(customer,()=>rpc('confirm_services_reservation',args));
  const cancel=async(r)=>as(customer,()=>rpc('cancel_reservation',[id(key++),r.id]));
  const context=async()=>as(null,()=>rpc('services_availability_context',[day,location,ids]));
  await check('20+10 fits exactly 30 minutes, but not a 20-minute or disconnected 20+10 window',async()=>{
    const c=await context(); assert.equal(c.service.minutes,30);
    const a=calculateAvailability(day,location,c);
    assert.ok(a.slots.some(s=>s.local_start==='16:00'));
    assert.equal(a.slots.find(s=>s.local_start==='16:00').end,await at('16:30'));
    assert.ok(!a.slots.some(s=>['17:00','18:00','18:30','10:30'].includes(s.local_start)));
    for(const time of ['17:00','18:00','18:30','10:30']) await assert.rejects(confirm(await input(time)),/SLOT_TAKEN/);
  });
  await check('one visit stores catalogue-ordered item snapshots, total, end and exactly one notification',async()=>{
    const args=await input(); args[2]=ids.toReversed();args[5]=JSON.stringify(items.toReversed());
    const r=await confirm(args);
    assert.equal(r.service_count,2);assert.equal(r.duration_minutes,30);assert.equal(Date.parse(r.ends_at),Date.parse(await at('16:30')));
    assert.deepEqual(r.items,items.map((i,n)=>({...i,position:n+1})));
    assert.equal(r.service_name,`${haircut.name} + ${beard.name}`);
    assert.equal((await db.query('select count(*)::int as n from public.booking_notifications where reservation_id=$1',[r.id])).rows[0].n,1);
    const reordered=[...args];reordered[2]=ids;reordered[5]=JSON.stringify(items);
    assert.deepEqual(await confirm(reordered),r);
    await assert.rejects(confirm([...args.slice(0,3),await at('11:00'),...args.slice(4)]),/KEY_REUSED/);
    const mine=await as(customer,()=>rpc('get_my_appointments'));
    assert.deepEqual(mine.reservations.find(x=>x.id===r.id).items,r.items);
    assert.deepEqual(mine.notifications.find(x=>x.reservation_id===r.id).items,r.items);
    const all=await as(owner,()=>rpc('get_owner_reservations',[day,day,null]));
    assert.deepEqual(all.reservations.find(x=>x.id===r.id).items,r.items);
    await cancel(r);
  });
  await check('empty, duplicate, null, unknown, inactive and mismatched reviewed selections fail without inserts',async()=>{
    const before=(await db.query('select count(*)::int as n from public.reservations')).rows[0].n;
    for(const bad of [[],[haircut.id,haircut.id],[null],null]) {
      const args=await input();args[2]=bad;await assert.rejects(confirm(args),/INVALID_INPUT/);
      await as(null,()=>assert.rejects(rpc('services_availability_context',[day,location,bad]),/INVALID_INPUT/));
    }
    for(const svc of [premium,{id:id(999),name:'Unknown',duration_minutes:10}]) {
      const args=await input();args[2]=[svc.id];args[5]=JSON.stringify([{service_id:svc.id,service_name:svc.name,duration_minutes:svc.duration_minutes}]);args[6]=svc.duration_minutes;
      await assert.rejects(confirm(args),/INACTIVE_SERVICE/);
    }
    const changed=await input();changed[5]=JSON.stringify([{...items[0],service_name:'Old name'},items[1]]);
    await assert.rejects(confirm(changed),/SERVICE_CHANGED/);
    const duplicate=await input();duplicate[5]=JSON.stringify([items[0],items[0]]);await assert.rejects(confirm(duplicate),/INVALID_INPUT/);
    assert.equal((await db.query('select count(*)::int as n from public.reservations')).rows[0].n,before);
  });
  await check('catalogue duration changes invalidate review; withdrawal still allows exact-key replay',async()=>{
    const args=await input();
    await db.query('update public.services set duration_minutes=30 where id=$1',[haircut.id]);
    await assert.rejects(confirm(args),/SERVICE_CHANGED/);
    await db.query('update public.services set duration_minutes=20 where id=$1',[haircut.id]);
    const r=await confirm(args);
    await db.query('update public.services set is_active=false,sort_order=99,duration_minutes=40 where id=$1',[haircut.id]);
    assert.deepEqual(await confirm(args),r);
    await assert.rejects(confirm(await input()),/INACTIVE_SERVICE/);
    await cancel(r);
    await db.query('update public.services set is_active=true,sort_order=1,duration_minutes=20 where id=$1',[haircut.id]);
  });
  await check('overlap blocks the whole visit and cancellation releases its whole interval',async()=>{
    const r=await confirm(await input());
    await as(other,async()=>{await assert.rejects(rpc('confirm_services_reservation',await input()),/SLOT_TAKEN/);});
    assert.ok(!calculateAvailability(day,location,await context()).slots.some(s=>s.local_start==='16:00'));
    await cancel(r);assert.ok(calculateAvailability(day,location,await context()).slots.some(s=>s.local_start==='16:00'));
  });
  await check('the full visit respects cross-location travel time and closed booking locations',async()=>{
    await as(null,async()=>assert.equal((await rpc('services_availability_context',[day,zr,ids])).reason,'inactive_location'));
    const args=await input();args[1]=zr;await assert.rejects(confirm(args),/INACTIVE_LOCATION/);
    await db.query('update public.locations set booking_enabled=true where id=$1',[zr]);
    const busy=(await db.query("insert into public.reservations(staff_id,location_id,guest_name,attendee_name,service_id,service_name,duration_minutes,starts_at,ends_at) values($1,$2,'Travel','Travel',$3,$4,10,$5,$5::timestamptz+interval '10 minutes') returning id",[staff,zr,beard.id,beard.name,await at('15:10')])).rows[0];
    assert.ok(!calculateAvailability(day,location,await context()).slots.some(s=>s.local_start==='16:00'));
    await assert.rejects(confirm(await input()),/SLOT_TAKEN/);
    await as(owner,()=>rpc('owner_cancel_reservation',[id(key++),busy.id]));
    await db.query('update public.locations set booking_enabled=false where id=$1',[zr]);
  });
  await check('failed notification rolls back parent, all items, audit and request key together',async()=>{
    const counts=async()=>(await db.query('select (select count(*) from public.reservations) r,(select count(*) from public.reservation_items) i,(select count(*) from public.booking_audit) a,(select count(*) from public.booking_mutation_keys) k')).rows[0];
    const before=await counts();
    await db.exec("create function app_private.test_multi_notification_failure() returns trigger language plpgsql as $$ begin raise exception 'TEST_NOTIFICATION_FAILURE'; end $$; create trigger test_multi_notification_failure before insert on public.booking_notifications for each row execute function app_private.test_multi_notification_failure();");
    try {await assert.rejects(confirm(await input()),/TEST_NOTIFICATION_FAILURE/);assert.deepEqual(await counts(),before);}
    finally {await db.exec('drop trigger test_multi_notification_failure on public.booking_notifications; drop function app_private.test_multi_notification_failure();');}
  });
  await check('manual create, move and cancel retain all original snapshots after catalogue changes',async()=>{
    const args=[id(key++),location,ids,await at('11:00'),1,'Manual multi',JSON.stringify(items),30,null];
    const r=await as(owner,()=>rpc('owner_create_services_reservation',args));
    await db.query('update public.services set is_active=false,duration_minutes=40 where id=$1',[beard.id]);
    assert.deepEqual(await as(owner,()=>rpc('owner_create_services_reservation',args)),r);
    const c=await as(owner,()=>rpc('owner_reservation_context',[day,location,r.id]));assert.equal(c.service.minutes,30);
    const moved=await as(owner,async()=>rpc('owner_update_reservation',[id(key++),r.id,r.version,location,await at('16:00'),1,'Manual multi',null]));
    assert.equal(moved.duration_minutes,30);assert.deepEqual(moved.items,r.items);assert.equal(Date.parse(moved.ends_at),Date.parse(await at('16:30')));
    await as(owner,()=>rpc('owner_cancel_reservation',[id(key++),r.id]));
    await db.query('update public.services set is_active=true,duration_minutes=10 where id=$1',[beard.id]);
  });
  await check('legacy scalar requests and one-item array requests still create one immutable item',async()=>{
    for(const name of ['confirm_reservation','confirm_reviewed_reservation']) {
      const args=[id(key++),location,beard.id,await at('16:00'),1];
      if(name==='confirm_reviewed_reservation')args.push(beard.name,10,null);else args.push(null);
      const r=await as(customer,()=>rpc(name,args));assert.equal(r.items.length,1);assert.equal(r.duration_minutes,10);
      assert.deepEqual(await as(customer,()=>rpc(name,args)),r);await cancel(r);
    }
    const args=await input();args[2]=[beard.id];args[5]=JSON.stringify([items[1]]);args[6]=10;
    const r=await confirm(args);assert.equal(r.items.length,1);await cancel(r);
  });
  await check('RLS/ACL deny foreign items, direct writes and private helpers; owner RPC exposes all items',async()=>{
    const r=await confirm(await input());
    await as(other,async()=>{assert.equal((await db.query('select * from public.reservation_items where reservation_id=$1',[r.id])).rows.length,0);await assert.rejects(rpc('owner_create_services_reservation',[id(key++),location,ids,await at('11:00'),1,'Forged owner',JSON.stringify(items),30,null]),/OWNER_REQUIRED/);});
    await as(customer,async()=>{
      assert.equal((await db.query('select * from public.reservation_items where reservation_id=$1',[r.id])).rows.length,2);
      await assert.rejects(db.query('delete from public.reservation_items where reservation_id=$1',[r.id]));
      await assert.rejects(db.query('update public.reservation_items set duration_minutes=50 where reservation_id=$1',[r.id]));
      await assert.rejects(db.query('insert into public.reservation_items values($1,3,$2,$3,10)',[r.id,premium.id,'Forged']));
      await assert.rejects(db.query('select app_private.service_selection($1)',[ids]));
    });
    await as(null,()=>assert.rejects(db.query('select * from public.reservation_items')));
    await assert.rejects(db.query('update public.reservation_items set duration_minutes=50 where reservation_id=$1',[r.id]),/IMMUTABLE_SERVICE_SNAPSHOT/);
    await assert.rejects(db.query('update public.reservations set service_count=3 where id=$1',[r.id]),/IMMUTABLE_SERVICE_SNAPSHOT/);
    await cancel(r);
  });
  await check('partial/malformed trusted multi-service inserts fail their deferred integrity check',async()=>{
    const args=[staff,location,customer,haircut.id,await at('16:00')];
    await assert.rejects(db.query("insert into public.reservations(staff_id,location_id,user_id,attendee_name,service_id,service_name,duration_minutes,service_count,starts_at,ends_at) values($1,$2,$3,'Partial',$4,'Partial',30,2,$5,$5::timestamptz+interval '30 minutes')",args),/INVALID_RESERVATION_ITEMS/);
  });
  await check('new functions have no accidental public/private-helper execution grants',async()=>{
    const exposed=(await db.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in ('canonical_service_ids','service_selection','create_services_reservation','reviewed_service_items','validate_reservation_items') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))")).rows;
    assert.deepEqual(exposed,[]);
  });
  console.log(JSON.stringify({result:'PASS',checks:passed,scope:'isolated PostgreSQL with Auth fixtures; live concurrency tested separately'}));
} catch(error) { console.error(error.message,error.where??''); process.exitCode=1; }
finally {await db.close();}
