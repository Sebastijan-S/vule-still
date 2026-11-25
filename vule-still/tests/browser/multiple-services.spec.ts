import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDays, localMinuteInstants } from "../../src/lib/availability";

test("multi-service API races, exact-key retry, saved item views, movement and legacy UI", async ({ page, browser }) => {
  test.setTimeout(180000);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  expect(new URL(url).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture=JSON.parse(await readFile(".env.phase6-state.local","utf8"));
  for(const role of ["owner","customer"]) expect(fixture[role].email).toMatch(new RegExp(`^vule-phase6-${role}-.+@example\\.invalid$`));
  const owner=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await owner.auth.signInWithPassword(fixture.owner)).error).toBeNull();
  expect((await owner.rpc("ensure_session_access")).data).toBe(true);
  const rpc=async(name:string,args:Record<string,unknown>={})=>{const r=await owner.rpc(name,args);expect(r.error,name).toBeNull();return r.data;};
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Belgrade",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const date=addCalendarDays(today,1), day=new Date(`${date}T12:00:00Z`);
  const week=addCalendarDays(date,-(day.getUTCDay()+6)%7);
  const at=(minute:number)=>new Date(localMinuteInstants(date,minute)[0]).toISOString();
  const location="10000000-0000-4000-8000-000000000002";
  const services=(await owner.from("services").select("id,slug,name,duration_minutes").eq("is_active",true).order("sort_order")).data!;
  const selected=[services.find(s=>s.slug==="klasicno-sisanje")!,services.find(s=>s.slug==="brada")!];
  expect(selected.every(Boolean)).toBe(true);
  const items=selected.map(s=>({service_id:s.id,service_name:s.name,duration_minutes:s.duration_minutes}));
  const tag=`UI2 ${randomUUID()}`;
  const statePath=".env.ui-step2-check.local";
  // A missing week is the only allowed fixture: never overwrite a user's schedule.
  expect(await rpc("get_owner_schedule",{p_week:week})).toBeNull();
  let completedPrevious=false;
  try {
    const previous=JSON.parse(await readFile(statePath,"utf8"));
    expect(previous.stage,"Clean up the previous controlled test week before rerunning").toBe("complete_week_restored_to_absent");
    completedPrevious=true;
  } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
  await writeFile(statePath,JSON.stringify({week,date,tag,original:null,stage:"before_prepare"}),{flag:completedPrevious?"w":"wx"});
  let touched=false;
  const ownerContext=await browser.newContext(), ownerPage=await ownerContext.newPage();
  const login=async(target:Page,account:{email:string;password:string})=>{
    await target.goto("/administrator");await target.getByLabel("Imejl adresa").fill(account.email);await target.getByLabel("Lozinka",{exact:true}).fill(account.password);
    await target.getByRole("button",{name:"Prijavi se",exact:true}).click();
  };
  const headers={origin:"http://127.0.0.1:3100"};
  try {
    const prepared=await rpc("prepare_schedule_week",{p_week:week});touched=true;
    const entries=[{date,location_id:location,start_minute:960,end_minute:1080,breaks:[]}];
    const draft=await rpc("save_schedule_draft",{p_week:week,p_expected_revision:prepared.draft_revision,p_entries:entries,p_gap:60});
    const revision=await rpc("publish_schedule_week",{p_week:week,p_expected_revision:draft});
    await writeFile(statePath,JSON.stringify({week,date,tag,original:null,stage:"published",entries,draft_revision:draft,published_revision:revision}));
    await login(page,fixture.customer);
    await expect(page.getByRole("heading",{name:"Administracija je dostupna samo vlasniku.",exact:true})).toBeVisible();
    await login(ownerPage,fixture.owner);
    await expect(ownerPage.getByRole("button",{name:"Dodaj ručni termin",exact:true})).toBeVisible();
    const make=(minute=960)=>({request_key:randomUUID(),location,services:selected.map(s=>s.id),start:at(minute),schedule_revision:revision,expected_items:items,expected_duration:30,attendee_name:tag});
    const available=await page.request.get(`/api/availability?date=${date}&location=${location}&${selected.map(s=>`services=${s.id}`).join("&")}`);
    expect(available.status()).toBe(200);const availability=await available.json();
    expect(availability.duration_minutes).toBe(30);expect(availability.items).toHaveLength(2);
    expect(availability.slots.find((s:{start:string})=>s.start===at(960)).end).toBe(at(990));
    for(const query of [`services=${selected[0].id}&services=${selected[0].id}`,`services=${selected[0].id}&service=${selected[1].id}`,"services="]) expect((await page.request.get(`/api/availability?date=${date}&location=${location}&${query}`)).status()).toBe(400);
    const short={...make(980),services:[selected[0].id],expected_items:[items[0]],expected_duration:20};
    const race=await Promise.all([make(),short].map(data=>page.request.post("/api/reservations",{headers,data})));
    expect(race.map(r=>r.status()).sort()).toEqual([200,409]);
    const winner=(await race.find(r=>r.status()===200)!.json()).reservation;
    expect((await race.find(r=>r.status()===409)!.json()).error).toContain("upravo zauzet");
    expect((await page.request.post("/api/reservations/cancel",{headers,data:{request_key:randomUUID(),reservation:winner.id}})).status()).toBe(200);
    const same=make();
    const retries=await Promise.all([1,2].map(()=>page.request.post("/api/reservations",{headers,data:same})));
    expect(retries.map(r=>r.status())).toEqual([200,200]);
    const booked=(await retries[0].json()).reservation;
    expect((await retries[1].json()).reservation).toEqual(booked);
    expect(booked.items).toHaveLength(2);expect(booked.duration_minutes).toBe(30);
    const mine=await (await page.request.get("/api/reservations")).json();
    expect(mine.reservations.filter((r:{id:string})=>r.id===booked.id)).toHaveLength(1);
    expect(mine.notifications.filter((n:{reservation_id:string})=>n.reservation_id===booked.id)).toHaveLength(1);
    await page.goto("/moji-termini");
    const card=page.locator(`[data-reservation="${booked.id}"]`);
    await expect(card.locator(".visit-services")).toContainText("Klasično šišanje · 20 min");
    await expect(card.locator(".visit-services")).toContainText("Brada · 10 min");
    await expect(card.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
    for(const width of [390,1280]) {
      await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await card.screenshot({path:`test-results/multiple-services-customer-${width}.png`});
    }
    await ownerPage.getByLabel("Datum pregleda",{exact:true}).fill(date);
    const ownerCard=ownerPage.locator(`[data-reservation="${booked.id}"]`);
    await expect(ownerCard.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
    await ownerCard.getByRole("button",{name:"Izmeni termin",exact:true}).click();
    await expect(ownerPage.locator(".owner-form .visit-services")).toContainText("Brada · 10 min");
    await ownerPage.locator(".owner-form .slot-options").getByRole("button",{name:/^17:00/}).click();
    await ownerPage.getByRole("button",{name:"Sačuvaj izmenu",exact:true}).click();
    await expect(ownerPage.locator(".form-success")).toHaveText("Izmena je sačuvana.");
    await expect(ownerCard).toContainText("17:00–17:30");
    await ownerCard.screenshot({path:"test-results/multiple-services-owner.png"});
    await page.reload();await expect(card).toContainText("17:00–17:30");
    const moved=await (await page.request.get("/api/reservations")).json();
    expect(moved.reservations.find((r:{id:string})=>r.id===booked.id).items).toEqual(booked.items);
    expect(moved.notifications.find((n:{reservation_id:string;kind:string})=>n.reservation_id===booked.id&&n.kind==="changed").items).toEqual(booked.items);
    const manual=await ownerPage.request.post("/api/owner/reservations",{headers,data:{...make(),operation:"create",name:`${tag} manual`,phone:null}});
    expect(manual.status()).toBe(200);expect((await manual.json()).reservation.items).toHaveLength(2);
    const invalid={...make(),services:[selected[0].id,selected[0].id]};
    expect((await ownerPage.request.post("/api/owner/reservations",{headers,data:{...invalid,operation:"create",name:tag}})).status()).toBe(400);
    // Clear controlled visits, then prove the existing single-service UI still works.
    for(const row of (await rpc("get_owner_reservations",{p_from:date,p_to:date})).reservations.filter((r:{attendee_name:string;status:string})=>r.attendee_name.startsWith(tag)&&r.status==="confirmed")) await rpc("owner_cancel_reservation",{p_request_key:randomUUID(),p_reservation:row.id});
    await page.goto("/rezervacija?lokacija=neuzin&usluga=brada");
    await page.getByRole("button",{name:"Neuzin",exact:true}).click();await page.getByRole("button",{name:"Brada 10 min",exact:true}).click();
    await page.getByLabel("Datum",{exact:true}).fill(date);
    await page.locator(".slot-options button").first().click();await page.getByRole("button",{name:"Pregled rezervacije",exact:true}).click();
    await page.getByLabel("Druga osoba",{exact:true}).check();await page.getByLabel("Ime osobe koja dolazi",{exact:true}).fill(`${tag} legacy`);
    await page.getByRole("button",{name:"Potvrdi rezervaciju",exact:true}).click();
    await expect(page.getByText("REZERVACIJA JE POTVRĐENA",{exact:true})).toBeVisible();
    const legacy=(await (await page.request.get("/api/reservations")).json()).reservations.find((r:{attendee_name:string})=>r.attendee_name===`${tag} legacy`);
    expect(legacy.items).toHaveLength(1);expect(legacy.duration_minutes).toBe(10);
    console.log("PASS: partial-interval race, concurrent exact-key retry, both item views, whole-visit move, manual API and legacy UI");
  } finally {
    if(touched) {
      const rows=(await rpc("get_owner_reservations",{p_from:date,p_to:date})).reservations;
      for(const r of rows.filter((r:{attendee_name:string;status:string})=>r.attendee_name.startsWith(tag)&&r.status==="confirmed")) await rpc("owner_cancel_reservation",{p_request_key:randomUUID(),p_reservation:r.id});
      const current=await rpc("get_owner_schedule",{p_week:week});
      // Detect unexpected edits before touching the fixture again.
      expect(current.draft).toEqual([{date,location_id:location,start_minute:960,end_minute:1080,breaks:[]}]);
      expect(current.draft_revision).toBe(1);expect(current.published_revision).toBe(1);
      const rev=await rpc("save_schedule_draft",{p_week:week,p_expected_revision:1,p_entries:[],p_gap:60});
      await rpc("publish_schedule_week",{p_week:week,p_expected_revision:rev});
      const clean=await rpc("get_owner_schedule",{p_week:week});
      expect(clean.draft).toEqual([]);expect(clean.published).toEqual([]);
      await writeFile(statePath,JSON.stringify({week,date,tag,original:null,stage:"empty_fixture_for_conditional_cleanup",draft_revision:clean.draft_revision,published_revision:clean.published_revision}));
    }
    await ownerContext.close();await owner.auth.signOut({scope:"local"});
  }
});
