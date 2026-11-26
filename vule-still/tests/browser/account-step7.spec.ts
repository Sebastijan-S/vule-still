import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Appointment, Notice } from "../../src/lib/appointment-display";

test.use({ actionTimeout: 15000 });
test.beforeEach(() => expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co"));
const haircut = "30000000-0000-4000-8000-000000000001", beard = "30000000-0000-4000-8000-000000000003";
const items = [{ service_id: haircut, service_name: "Klasično šišanje", duration_minutes: 20, position: 1 }, { service_id: beard, service_name: "Brada", duration_minutes: 10, position: 2 }];
const stamp = "2026-11-26T12:00:00.000Z";
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
async function loginCustomer(page: Page) {
  const { customer } = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  expect(customer.email).toMatch(/^vule-phase6-customer-.+@example\.invalid$/);
  await page.goto("/administrator");
  await page.getByLabel("Imejl adresa").fill(customer.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
}
async function mockTimes(page: Page) {
  await page.route("**/api/availability?**", async route => {
    const date = new URL(route.request().url()).searchParams.get("date");
    await route.fulfill({ json: { reason: "available", schedule_revision: 1, slots: [{ start: `${date}T16:00:00.000Z`, end: `${date}T16:30:00.000Z`, local_start: "17:00" }] } });
  });
}
function appointment(minutes: number, overrides: Partial<Appointment> = {}): Appointment {
  const start = Date.parse(stamp) + minutes * 60000;
  return { id: randomUUID(), status: "confirmed", service_id: haircut, service_name: "Klasično šišanje + Brada", duration_minutes: 30, starts_at: new Date(start).toISOString(), ends_at: new Date(start + 30 * 60000).toISOString(), location_id: "10000000-0000-4000-8000-000000000002", location_name: "Neuzin", attendee_name: "UI7 druga osoba", version: 1, items, ...overrides };
}
function notice(reservation: Appointment, read: boolean, index: number): Notice {
  return { id: randomUUID(), reservation_id: reservation.id, kind: "changed", message: `UI7 promena ${index}: dolazak je pomeren na 17:00–17:30, Neuzin.`, created_at: new Date(Date.parse(stamp) - index * 60000).toISOString(), read_at: read ? stamp : null, items, duration_minutes: 30 };
}
async function showFixture(page: Page, state: { server_time: string; reservations: Appointment[]; notifications: Notice[] }, navigate = true) {
  await page.route("**/api/reservations", route => route.request().method() === "GET" ? route.fulfill({ json: state }) : route.abort());
  if (navigate) await page.goto("/moji-termini");
  await page.getByRole("button", { name: "Osveži termine", exact: true }).click();
  await expect(page.getByRole("button", { name: "Osveži termine", exact: true })).toBeEnabled();
}

for (const width of [360, 390, 768, 1280]) test(`entry context and linked error at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const destination of ["/moji-termini", "/rezervacija?nastavi=1"]) {
    await page.goto(`/prijava?next=${encodeURIComponent(destination)}`);
    const back = page.locator("main .back-link");
    await expect(back).toHaveAttribute("href", destination);
    await expect(back).toHaveText(destination.startsWith("/rezervacija") ? "Nazad na rezervaciju" : "Nazad na Moje termine");
    const input = page.getByLabel("Broj telefona ili mejl", { exact: true });
    await input.fill("nije kontakt");
    await page.getByRole("button", { name: "Nastavi", exact: true }).click();
    await expect(input).toBeFocused();
    await expect(input).toHaveAccessibleDescription(/Unesi ispravan broj telefona ili mejl adresu/);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".guest-session-note")).toContainText("Ponovni unos istog kontakta ne vraća prethodnu sesiju");
    await fits(page);
    expect(await input.evaluate(el => getComputedStyle(el).fontSize)).toBe("16px");
    const entryWidth = await page.locator(".guest-entry").evaluate(el => el.getBoundingClientRect().width);
    expect(entryWidth).toBeLessThanOrEqual(560);
    if (destination === "/moji-termini") await page.screenshot({ path: `test-results/ui7-login-${width}.png`, fullPage: true });
    await back.focus(); await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(destination.startsWith("/rezervacija") ? "/rezervacija\\?nastavi=1$" : "/moji-termini$"));
  }
});

for (const [kind, contact, destination] of [["phone", "064 123 4567", "/rezervacija?nastavi=1"], ["email", `ui7-${randomUUID()}@example.invalid`, "/moji-termini"]]) test(`${kind}-only profile validation, refresh and contextual continuation`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await mockTimes(page);
  await page.goto("/rezervacija");
  await page.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check();
  await page.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
  await page.getByRole("button", { name: "Izaberi vreme", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Pregled rezervacije", exact: true }).click();
  const draft = await page.evaluate(() => sessionStorage.getItem("vule-booking-selection"));
  await page.goto(`/prijava?next=${encodeURIComponent(destination)}`);
  await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill(contact);
  await page.getByRole("button", { name: "Nastavi", exact: true }).click();
  await expect(page).toHaveURL(/\/profil\?/);
  await expect(page.locator("main .back-link").first()).toHaveAttribute("href", destination);
  await expect(page.locator('.profile-form input[name="next"]')).toHaveValue(destination);
  if (kind === "phone") {
    await expect(page.locator(".profile-required")).toHaveText("Za prvu rezervaciju nedostaje: ime i prezime.");
    await expect(page.getByLabel("Ime", { exact: true })).toBeFocused();
    await expect(page.getByLabel("Ime", { exact: true })).toHaveAccessibleDescription(/obavezno pre potvrde/);
  }
  await page.getByLabel("Ime", { exact: true }).fill(" ");
  await page.getByLabel("Prezime", { exact: true }).fill("UI7");
  await page.getByRole("button", { name: "Sačuvaj i nastavi", exact: true }).click();
  await expect(page.getByLabel("Ime", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Ime", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Ime", { exact: true })).toHaveAccessibleDescription(/Unesi ime/);
  for (const width of [360, 390, 768, 1280]) { await page.setViewportSize({ width, height: 900 }); await fits(page); }
  await page.screenshot({ path: `test-results/ui7-profile-${kind}.png`, fullPage: true });
  await page.reload();
  await expect(page.getByLabel(kind === "phone" ? "Mejl" : "Broj telefona", { exact: true })).toHaveValue("");
  await page.getByLabel("Ime", { exact: true }).fill("UI7"); await page.getByLabel("Prezime", { exact: true }).fill("Test profil");
  await page.getByRole("button", { name: "Sačuvaj i nastavi", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(destination.startsWith("/rezervacija") ? "/rezervacija\\?nastavi=1$" : "/moji-termini$"));
  expect(await page.evaluate(() => sessionStorage.getItem("vule-booking-selection")) ).toBe(draft);
  await page.goto("/profil");
  await expect(page.getByLabel(kind === "phone" ? "Mejl" : "Broj telefona", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Sačuvaj podatke", exact: true })).toBeVisible();
  // Missing both contacts remains a linked, focused server error.
  await page.getByLabel("Mejl", { exact: true }).fill(""); await page.getByLabel("Broj telefona", { exact: true }).fill("");
  await page.getByRole("button", { name: "Sačuvaj podatke", exact: true }).click();
  await expect(page.getByLabel("Broj telefona", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Broj telefona", { exact: true })).toHaveAccessibleDescription(/Dovoljan je jedan kontakt: telefon ili mejl/);
});

test("expired profile entry preserves booking return through sign-in", async ({ page }) => {
  await page.goto("/profil?next=%2Frezervacija%3Fnastavi%3D1");
  await expect(page).toHaveURL(/\/prijava\?next=%2Frezervacija%3Fnastavi%3D1$/);
  await expect(page.locator("main .back-link")).toHaveAttribute("href", "/rezervacija?nastavi=1");
});

for (const width of [360, 390, 768, 1280]) test(`next visit precedes unread changes and collapsed long history at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await loginCustomer(page);
  const next = appointment(180), later = appointment(360);
  const history = Array.from({ length: 18 }, (_, i) => appointment(-60 * (i + 1), { status: i % 2 ? "confirmed" : "cancelled" }));
  const unread = [notice(next, false, 1), notice(next, false, 2)];
  const state = { server_time: stamp, reservations: [later, ...history, next], notifications: [...Array.from({ length: 40 }, (_, i) => notice(next, true, i + 3)), ...unread] };
  await showFixture(page, state);
  const nextCard = page.locator(".next-visit .appointment-card");
  await expect(nextCard).toHaveAttribute("data-reservation", next.id);
  await expect(nextCard).toContainText("Dolazi: UI7 druga osoba");
  await expect(nextCard.locator(".visit-services")).toContainText("Brada · 10 min");
  await expect(nextCard.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
  await expect(nextCard).toContainText("Potvrđena");
  await expect(nextCard.locator("time")).toContainText("16:00");
  await expect(page.locator(".is-unread")).toHaveCount(2);
  await expect(page.locator(".appointment-history .appointment-card").first()).not.toBeVisible();
  await expect(page.locator(".read-notifications .notification").first()).not.toBeVisible();
  const order = await page.locator(".customer-appointments > *").evaluateAll(elements => elements.map(el => el.className));
  expect(order.slice(0, 2)).toEqual(["next-visit", "notification-panel"]);
  expect(await page.locator(".next-visit").evaluate(el => getComputedStyle(el).gridArea)).toBe("next");
  expect(await page.locator(".appointment-history").evaluate(el => getComputedStyle(el).gridArea)).toBe("history");
  await fits(page);
  await page.screenshot({ path: `test-results/ui7-appointments-${width}.png`, fullPage: true });
  const historyToggle = page.locator(".appointment-history > summary");
  await historyToggle.focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".appointment-history .appointment-card").first()).toBeVisible();
  await expect(page.locator(".appointment-history .status-cancelled")).toHaveCount(9);
  await expect(page.locator(".appointment-history .appointment-card").first().locator("time")).toContainText("12:00");
  await page.locator(".read-notifications > summary").focus(); await page.keyboard.press("Space");
  await expect(page.locator(".read-notifications .notification").last()).toBeVisible(); await fits(page);
  // A failed refresh keeps all existing cards and disclosure state.
  await page.route("**/api/reservations", route => route.abort("failed"));
  await page.getByRole("button", { name: "Osveži termine", exact: true }).click();
  await expect(page.locator("main .form-error[role=alert]")).toBeVisible(); await expect(nextCard).toBeVisible();
  await expect(page.locator(".appointment-history")).toHaveAttribute("open", "");
});

