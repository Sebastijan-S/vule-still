import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
test.beforeEach(() => {
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local").hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") throw new Error("Test project required");
});
function nextDay() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
}
for (const width of [360, 390, 1280]) test(`public booking at ${width}px keeps all controls within the page`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/rezervacija?lokacija=zrenjanin&usluga=klasicno-sisanje");
  await page.getByRole("button", { name: "Zrenjanin", exact: true }).click();
  await page.getByRole("button", { name: /Klasično šišanje/ }).click();
  await page.getByLabel("Datum", { exact: true }).fill(nextDay());
  await expect(page.locator(".slot-options button").first()).toBeVisible();
  await page.locator(".slot-options button").first().click();
  await page.getByRole("button", { name: "Pregled rezervacije", exact: true }).click();
  await expect(page.getByRole("link", { name: "Prijavi se i nastavi" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/booking-${width}.png`, fullPage: true });
});
test("anonymous selection survives signup/profile/refresh; lost response retry, private appointments, notification and cancellation", async ({ page, browser }) => {
  const person = `E2E ${randomUUID().slice(0, 8)}`;
  const email = `vule-booking-${randomUUID()}@example.invalid`, password = `${randomBytes(24).toString("base64url")}a1!`;
  await page.goto("/rezervacija");
  await page.getByRole("button", { name: "Zrenjanin", exact: true }).click();
  await page.getByRole("button", { name: /Klasično šišanje/ }).click();
  await page.getByLabel("Datum", { exact: true }).fill(nextDay());
  await expect(page.locator(".slot-options button").first()).toBeVisible();
  const time = await page.locator(".slot-options button").first().textContent() ?? "";
  await page.locator(".slot-options button").first().click();
  await page.getByRole("button", { name: "Pregled rezervacije", exact: true }).click();
  await page.getByRole("link", { name: "Prijavi se i nastavi" }).click();
  await page.getByLabel("Imejl adresa").fill(email); await page.getByLabel("Lozinka", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Napravi test nalog", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/profil");
  await page.getByLabel("Ime", { exact: true }).fill("Test"); await page.getByLabel("Prezime", { exact: true }).fill("Rezervacija"); await page.getByLabel("Broj telefona", { exact: true }).fill("0641234567");
  await page.getByRole("button", { name: "Sačuvaj podatke", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/rezervacija");
  await expect(page.getByLabel("Datum", { exact: true })).toHaveValue(nextDay());
  await expect(page.locator('.slot-options button[aria-pressed="true"]')).toHaveText(time);
  await page.reload();
  await expect(page.locator('.slot-options button[aria-pressed="true"]')).toHaveText(time);
  await page.getByRole("button", { name: "Pregled rezervacije", exact: true }).click();
  await page.getByLabel("Druga osoba", { exact: true }).check(); await page.getByLabel("Ime osobe koja dolazi", { exact: true }).fill(person);
  await expect(page.locator(".appointment-facts")).toContainText(email);
  let intercepted = false;
  await page.route("**/api/reservations", async route => {
    if (route.request().method() === "POST" && !intercepted) { intercepted = true; const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort("failed"); }
    else await route.continue();
  });
  let reservationId = "";
  try {
    await page.getByRole("button", { name: "Potvrdi rezervaciju", exact: true }).click();
    await expect(page.locator('.form-error[role="alert"]')).toContainText("Ishod potvrde još nije poznat");
    await page.getByRole("button", { name: "Proveri isti zahtev", exact: true }).click();
    await expect(page.getByText("REZERVACIJA JE POTVRĐENA", { exact: true })).toBeVisible();
    const response = await page.request.get("/api/reservations"); expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("no-store");
    const state = await response.json(); const made = state.reservations.filter((r: { attendee_name: string }) => r.attendee_name === person); expect(made).toHaveLength(1); reservationId = made[0].id;
    const notices = state.notifications.filter((n: { reservation_id: string }) => n.reservation_id === reservationId); expect(notices).toHaveLength(1);
    const foreignContext = await browser.newContext();
    try {
      const foreign = await foreignContext.newPage(), { customer } = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
      await foreign.goto("/prijava"); await foreign.getByLabel("Imejl adresa").fill(customer.email); await foreign.getByLabel("Lozinka", { exact: true }).fill(customer.password); await foreign.getByRole("button", { name: "Prijavi se", exact: true }).click(); await foreign.waitForURL(url => ["/moji-termini", "/profil"].includes(url.pathname));
      const foreignState = await (await foreign.request.get("/api/reservations")).json(); expect(foreignState.reservations.some((r: { id: string }) => r.id === reservationId)).toBe(false);
      const headers = { origin: "http://127.0.0.1:3100" };
      expect((await foreign.request.post("/api/reservations/cancel", { headers, data: { request_key: randomUUID(), reservation: reservationId } })).status()).toBe(404);
      expect((await foreign.request.post("/api/notifications/read", { headers, data: { notification: notices[0].id } })).status()).toBe(404);
    } finally { await foreignContext.close(); }
    await page.goto("/moji-termini");
    const card = page.locator(`[data-reservation="${reservationId}"]`); await expect(card).toContainText(person);
    await page.getByRole("button", { name: "Označi kao pročitano", exact: true }).first().click();
    await expect(page.getByText("0 nepročitanih", { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByText("0 nepročitanih", { exact: true })).toBeVisible();
    page.once("dialog", dialog => dialog.accept()); await card.getByRole("button", { name: "Otkaži rezervaciju", exact: true }).click();
    await expect(card).toContainText("Otkazana"); await page.reload(); await expect(page.locator(`[data-reservation="${reservationId}"]`)).toContainText("Otkazana");
    const final = await (await page.request.get("/api/reservations")).json(); expect(final.notifications.filter((n: { reservation_id: string }) => n.reservation_id === reservationId)).toHaveLength(2);
    expect((await page.request.post("/api/reservations", { headers: { origin: "https://unrelated.example" }, data: {} })).status()).toBe(403);
  } finally {
    // Only this explicitly tagged synthetic booking, never unrelated data.
    const response = await page.request.get("/api/reservations");
    if (response.ok()) for (const r of (await response.json()).reservations.filter((r: { attendee_name: string; status: string }) => r.attendee_name === person && r.status === "confirmed")) {
      const cancelled = await page.request.post("/api/reservations/cancel", { headers: { origin: "http://127.0.0.1:3100" }, data: { request_key: randomUUID(), reservation: r.id } }); expect(cancelled.status()).toBe(200);
    }
  }
});
