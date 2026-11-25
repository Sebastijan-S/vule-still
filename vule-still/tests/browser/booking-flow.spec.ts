import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDays } from "../../src/lib/availability";

test("controlled full multi-service visit through guest/profile/refresh, lost response and manual owner entry",async({page,browser})=>{
  test.setTimeout(180000);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  expect(new URL(url).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture=JSON.parse(await readFile(".env.phase6-state.local","utf8")).owner;
  expect(fixture.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  const owner=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  expect((await owner.auth.signInWithPassword(fixture)).error).toBeNull();
  expect((await owner.rpc("ensure_session_access")).data).toBe(true);
  const rpc=async(name:string,args:Record<string,unknown>={})=>{const r=await owner.rpc(name,args);expect(r.error,name).toBeNull();return r.data;};
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Belgrade",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const date=addCalendarDays(today,1),week=addCalendarDays(date,-(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7);
  const location="10000000-0000-4000-8000-000000000002",tag=`UI3 ${randomUUID()}`;
  const entries=[{date,location_id:location,start_minute:960,end_minute:1080,breaks:[]}];
  const journal=".env.ui-step3-check.local";
  expect(await rpc("get_owner_schedule",{p_week:week}),"Never overwrite an existing week").toBeNull();
  await writeFile(journal,JSON.stringify({week,date,tag,original:null,stage:"before_prepare"}));
  const context=await browser.newContext(),ownerPage=await context.newPage(); let touched=false;
  const login=async(target:Page)=>{await target.goto("/administrator");await target.getByLabel("Imejl adresa").fill(fixture.email);await target.getByLabel("Lozinka",{exact:true}).fill(fixture.password);await target.getByRole("button",{name:"Prijavi se",exact:true}).click();await expect(target.getByRole("button",{name:"Dodaj ručni termin",exact:true})).toBeVisible();};
  try {
    const prepared=await rpc("prepare_schedule_week",{p_week:week});touched=true;
    const revision=await rpc("save_schedule_draft",{p_week:week,p_expected_revision:prepared.draft_revision,p_entries:entries,p_gap:60});
    await rpc("publish_schedule_week",{p_week:week,p_expected_revision:revision});
    await writeFile(journal,JSON.stringify({week,date,tag,original:null,stage:"published",entries,draft_revision:1,published_revision:1}));
    await page.setViewportSize({width:390,height:900});
    await page.goto("/rezervacija?usluga=brada");
    await expect(page.getByRole("heading",{name:"Izaberi datum i vreme",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Dodaj ili promeni usluge",exact:true}).click();
    await page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}).check();
    await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();await page.getByLabel("Datum",{exact:true}).fill(date);
    await page.locator(".slot-options").getByRole("button",{name:/^16:00/}).click();
    await expect(page.getByText(/Izbor:.*16:00–16:30/)).toBeVisible();
    await page.getByRole("button",{name:"Pregled rezervacije",exact:true}).click();
    await page.getByRole("link",{name:"Prijavi se i nastavi",exact:true}).click();
    await page.getByLabel("Broj telefona ili mejl",{exact:true}).fill(`ui3-${randomUUID()}@example.invalid`);
    await page.getByRole("button",{name:"Nastavi",exact:true}).click();await expect(page).toHaveURL(/\/profil\?/);
    await page.reload();await page.getByLabel("Ime",{exact:true}).fill("UI3");await page.getByLabel("Prezime",{exact:true}).fill("Test osoba");
    await page.getByRole("button",{name:"Sačuvaj podatke",exact:true}).click();await expect(page).toHaveURL(/\/rezervacija\?nastavi=1$/);
    await expect(page.getByRole("heading",{name:"Proveri svoj izbor",exact:true})).toBeVisible();
    await expect(page.getByRole("list",{name:"Izabrane usluge"}).getByRole("listitem")).toHaveCount(2);
    await expect(page.locator(".appointment-facts")).toContainText("16:00–16:30");
    await page.getByLabel("Druga osoba",{exact:true}).check();await page.getByLabel("Ime osobe koja dolazi",{exact:true}).fill(tag);await page.reload();
    await expect(page.getByLabel("Druga osoba",{exact:true})).toBeChecked();await expect(page.getByLabel("Ime osobe koja dolazi",{exact:true})).toHaveValue(tag);
    await page.screenshot({path:"test-results/ui3-review-390.png",fullPage:true});
    let sent:unknown;let intercepted=false;
    await page.route("**/api/reservations",async route=>{
      if(route.request().method()!=="POST") return route.continue();
      if(!intercepted){intercepted=true;sent=route.request().postDataJSON();const response=await route.fetch();expect(response.status()).toBe(200);return route.abort("failed");}
      expect(route.request().postDataJSON()).toEqual(sent);return route.continue();
    });
    await page.getByRole("button",{name:"Potvrdi rezervaciju",exact:true}).click();
    await expect(page.locator(".form-error[role=alert]")).toContainText("Ishod potvrde još nije poznat");
    await page.reload();await page.getByRole("button",{name:"Proveri isti zahtev",exact:true}).click();
    await expect(page.getByText("REZERVACIJA JE POTVRĐENA",{exact:true})).toBeVisible();
    await expect(page.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");await expect(page.locator(".appointment-facts")).toContainText("16:00–16:30");
    await page.screenshot({path:"test-results/ui3-confirmation-390.png",fullPage:true});
    const mine=await (await page.request.get("/api/reservations")).json(),made=mine.reservations.filter((r:{attendee_name:string})=>r.attendee_name===tag);
    expect(made).toHaveLength(1);expect(made[0].items).toHaveLength(2);expect(made[0].duration_minutes).toBe(30);
    expect(mine.notifications.filter((n:{reservation_id:string})=>n.reservation_id===made[0].id)).toHaveLength(1);
    await page.goto("/moji-termini");const card=page.locator(`[data-reservation="${made[0].id}"]`);
    await expect(card.locator(".visit-services")).toContainText("Brada · 10 min");await expect(card).toContainText("16:00–16:30");
    await login(ownerPage);await ownerPage.getByLabel("Datum pregleda",{exact:true}).fill(date);
    const ownerCard=ownerPage.locator(`[data-reservation="${made[0].id}"]`);await expect(ownerCard.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
    await ownerPage.getByRole("button",{name:"Dodaj ručni termin",exact:true}).click();
    await ownerPage.getByLabel("Ime osobe koja dolazi",{exact:true}).fill(`${tag} manual`);
    const form=ownerPage.locator(".owner-form");await expect(form.getByRole("button",{name:"Potvrdi ručni termin",exact:true})).toBeDisabled();
    await form.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}).check();await form.getByRole("checkbox",{name:"Brada 10 min",exact:true}).check();
    await expect(form.getByText("Ukupno trajanje: 30 min",{exact:true})).toBeVisible();
    await form.locator(".slot-options").getByRole("button",{name:/^17:00/}).click();await expect(form.getByText(/Izbor:.*17:00–17:30/)).toBeVisible();
    for(const width of [390,1280]){await ownerPage.setViewportSize({width,height:900});expect(await ownerPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await form.screenshot({path:`test-results/ui3-owner-form-${width}.png`});}
    await form.getByRole("button",{name:"Potvrdi ručni termin",exact:true}).click();await expect(ownerPage.locator(".form-success")).toContainText("Ručni termin je potvrđen");
    const manual=(await rpc("get_owner_reservations",{p_from:date,p_to:date})).reservations.find((r:{attendee_name:string})=>r.attendee_name===`${tag} manual`);
    expect(manual.items).toHaveLength(2);expect(manual.duration_minutes).toBe(30);
    const manualCard=ownerPage.locator(`[data-reservation="${manual.id}"]`);await expect(manualCard).toContainText("17:00–17:30");
    await manualCard.getByRole("button",{name:"Izmeni termin",exact:true}).click();
    await expect(form.getByRole("checkbox")).toHaveCount(0);await expect(form.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
    await form.locator(".slot-options").getByRole("button",{name:/^17:30/}).click();await form.getByRole("button",{name:"Sačuvaj izmenu",exact:true}).click();
    await expect(manualCard).toContainText("17:30–18:00");
    page.once("dialog",dialog=>dialog.accept());await card.getByRole("button",{name:"Otkaži rezervaciju",exact:true}).click();await expect(card).toContainText("Otkazana");
    ownerPage.once("dialog",dialog=>dialog.accept());await manualCard.getByRole("button",{name:"Otkaži termin",exact:true}).click();await expect(manualCard).toContainText("Otkazana");
  } finally {
    if(touched){
      const rows=(await rpc("get_owner_reservations",{p_from:date,p_to:date})).reservations;
      for(const r of rows.filter((r:{attendee_name:string;status:string})=>r.attendee_name.startsWith(tag)&&r.status==="confirmed")) await rpc("owner_cancel_reservation",{p_request_key:randomUUID(),p_reservation:r.id});
      const state=await rpc("get_owner_schedule",{p_week:week});expect(state.draft).toEqual(entries);expect(state.published).toEqual(entries);expect(state.draft_revision).toBe(1);expect(state.published_revision).toBe(1);
      const rev=await rpc("save_schedule_draft",{p_week:week,p_expected_revision:1,p_entries:[],p_gap:60});await rpc("publish_schedule_week",{p_week:week,p_expected_revision:rev});
      const clean=await rpc("get_owner_schedule",{p_week:week});expect(clean.draft).toEqual([]);expect(clean.published).toEqual([]);
      await writeFile(journal,JSON.stringify({week,date,tag,original:null,stage:"empty_fixture_for_conditional_cleanup",draft_revision:clean.draft_revision,published_revision:clean.published_revision}));
    }
    await context.close();await owner.auth.signOut({scope:"local"});
  }
});