test("empty history, read notices and no upcoming visit remain available on demand", async ({ page }) => {
  await loginCustomer(page); await showFixture(page, { server_time: stamp, reservations: [], notifications: [] });
  await expect(page.getByText("Nemaš budućih potvrđenih rezervacija.")).toBeVisible();
  await expect(page.getByText("Nema nepročitanih promena.")).toBeVisible();
  await page.locator(".appointment-history > summary").click();
  await expect(page.getByText("Ovde će ostati istorija tvojih termina.")).toBeVisible();
  await page.locator(".read-notifications > summary").click();
  await expect(page.getByText("Ovde će ostati pročitana obaveštenja.")).toBeVisible();
});

test("30-minute boundary advances while open and API late refusal retains the visit", async ({ page }) => {
  await loginCustomer(page);
  await page.goto("/moji-termini");
  await expect(page.getByRole("button", { name: "Osveži termine", exact: true })).toBeVisible();
  await page.clock.install({ time: new Date(stamp) });
  await page.clock.pauseAt(new Date(Date.parse(stamp) + 1000));
  const boundary = appointment(30), tooLate = appointment(29), enough = appointment(60);
  await showFixture(page, { server_time: stamp, reservations: [boundary, tooLate, enough], notifications: [] }, false);
  const exact = page.locator(`[data-reservation="${boundary.id}"]`);
  await expect(exact.getByRole("button", { name: "Otkaži rezervaciju" })).toBeVisible();
  await expect(page.locator(`[data-reservation="${tooLate.id}"]`).getByRole("button")).toHaveCount(0);
  await page.clock.runFor(1001);
  await expect(exact.getByRole("button")).toHaveCount(0);
  await expect(exact).toContainText("manje od 30 minuta");
  await page.route("**/api/reservations/cancel", route => route.fulfill({ status: 409, json: { error: "Otkazivanje je moguće najmanje 30 minuta pre početka." } }));
  page.once("dialog", dialog => dialog.accept());
  await page.locator(`[data-reservation="${enough.id}"]`).getByRole("button", { name: "Otkaži rezervaciju" }).click();
  await expect(page.locator("main .form-error[role=alert]")).toContainText("najmanje 30 minuta");
  await expect(page.locator(`[data-reservation="${enough.id}"]`)).toContainText("Potvrđena");
});

test("200 percent equivalent reflow keeps account actions and collapsible history", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 450 }); await loginCustomer(page);
  const next = appointment(180);
  await showFixture(page, { server_time: stamp, reservations: [next, appointment(-60)], notifications: [notice(next, false, 1)] });
  await fits(page); await expect(page.getByRole("heading", { name: "Naredni dolazak" })).toBeVisible();
  await page.locator(".appointment-history > summary").click(); await fits(page);
  await page.screenshot({ path: "test-results/ui7-reflow-200-equivalent.png", fullPage: true });
});
