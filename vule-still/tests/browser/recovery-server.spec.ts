import { test, expect, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDays, localMinuteInstants } from "../../src/lib/availability";

const origin = process.env.VULE_RECOVERY_TEST_ORIGIN;
test.skip(!origin, "Requires a dedicated built test server with the transport fault hook; see RESULTS.md.");
test.use({ actionTimeout: 15000, baseURL: origin ?? "http://127.0.0.1:3101" });
const control = resolve(".env.ui6-server-faults.local");
const faults = (fail: string[] = []) => writeFile(control, JSON.stringify({ fail }));
const location = "10000000-0000-4000-8000-000000000002";
const haircut = "30000000-0000-4000-8000-000000000001", beard = "30000000-0000-4000-8000-000000000003";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

test.beforeEach(async () => {
  expect(origin).toBe("http://127.0.0.1:3101");
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  await faults();
});
test.afterEach(async () => { await faults(); });

async function login(page: Page, role: "owner" | "customer") {
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8"))[role];
  expect(fixture.email).toMatch(/^vule-phase6-(owner|customer)-.+@example\.invalid$/);
  await page.goto("/administrator");
  await page.getByLabel("Imejl adresa").fill(fixture.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  if (role === "owner") await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
  return fixture;
}

for (const kind of ["services", "locations"] as const) test(`initial server ${kind} failure keeps both anchors and the independent section, then retries only its API`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await faults([kind]);
  await page.goto("/");
  const failed = page.locator(kind === "services" ? ".services-section" : ".locations-section");
  await expect(failed.getByRole("alert")).toContainText(kind === "services" ? "ne možemo da prikažemo usluge" : "ne možemo da prikažemo lokacije");
  await expect(page.locator("#usluge")).toHaveCount(1);
  await expect(page.locator("#lokacije")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Stil je u detaljima.", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vidimo se u Neuzinu.", exact: true })).toBeVisible();
  if (kind === "services") await expect(page.locator(".location-card")).toHaveCount(2);
  else await expect(page.locator(".service-row")).toHaveCount(4);
  await page.locator(".navigation-toggle").click();
  await page.getByRole("link", { name: kind === "services" ? "Usluge" : "Lokacije", exact: true }).click();
  await expect(page.locator(kind === "services" ? "#usluge" : "#lokacije")).toBeFocused();
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/catalogue/")) requests.push(new URL(request.url()).pathname); });
  await failed.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(failed.getByRole("alert")).toBeVisible({ timeout: 20000 }); // Allow the SDK retry/timeout budget.
  await faults();
  await failed.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.locator(".service-row")).toHaveCount(4);
  await expect(page.locator(".location-card")).toHaveCount(2);
  expect(requests).toEqual([`/api/catalogue/${kind}`, `/api/catalogue/${kind}`]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/ui6-server-${kind}-recovered.png`, fullPage: true });
});

test("both catalogue failures retain both sections and can recover independently", async ({ page }) => {
  await faults(["services", "locations"]);
  await page.goto("/");
  await expect(page.locator(".services-section").getByRole("alert")).toBeVisible();
  await expect(page.locator(".locations-section").getByRole("alert")).toBeVisible();
  await faults(["locations"]);
  await page.locator(".services-section").getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.locator(".service-row")).toHaveCount(4);
  await expect(page.locator(".locations-section").getByRole("alert")).toBeVisible();
  await faults();
  await page.locator(".locations-section").getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.locator(".location-card")).toHaveCount(2);
});

test("booking catalogue load failure retains page context and exact draft, retry restores all choices", async ({ page }) => {
  const date = addCalendarDays(today(), 1), start = new Date(localMinuteInstants(date, 960)[0]).toISOString();
  const draft = { location, services: [haircut, beard], date, start, step: 3, other: true, attendee: "UI6 sačuvana osoba", needsReview: false };
  await page.goto("/");
  await page.evaluate(draft => sessionStorage.setItem("vule-booking-selection", JSON.stringify(draft)), draft);
  await page.route("**/api/availability?**", route => route.fulfill({ json: { reason: "available", schedule_revision: 1, slots: [{ start, end: new Date(Date.parse(start) + 30 * 60000).toISOString(), local_start: "16:00" }] } }));
  await faults(["services"]);
  await page.goto("/rezervacija?nastavi=1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rezerviši");
  await expect(page.getByRole("navigation", { name: "Glavna navigacija" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zakazivanje trenutno nije dostupno", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toEqual(draft);
  await expect(page.locator(".data-recovery").getByRole("link", { name: "Moji termini", exact: true })).toBeVisible();
  await faults();
  await page.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proveri svoj izbor", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Izabrane usluge" }).getByRole("listitem")).toHaveCount(2);
  await expect(page.locator(".appointment-facts")).toContainText("16:00–16:30");
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toMatchObject(draft);
});

test("pending exact request survives catalogue/profile failure and another lost response without availability reads", async ({ page }) => {
  const fixture = await login(page, "customer");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await db.auth.signInWithPassword(fixture); expect(auth.error).toBeNull();
  const id = auth.data.user!.id, date = addCalendarDays(today(), 1);
  const pending = { request_key: randomUUID(), location, services: [haircut, beard], expected_items: [{ service_id: haircut, service_name: "Sačuvano šišanje", duration_minutes: 20 }, { service_id: beard, service_name: "Sačuvana brada", duration_minutes: 10 }], expected_duration: 30, start: new Date(localMinuteInstants(date, 960)[0]).toISOString(), schedule_revision: 1, attendee_name: "UI6 pending osoba" };
  await page.evaluate(({ id, pending }) => sessionStorage.setItem(`vule-booking-pending:${id}`, JSON.stringify(pending)), { id, pending });
  let reads = 0, writes = 0;
  await page.route("**/api/availability?**", route => { reads++; return route.abort(); });
  await page.route("**/api/reservations", async route => {
    if (route.request().method() !== "POST") return route.continue();
    expect(route.request().postDataJSON()).toEqual(pending); writes++;
    if (writes === 1) return route.abort("failed");
    return route.fulfill({ json: { reservation: { id: randomUUID(), service_name: "Sačuvane usluge", duration_minutes: 30, location_name: "Neuzin", starts_at: pending.start, ends_at: new Date(Date.parse(pending.start) + 30 * 60000).toISOString(), attendee_name: pending.attendee_name } } });
  });
  try {
    await faults(["services", "locations", "profiles"]);
    await page.goto("/rezervacija");
    await expect(page.getByText("Sačuvano šišanje · 20 min", { exact: true })).toBeVisible();
    await expect(page.locator(".booking-panel").getByRole("link", { name: "Moji termini", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Proveri isti zahtev", exact: true }).click();
    await expect(page.locator(".form-error")).toContainText("Ishod potvrde još nije poznat");
    await page.reload();
    await page.getByRole("button", { name: "Proveri isti zahtev", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Vidimo se uskoro." })).toBeVisible();
    expect(writes).toBe(2); expect(reads).toBe(0);
    expect(await page.evaluate(id => sessionStorage.getItem(`vule-booking-pending:${id}`), id)).toBeNull();
  } finally { await db.auth.signOut({ scope: "local" }); }
});

test("owner data boundary keeps its heading/navigation and retry refetches the failed server component", async ({ page }) => {
  await login(page, "owner");
  await faults(["owner-reservations"]);
  await page.goto("/administracija");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pregled rezervacija");
  await expect(page.locator(".owner-header")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pregled rezervacija trenutno nije dostupan", exact: true })).toBeFocused();
  await faults();
  await page.getByRole("button", { name: "Pokušaj ponovo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pregled rezervacija trenutno nije dostupan", exact: true })).toHaveCount(0);
});
