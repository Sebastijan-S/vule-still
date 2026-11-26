import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const location = "10000000-0000-4000-8000-000000000002";
const haircut = "30000000-0000-4000-8000-000000000001", beard = "30000000-0000-4000-8000-000000000003", premium = "30000000-0000-4000-8000-000000000007";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function mockTimes(page: Page) {
  await page.route("**/api/availability?**", async route => {
    const query = new URL(route.request().url()).searchParams;
    const ids = query.getAll("services");
    expect(ids.length).toBeGreaterThan(0); expect(new Set(ids).size).toBe(ids.length);
    const total = ids.reduce((n, id) => n + (id === beard ? 10 : 20), 0);
    const date = query.get("date")!;
    const slots = [960, 1080 - total].map(minute => {
      const start = new Date(`${date}T00:00:00Z`); start.setUTCMinutes(minute - 60);
      return { start: start.toISOString(), end: new Date(+start + total * 60000).toISOString(), local_start: `${Math.floor(minute/60)}:${String(minute%60).padStart(2,"0")}` };
    });
    await route.fulfill({ json: { reason: "available", schedule_revision: 1, duration_minutes: total, slots } });
  });
}
test.beforeEach(() => expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co"));
for (const width of [360,390,1280]) test(`multi selection, zero selection, retained/invalidated start and refresh at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900}); await mockTimes(page);
  await page.goto("/rezervacija");
  await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Izaberi vreme",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Neuzin",exact:true})).toHaveCount(0);
  await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).check();
  await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).uncheck();
  await expect(page.getByRole("status")).toContainText("Ukupno trajanje: 0 min");
  await expect(page.getByRole("button",{name:"Izaberi vreme",exact:true})).toBeDisabled();
  await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).check();
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();
  await page.locator(".slot-options input[type=radio]").last().click();
  await page.getByRole("button",{name:"Dodaj ili promeni usluge",exact:true}).click();
  await page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}).check();
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();
  await expect(page.getByText("Ukupno trajanje: 30 min",{exact:true})).toBeVisible();
  await expect(page.locator('.slot-options input:checked')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Pregled rezervacije",exact:true})).toBeDisabled();
  await page.locator(".slot-options input[type=radio]").first().click();
  await expect(page.getByText(/Izbor:.*16:00–16:30/)).toBeVisible();
  await page.getByRole("button",{name:"Dodaj ili promeni usluge",exact:true}).click();
  await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).uncheck();
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();
  await expect(page.locator('.slot-options input:checked')).toHaveCount(1);
  await page.getByRole("button",{name:"Dodaj ili promeni usluge",exact:true}).click();
  await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).check();
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();
  await expect(page.locator('.slot-options input:checked')).toHaveCount(1);
  await page.getByRole("button",{name:"Pregled rezervacije",exact:true}).click(); await page.reload();
  await expect(page.getByRole("heading",{name:"Proveri svoj izbor",exact:true})).toBeVisible();
  await expect(page.getByRole("list",{name:"Izabrane usluge",exact:true}).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator(".appointment-facts")).toContainText("16:00–16:30");
  await page.getByRole("button",{name:"Prethodni korak"}).click();
  await expect(page.getByLabel("Datum",{exact:true})).toHaveValue(today());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/ui3-time-${width}.png`,fullPage:true});
});
test("direct legacy link skips selection, additions and person survive refresh", async ({page}) => {
  await page.setViewportSize({width:390,height:900}); await mockTimes(page); await page.goto("/rezervacija?usluga=brada");
  await expect(page.getByRole("heading",{name:"Izaberi datum i vreme",exact:true})).toBeVisible();
  await expect(page.getByRole("list",{name:"Izabrane usluge"})).toContainText("Brada · 10 min");
  await page.getByRole("button",{name:"Dodaj ili promeni usluge",exact:true}).click();
  await expect(page.getByRole("checkbox",{name:"Brada 10 min",exact:true})).toBeChecked();
  await page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}).check();
  await page.locator(".booking-panel").screenshot({path:"test-results/ui3-selection-390.png",style:"nextjs-portal { visibility: hidden; }"});
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click(); await page.reload();
  await expect(page.getByRole("list",{name:"Izabrane usluge"}).getByRole("listitem")).toHaveCount(2);
});
test("withdrawn part preserves remainder, date and review gate across refresh", async ({page}) => {
  await page.goto("/rezervacija"); await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();
  await page.evaluate(({location,haircut,premium,date})=>sessionStorage.setItem("vule-booking-selection",JSON.stringify({location,services:[haircut,premium],date,start:`${date}T15:00:00.000Z`,step:3,other:true,attendee:"UI3 osoba"})),{location,haircut,premium,date:today()});
  await page.reload();
  await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();
  await expect(page.getByText(/Deo sačuvanog izbora/)).toBeVisible();
  await expect(page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true})).toBeChecked();
  await expect(page.getByRole("button",{name:"2. Termin",exact:true})).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"2. Termin",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();
  await expect(page.getByLabel("Datum",{exact:true})).toHaveValue(today());
  const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("vule-booking-selection")!));
  expect(saved.services).toEqual([haircut]); expect(saved.start).toBe(""); expect(saved.other).toBe(true); expect(saved.attendee).toBe("UI3 osoba");
});
for (const link of ["/rezervacija", "/rezervacija?lokacija=neuzin&usluga=brada"]) test(`legacy scalar draft remains readable through ${link}`, async ({page}) => {
  await mockTimes(page); await page.goto("/rezervacija"); await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();
  await page.evaluate(({location,service,date})=>sessionStorage.setItem("vule-booking-selection",JSON.stringify({location,service,date,start:`${date}T15:00:00.000Z`})),{location,service:beard,date:today()});
  await page.goto(link); await expect(page.getByRole("heading",{name:"Izaberi datum i vreme",exact:true})).toBeVisible();
  await expect(page.locator('.slot-options input:checked')).toHaveCount(1);
});
for(const legacy of [false,true]) for(const outcome of ["confirmed","rejected"]) test(`pending exact saved payload with withdrawn item, legacy=${legacy}, outcome=${outcome}`,async({page})=>{
  const fixture=JSON.parse(await readFile(".env.phase6-state.local","utf8")).customer;
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await db.auth.signInWithPassword(fixture); expect(auth.error).toBeNull(); const id=auth.data.user!.id;
  await page.goto("/administrator"); await page.getByLabel("Imejl adresa").fill(fixture.email); await page.getByLabel("Lozinka",{exact:true}).fill(fixture.password); await page.getByRole("button",{name:"Prijavi se",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Administracija je dostupna samo vlasniku.",exact:true})).toBeVisible();
  const base={request_key:randomUUID(),location:"10000000-0000-4000-8000-000000000001",start:`${today()}T15:00:00.000Z`,schedule_revision:1,attendee_name:"UI3 pending"};
  const pending=legacy?{...base,service:premium,expected_service_name:"Sačuvana povučena usluga",expected_duration:40}:{...base,services:[premium,haircut],expected_items:[{service_id:premium,service_name:"Sačuvana povučena usluga",duration_minutes:40},{service_id:haircut,service_name:"Sačuvano šišanje",duration_minutes:20}],expected_duration:60};
  await page.evaluate(({id,pending})=>sessionStorage.setItem(`vule-booking-pending:${id}`,JSON.stringify(pending)),{id,pending});
  let checks=0;await page.route("**/api/availability?**",route=>{checks++;return route.abort();});
  let received:unknown;
  await page.route("**/api/reservations",async route=>{
    if(route.request().method()!=="POST") return route.continue(); received=route.request().postDataJSON();
    await route.fulfill({status:outcome==="confirmed"?200:409,json:outcome==="confirmed"?{reservation:{id:randomUUID(),service_name:"Sačuvana povučena usluga",duration_minutes:pending.expected_duration,starts_at:pending.start,ends_at:new Date(Date.parse(pending.start)+pending.expected_duration*60000).toISOString(),attendee_name:pending.attendee_name,location_name:"Zrenjanin"}}:{error:"Usluga više nije dostupna. Ponovo izaberi uslugu.",retry_same_key:false}});
  });
  try {
    await page.goto("/rezervacija");await page.reload();
    await expect(page.getByText(/Sačuvana povučena usluga · 40 min/)).toBeVisible();
    await page.getByRole("button",{name:"Proveri isti zahtev",exact:true}).click();expect(received).toEqual(pending);expect(checks).toBe(0);
    if(outcome==="confirmed") await expect(page.getByRole("heading",{name:"Vidimo se uskoro."})).toBeVisible();
    else {await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeVisible();if(!legacy) await expect(page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true})).toBeChecked();}
    expect(await page.evaluate(id=>sessionStorage.getItem(`vule-booking-pending:${id}`),id)).toBeNull();
  } finally {await db.auth.signOut({scope:"local"});}
});
