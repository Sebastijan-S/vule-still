import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const location = "10000000-0000-4000-8000-000000000002";
const service = "30000000-0000-4000-8000-000000000007";
const withdrawn = "Izabrana usluga trenutno nije u ponudi. Izaberi neku od dostupnih usluga.";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
async function login(page: Page, role: "owner" | "customer") {
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
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

for (const width of [390, 1280]) test(`withdrawn links show four available services at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const slug of ["oblikovanje-obrva-britvom", "tretman-toplim-peskirom", "tretman-usnim-svecama"]) {
    await page.goto(`/rezervacija?usluga=${slug}`);
    await expect(page.getByRole("heading", { name: "Usluge", exact: true })).toBeVisible();
    await expect(page.getByText(withdrawn, { exact: true })).toBeVisible();
    await expect(page.locator(".booking-options .booking-option")).toHaveCount(4);
    await expect(page.getByText("Premium usluge", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: `test-results/withdrawn-service-${width}.png`, fullPage: true });
});

test("withdrawn draft retains location/date and clears the old service and start", async ({ page }) => {
  const date = today();
  await page.addInitScript(({ location, service, date }) => {
    sessionStorage.setItem("vule-booking-selection", JSON.stringify({ location, service, date, start: `${date}T10:00:00.000Z` }));
  }, { location, service, date });
  await page.goto("/rezervacija");
  await expect(page.getByRole("heading", { name: "Usluge", exact: true })).toBeVisible();
  await expect(page.getByText(withdrawn, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("vule-booking-selection")!))).toEqual({ location, service: "", date, start: "" });
  await page.getByRole("button", { name: "Brada 10 min", exact: true }).click();
  await expect(page.getByLabel("Datum", { exact: true })).toHaveValue(date);
  await expect(page.getByText("Neuzin · Brada · 10 min", { exact: true })).toBeVisible();
  await expect(page.getByText(withdrawn, { exact: true })).toHaveCount(0);
});

test("owner manual selector has four services and API rejects all withdrawn IDs", async ({ page }) => {
  await login(page, "owner");
  await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
  await expect(page.getByLabel("Usluga rezervacije").locator("option")).toHaveCount(4);
  for (const [suffix, name, duration] of [["5", "Sređivanje obrva britvom", 10], ["6", "Sređivanje brade sa toplim peškirom", 20], ["7", "Tretman ušnim svećama", 40]] as const) {
    const data = { request_key: randomUUID(), location, service: `30000000-0000-4000-8000-00000000000${suffix}`, start: `${today()}T20:00:00.000Z`, schedule_revision: 1, expected_service_name: name, expected_duration: duration, attendee_name: null };
    const headers = { origin: "http://127.0.0.1:3100" };
    for (const [path, body] of [["/api/reservations", data], ["/api/owner/reservations", { ...data, operation: "create", name: "Premium API test", phone: null }]] as const) {
      const response = await page.request.post(path, { headers, data: body });
      expect(response.status()).toBe(409);
      expect((await response.json()).error).toBe("Usluga više nije dostupna. Ponovo izaberi uslugu.");
    }
  }
});

for (const outcome of ["confirmed", "rejected"]) test(`pending withdrawn request retries its saved snapshot: ${outcome}`, async ({ page }) => {
  const fixture = await login(page, "customer");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await db.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  expect(auth.error).toBeNull();
  const pending = { request_key: randomUUID(), location, service, start: `${today()}T16:00:00.000Z`, schedule_revision: 1, expected_service_name: "Tretman ušnim svećama", expected_duration: 40, attendee_name: null };
  await page.evaluate(({ id, pending }) => sessionStorage.setItem(`vule-booking-pending:${id}`, JSON.stringify(pending)), { id: auth.data.user!.id, pending });
  let received: unknown;
  await page.route("**/api/reservations", async route => {
    if (route.request().method() !== "POST") return route.continue();
    received = route.request().postDataJSON();
    await route.fulfill({ status: outcome === "confirmed" ? 200 : 409, json: outcome === "confirmed" ? { reservation: { id: randomUUID(), status: "confirmed", service_id: service, service_name: pending.expected_service_name, duration_minutes: 40, location_id: location, attendee_name: "Test korisnik", starts_at: pending.start, ends_at: `${today()}T16:40:00.000Z` } } : { error: "Usluga više nije dostupna. Ponovo izaberi uslugu.", retry_same_key: false } });
  });
  try {
    await page.goto("/rezervacija");
    await expect(page.getByText("Tretman ušnim svećama · 40 min", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Proveri isti zahtev", exact: true }).click();
    expect(received).toEqual(pending);
    if (outcome === "confirmed") await expect(page.getByRole("heading", { name: "Vidimo se uskoro." })).toBeVisible();
    else { await expect(page.getByRole("heading", { name: "Usluge", exact: true })).toBeVisible(); await expect(page.getByText(withdrawn, { exact: true })).toBeVisible(); }
    expect(await page.evaluate(id => sessionStorage.getItem(`vule-booking-pending:${id}`), auth.data.user!.id)).toBeNull();
  } finally { await db.auth.signOut({ scope: "local" }); }
});
