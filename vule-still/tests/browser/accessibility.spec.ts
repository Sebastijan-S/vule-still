import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { localMinuteInstants } from "../../src/lib/availability";

const origin="http://127.0.0.1:3100";
const beard="30000000-0000-4000-8000-000000000003";
async function mockTimes(page:Page){
  await page.route("**/api/availability?**",async route=>{
    const query=new URL(route.request().url()).searchParams,date=query.get("date")!;
    const duration=query.getAll("services").reduce((sum,id)=>sum+(id===beard?10:20),0);
    const slots=[960,1020,1080].map(minute=>{const start=localMinuteInstants(date,minute)[0];return{start:new Date(start).toISOString(),end:new Date(start+duration*60000).toISOString(),local_start:`${Math.floor(minute/60)}:00`};});
    await route.fulfill({json:{reason:"available",schedule_revision:1,slots}});
  });
}
async function tabTo(page:Page,target:Locator){
  for(let i=0;i<25;i++){
    if(await target.evaluate(el=>el===document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
async function fits(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function contrast(page:Page,selectors:string[]){
  const values=await page.evaluate(selectors=>{
    const luminance=(color:string)=>{
      const rgb=(color.match(/[\d.]+/g)??[]).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
      return rgb.reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
    };
    return selectors.flatMap(selector=>[...document.querySelectorAll<HTMLElement>(selector)].filter(el=>el.getBoundingClientRect().height>0).map(el=>{
      let parent:HTMLElement|null=el,bg="rgb(11, 11, 11)";
      while(parent){const c=getComputedStyle(parent).backgroundColor;if(c!=="rgba(0, 0, 0, 0)"&&c!=="transparent"){bg=c;break;}parent=parent.parentElement;}
      const fg=getComputedStyle(el).color,[a,b]=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);
      return{selector,ratio:(a+.05)/(b+.05)};
    }));
  },selectors);
  expect(values.length).toBeGreaterThan(0);
  for(const value of values) expect(value.ratio,`${value.selector} contrast`).toBeGreaterThanOrEqual(4.5);
}
async function login(page:Page,role:"owner"|"customer"){
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture=JSON.parse(await readFile(".env.phase6-state.local","utf8"))[role];
  expect(fixture.email).toMatch(/^vule-phase6-(owner|customer)-.+@example\.invalid$/);
  await page.goto("/administrator");await page.getByLabel("Imejl adresa").fill(fixture.email);await page.getByLabel("Lozinka",{exact:true}).fill(fixture.password);await page.getByRole("button",{name:"Prijavi se",exact:true}).click();
  if(role==="owner") await expect(page.getByRole("button",{name:"Dodaj ručni termin",exact:true})).toBeVisible();
  else await expect(page.getByRole("heading",{name:"Administracija je dostupna samo vlasniku.",exact:true})).toBeVisible();
}
for(const width of [360,390,768,1280]) test(`readable keyboard booking and single radio group at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await mockTimes(page);await page.goto("/rezervacija");
  await expect(page.getByRole("heading",{name:"Usluge",exact:true})).toBeFocused();
  expect(await page.locator("body").evaluate(el=>getComputedStyle(el).fontSize)).toBe("16px");
  const first=page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}),second=page.getByRole("checkbox",{name:"Brada 10 min",exact:true});
  await tabTo(page,first);await page.keyboard.press("Space");await tabTo(page,second);await page.keyboard.press("Space");
  await expect(first).toBeChecked();await expect(second).toBeChecked();
  const total=page.getByRole("status");await expect(total).toHaveText("Ukupno trajanje: 30 min");await expect(total).toHaveAttribute("aria-live","polite");await expect(total).toHaveAttribute("aria-atomic","true");
  for(const el of await page.locator(".service-choice").all()){const box=await el.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);expect(box!.width).toBeGreaterThanOrEqual(44);}
  await fits(page);await contrast(page,[".button:not(:disabled)",".text-button",".field-help",".booking-option"]);
  await page.locator(".booking-panel").screenshot({path:`test-results/ui4-selection-${width}.png`,style:"nextjs-portal {visibility:hidden}"});
  const next=page.getByRole("button",{name:"Izaberi vreme",exact:true});await tabTo(page,next);await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Izaberi datum i vreme",exact:true})).toBeFocused();
  const radios=page.getByRole("group",{name:"Slobodni termini",exact:true}).getByRole("radio");await expect(radios).toHaveCount(3);
  await tabTo(page,radios.first());await page.keyboard.press("Space");await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeChecked();await expect(radios.first()).not.toBeChecked();await expect(page.locator(".slot-options input:checked")).toHaveCount(1);
  await expect(radios.nth(1)).toHaveAccessibleName(/17:00–17:30/);
  await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"Pregled rezervacije",exact:true})).toBeFocused();
  expect(await page.getByLabel("Datum",{exact:true}).evaluate(el=>getComputedStyle(el).fontSize)).toBe("16px");
  await fits(page);await contrast(page,[".button:not(:disabled)",".text-button",".field-help",".slot-option",".slot-options small"]);
  await page.locator(".booking-panel").screenshot({path:`test-results/ui4-time-${width}.png`,style:"nextjs-portal {visibility:hidden}"});
  const snapshot=await page.locator(".booking-panel").ariaSnapshot();expect(snapshot).toContain('group "Slobodni termini"');expect(snapshot).toContain('radio "17:00–17:30');expect(snapshot).toContain('[checked]');
  await page.keyboard.press("Enter");await expect(page.getByRole("heading",{name:"Proveri svoj izbor",exact:true})).toBeFocused();await fits(page);
});
for(const width of [360,390,768,1280]) test(`home, guest input/error and primary contrast at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto("/");await fits(page);
  for(const link of await page.locator(".site-header .nav-link:visible, .site-header .account-link:visible").all()){
    expect(await link.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
    const box=await link.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.goto("/prijava");const contact=page.getByLabel("Broj telefona ili mejl",{exact:true});await contact.fill("pogresan kontakt");await page.getByRole("button",{name:"Nastavi",exact:true}).click();
  await expect(contact).toHaveAttribute("aria-invalid","true");await expect(contact).toBeFocused();await expect(contact).toHaveAccessibleDescription(/Unesi ispravan broj telefona ili mejl adresu/);
  await expect(page.locator("#contact-error")).toHaveAttribute("role","alert");
  expect(await contact.evaluate(el=>getComputedStyle(el).fontSize)).toBe("16px");await fits(page);await contrast(page,[".button:not(:disabled)",".field-help",".field-error",".field input"]);
  await page.screenshot({path:`test-results/ui4-contact-error-${width}.png`,fullPage:true,style:"nextjs-portal {visibility:hidden}"});
});
test("200 percent desktop-equivalent reflow retains booking and guest actions",async({browser})=>{
  // A 1280px physical viewport at DPR 2 exposes 640 CSS px, matching 200% zoom reflow.
  const context=await browser.newContext({viewport:{width:640,height:450},deviceScaleFactor:2});const page=await context.newPage();
  try{
    await mockTimes(page);await page.goto(`${origin}/rezervacija`);await page.getByRole("checkbox",{name:"Klasično šišanje 20 min",exact:true}).check();await page.getByRole("checkbox",{name:"Brada 10 min",exact:true}).check();
    await fits(page);await page.getByRole("button",{name:"Izaberi vreme",exact:true}).click();await page.getByRole("radio").first().check();await page.getByRole("button",{name:"Pregled rezervacije",exact:true}).click();await fits(page);await expect(page.getByRole("link",{name:"Prijavi se i nastavi",exact:true})).toBeVisible();
    await page.screenshot({path:"test-results/ui4-reflow-200-equivalent.png",fullPage:true,style:"nextjs-portal {visibility:hidden}"});
    await page.getByRole("link",{name:"Prijavi se i nastavi",exact:true}).click();await fits(page);
  }finally{await context.close();}
});
test("attendee field error is linked, announced and focused before any mutation",async({page})=>{
  await login(page,"customer");await mockTimes(page);await page.goto("/rezervacija?usluga=brada");await page.getByRole("radio").first().check();await page.getByRole("button",{name:"Pregled rezervacije",exact:true}).click();
  await page.getByLabel("Druga osoba",{exact:true}).check();let writes=0;await page.route("**/api/reservations",route=>{if(route.request().method()==="POST")writes++;return route.abort();});
  await page.getByRole("button",{name:"Potvrdi rezervaciju",exact:true}).click();const input=page.getByLabel("Ime osobe koja dolazi",{exact:true});
  await expect(input).toHaveAttribute("aria-invalid","true");await expect(input).toBeFocused();await expect(input).toHaveAccessibleDescription("Unesi ime osobe koja dolazi (do 120 znakova).");expect(writes).toBe(0);
  await input.fill("Test osoba");await expect(input).toHaveAttribute("aria-invalid","false");
});
for(const width of [360,390,768,1280]) test(`dialog keyboard trap, field error and restored focus at ${width}px`,async({page})=>{
  await login(page,"owner");await page.setViewportSize({width,height:900});await page.goto("/administrator/sablon");
  const opener=page.getByRole("button",{name:/^Izmeni uobičajenu smenu — Neuzin, Ponedeljak/});await opener.focus();await page.keyboard.press("Enter");
  const dialog=page.getByRole("dialog",{name:"Izmeni smenu",exact:true});await expect(dialog).toBeVisible();
  const close=dialog.getByRole("button",{name:"Zatvori izmenu smene",exact:true}),apply=dialog.getByRole("button",{name:"Primeni u šablonu",exact:true});
  await close.focus();await page.keyboard.press("Shift+Tab");await expect(apply).toBeFocused();await page.keyboard.press("Tab");await expect(close).toBeFocused();
  for(let i=0;i<15;i++){await page.keyboard.press("Tab");expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  const start=page.getByLabel("Početak smene",{exact:true}),end=page.getByLabel("Kraj smene",{exact:true});await start.fill("18:00");await end.fill("17:00");await dialog.getByRole("button",{name:"Primeni u šablonu",exact:true}).click();
  await expect(end).toHaveAttribute("aria-invalid","true");await expect(end).toHaveAccessibleDescription("Kraj smene mora biti posle početka, u istom danu.");await expect(end).toBeFocused();
  const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await contrast(page,[".shift-dialog .button",".shift-dialog .danger-text",".shift-dialog .form-error",".shift-dialog .field-help"]);
  await dialog.screenshot({path:`test-results/ui4-dialog-${width}.png`,style:"nextjs-portal {visibility:hidden}"});await page.keyboard.press("Escape");await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
  await expect(page.getByRole("button",{name:"Sačuvaj uobičajenu nedelju",exact:true})).toBeDisabled();
  await page.keyboard.press("Enter");await page.getByRole("button",{name:"Zatvori izmenu smene",exact:true}).click();await expect(opener).toBeFocused();
});
