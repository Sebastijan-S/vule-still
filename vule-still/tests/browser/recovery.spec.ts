import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { addCalendarDays, localMinuteInstants } from "../../src/lib/availability";

test.use({ actionTimeout: 15000 });

test.beforeEach(() => expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co"));
const beard = "30000000-0000-4000-8000-000000000003";
async function availability(page: Page) {
  const state = { reason: "available", failure: false };
  await page.route("**/api/availability?**", async route => {
    if (state.failure) return route.fulfill({ status: 503, body: "Synthetic unavailable transport", contentType: "text/plain" });
    const query = new URL(route.request().url()).searchParams, date = query.get("date")!;
    const total = query.getAll("services").reduce((sum, id) => sum + (id === beard ? 10 : 20), 0);
    const start = localMinuteInstants(date, 960)[0];
    await route.fulfill({ json: { reason: state.reason, schedule_revision: state.reason === "unpublished" ? null : 1, slots: state.reason === "available" ? [{ start: new Date(start).toISOString(), end: new Date(start + total * 60000).toISOString(), local_start: "16:00" }] : [] } });
  });
  return state;
}
async function loginOwner(page: Page) {
  const { owner } = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  expect(owner.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  await page.goto("/administrator");
  await page.getByLabel("Imejl adresa").fill(owner.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(owner.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeVisible();
}

for (const width of [360, 390, 768, 1280]) test(`availability connection failure keeps the public draft and recovers the selected start at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await availability(page);
  await page.goto("/rezervacija");
  await page.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check();
  await page.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
  await page.getByRole("button", { name: "Izaberi vreme", exact: true }).click();
  const input = page.getByLabel("Datum", { exact: true });
  await input.fill(addCalendarDays(await input.inputValue(), 1));
  await page.getByRole("radio", { name: /^16:00/ }).check();
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!));
  state.failure = true;
  await page.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click();
  await expect(page.locator(".availability-feedback").getByRole("alert")).toContainText("Ne možemo da proverimo slobodne termine");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pregled rezervacije", exact: true })).toBeDisabled();
  await expect(page.getByText("Svi odgovarajući termini su zauzeti.", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/ui6-public-failure-${width}.png`, fullPage: true });
  if (width === 1280) await page.locator(".availability-feedback").screenshot({ path: "test-results/ui6-retry-message.png" });
  await page.reload();
  await expect(page.locator(".availability-feedback").getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toEqual(before);
  state.failure = false;
  await page.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.getByRole("radio", { name: /^16:00/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "Pregled rezervacije", exact: true })).toBeEnabled();
  await expect(page.locator(".availability-feedback")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toEqual(before);
});

test("public empty-day reasons offer date/service recovery, distinct from a failed connection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const state = await availability(page);
  await page.goto("/rezervacija?usluga=brada");
  await expect(page.getByRole("radio")).toHaveCount(1);
  const messages = { unpublished: "Raspored još nije objavljen.", closed: "Ovaj dan je neradan.", fully_booked: "Svi odgovarajući termini su zauzeti.", insufficient_duration: "Nema dovoljno dugog slobodnog perioda za izabrane usluge.", cutoff: "Za danas više nema termina koji počinju najmanje 15 minuta unapred.", outside_horizon: "Datum je van perioda za zakazivanje." };
  for (const [reason, text] of Object.entries(messages)) {
    state.reason = reason;
    await page.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click();
    await expect(page.locator(".availability-feedback")).toContainText(text);
    await expect(page.locator(".availability-feedback").getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Izaberi drugi datum", exact: true }).click();
    await expect(page.getByLabel("Datum", { exact: true })).toBeFocused();
    if (reason === "insufficient_duration") {
      await page.getByRole("button", { name: "Promeni usluge", exact: true }).click();
      await expect(page.getByRole("checkbox", { name: "Brada 10 min", exact: true })).toBeChecked();
      await page.getByRole("button", { name: "Izaberi vreme", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Pregled rezervacije", exact: true })).toBeDisabled();
  }
  state.reason = "invalid_schedule";
  await page.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click();
  await expect(page.locator(".availability-feedback").getByRole("alert")).toContainText("Ne možemo da proverimo");
});

for (const width of [360, 390, 768, 1280]) test(`owner manual availability failure preserves fields and service/time selection at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await availability(page);
  await loginOwner(page);
  await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
  const form = page.getByRole("region", { name: "Ručna rezervacija", exact: true });
  await form.getByLabel("Ime osobe koja dolazi", { exact: true }).fill("UI6 neupisan gost");
  await form.getByLabel(/^Telefon gosta \(opciono\)/).fill("+381641234567");
  await form.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check();
  await form.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
  await form.getByRole("radio", { name: /^16:00/ }).check();
  await expect(form.getByRole("button", { name: "Potvrdi ručni termin", exact: true })).toBeEnabled();
  state.failure = true;
  await form.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("Ne možemo da proverimo slobodne termine");
  await expect(form.getByRole("button", { name: "Potvrdi ručni termin", exact: true })).toBeDisabled();
  await expect(form.getByLabel("Ime osobe koja dolazi", { exact: true })).toHaveValue("UI6 neupisan gost");
  await expect(form.getByLabel(/^Telefon gosta \(opciono\)/)).toHaveValue("+381641234567");
  await expect(form.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true })).toBeChecked();
  await expect(form.getByRole("checkbox", { name: "Brada 10 min", exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await form.screenshot({ path: `test-results/ui6-owner-failure-${width}.png` });
  state.failure = false;
  await form.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(form.getByRole("radio", { name: /^16:00/ })).toBeChecked();
  await expect(form.getByRole("button", { name: "Potvrdi ručni termin", exact: true })).toBeEnabled();
  await form.getByRole("button", { name: "Odustani", exact: true }).click();
});

test("owner empty-day reasons match public recovery and retain manual details", async ({ page }) => {
  const state = await availability(page);
  await loginOwner(page);
  await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
  const form = page.locator(".owner-form");
  await form.getByLabel("Ime osobe koja dolazi", { exact: true }).fill("UI6 neradni dan");
  await form.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
  await expect(form.getByRole("radio")).toHaveCount(1);
  for (const reason of ["unpublished", "closed", "fully_booked", "insufficient_duration", "cutoff"]) {
    state.reason = reason;
    await form.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click();
    await expect(form.locator(".availability-feedback")).toBeVisible();
    await form.getByRole("button", { name: "Izaberi drugi datum", exact: true }).click();
    await expect(form.getByLabel("Datum rezervacije", { exact: true })).toBeFocused();
    await expect(form.getByRole("alert")).toHaveCount(0);
    if (reason === "insufficient_duration") {
      await form.getByRole("button", { name: "Promeni usluge", exact: true }).click();
      await expect(form.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true })).toBeFocused();
    }
    await expect(form.getByLabel("Ime osobe koja dolazi", { exact: true })).toHaveValue("UI6 neradni dan");
  }
});

test("moving a confirmed visit offers a different date without suggesting a service-composition change", async ({ page }) => {
  await loginOwner(page);
  const date = addCalendarDays(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), 2);
  const start = new Date(localMinuteInstants(date, 960)[0]).toISOString();
  const row = { id: randomUUID(), status: "confirmed", location_id: "10000000-0000-4000-8000-000000000002", location_name: "Neuzin", service_id: beard, service_name: "Sačuvana kombinacija", duration_minutes: 30, starts_at: start, ends_at: new Date(Date.parse(start) + 30 * 60000).toISOString(), attendee_name: "UI6 bez stvarnog upisa", version: 1, user_id: null, phone: null, items: [{ service_id: beard, service_name: "Sačuvana nega", duration_minutes: 30, position: 1 }] };
  await page.route("**/api/owner/reservations?**", route => route.fulfill({ json: { server_time: new Date().toISOString(), reservations: [row] } }));
  await page.route("**/api/owner/availability?**", route => route.fulfill({ json: { reason: "insufficient_duration", schedule_revision: 1, slots: [] } }));
  let writes = 0;
  await page.route("**/api/owner/reservations", route => { if (route.request().method() === "POST") writes++; return route.abort(); });
  await page.getByRole("button", { name: "Osveži pregled", exact: true }).click();
  await page.getByRole("button", { name: "Izmeni termin", exact: true }).click();
  const form = page.locator(".owner-form");
  await expect(form.locator(".availability-feedback")).toContainText("Sastav potvrđenog dolaska ostaje isti.");
  await expect(form.getByRole("button", { name: "Promeni usluge", exact: true })).toHaveCount(0);
  await expect(form.getByRole("checkbox")).toHaveCount(0);
  await form.getByRole("button", { name: "Izaberi drugi datum", exact: true }).click();
  await expect(form.getByLabel("Datum rezervacije", { exact: true })).toBeFocused();
  expect(writes).toBe(0);
});

test("a genuinely empty catalogue differs from connection failure and leaves navigation targets", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".service-row")).toHaveCount(4);
  await page.route("**/api/catalogue/services", route => route.fulfill({ json: { data: [] } }));
  await page.locator(".services-section").getByRole("button", { name: "Osveži usluge", exact: true }).click();
  await expect(page.locator("#usluge")).toContainText("Trenutno nema dostupnih usluga");
  await expect(page.locator(".services-section").getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".location-card")).toHaveCount(2);
  await expect(page.locator("#lokacije")).toHaveCount(1);
});

test("public catalogue endpoints expose only their documented projection with no-store", async ({ request }) => {
  for (const kind of ["services", "locations"]) {
    const result = await request.get(`/api/catalogue/${kind}`);
    expect(result.status()).toBe(200);
    expect(result.headers()["cache-control"]).toContain("no-store");
    const { data } = await result.json(); expect(data.length).toBeGreaterThan(0);
    for (const row of data) expect(Object.keys(row).sort()).toEqual((kind === "services" ? ["slug", "name", "category", "duration_minutes", "sort_order"] : ["slug", "name", "address", "phone", "sort_order", "booking_enabled"]).sort());
  }
  expect((await request.get("/api/catalogue/profiles")).status()).toBe(404);
});
