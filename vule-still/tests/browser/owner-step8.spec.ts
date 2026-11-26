import { test, expect, type Page, type Browser, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { addCalendarDays } from "../../src/lib/availability";

const neuzin = "10000000-0000-4000-8000-000000000002";
const zrenjanin = "10000000-0000-4000-8000-000000000001";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monday = () => addCalendarDays(today(), -(new Date(`${today()}T12:00:00Z`).getUTCDay() + 6) % 7);
let state: Awaited<ReturnType<BrowserContext["storageState"]>>;
async function login(browser: Browser) {
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8")).owner;
  expect(fixture.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto("http://127.0.0.1:3100/administrator");
  await page.getByLabel("Imejl adresa").fill(fixture.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeVisible({ timeout: 20000 });
  state = await context.storageState(); await context.close();
}
test.use({ actionTimeout: 15000 });
test.beforeAll(async ({ browser }) => login(browser));
test.beforeEach(async ({ context }) => context.addCookies(state.cookies));
async function fits(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }

// All schedule mutations in this file are intercepted. No test prepares, saves,
// publishes, restores or deletes a real schedule or template.
async function scheduleFixture(page: Page, empty = false) {
  const entries = [
    { date: monday(), location_id: zrenjanin, start_minute: 600, end_minute: 900, breaks: [{ start_minute: 660, end_minute: 680 }] },
    { date: monday(), location_id: neuzin, start_minute: 1020, end_minute: 1200, breaks: [{ start_minute: 1080, end_minute: 1100 }] },
    { date: monday(), location_id: neuzin, start_minute: 1260, end_minute: 1320, breaks: [] },
  ];
  let week: { draft: typeof entries; published: typeof entries | null; draft_revision: number; published_revision: number; travel_gap_minutes: number; published_gap_minutes: number | null } | null = empty ? null : { draft: entries, published: structuredClone(entries), draft_revision: 5, published_revision: 3, travel_gap_minutes: 60, published_gap_minutes: 60 };
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  let conflict = false;
  await page.route("**/rest/v1/rpc/*", async route => {
    const name = route.request().url().split("/").at(-1)!;
    if (!["get_owner_schedule", "prepare_schedule_week", "save_schedule_draft", "publish_schedule_week"].includes(name)) return route.continue();
    const body = route.request().postDataJSON(); calls.push({ name, body });
    if (name === "get_owner_schedule") return route.fulfill({ json: week });
    if (name === "prepare_schedule_week") { week = { draft: [], published: null, draft_revision: 0, published_revision: 0, travel_gap_minutes: 60, published_gap_minutes: null }; return route.fulfill({ json: week }); }
    if (name === "save_schedule_draft") { expect(body.p_expected_revision).toBe(week!.draft_revision); week = { ...week!, draft: body.p_entries, travel_gap_minutes: body.p_gap, draft_revision: week!.draft_revision + 1 }; return route.fulfill({ json: week.draft_revision }); }
    if (conflict) return route.fulfill({ status: 400, json: { code: "P0001", message: "SCHEDULE_RESERVATION_CONFLICT" } });
    expect(body.p_expected_revision).toBe(week!.draft_revision);
    week = { ...week!, published: structuredClone(week!.draft), published_gap_minutes: week!.travel_gap_minutes, published_revision: week!.published_revision + 1 };
    return route.fulfill({ json: week.published_revision });
  });
  return { calls, getWeek: () => structuredClone(week), setConflict: () => { conflict = true; } };
}

for (const width of [360, 390, 768, 1280]) test(`UI8 selected day, shifts, breaks, Sunday, dialog and desktop calendars at ${width}px`, async ({ page }) => {
  const fixture = await scheduleFixture(page);
  await page.setViewportSize({ width, height: 900 }); await page.goto("/raspored");
  await page.getByLabel("Izaberi nedelju").fill(monday());
  await expect(page.locator(".schedule-badge")).toHaveText("Nacrt odgovara objavljenom rasporedu");
  if (width <= 760) {
    await expect(page.getByRole("region", { name: "Dnevni raspored", exact: true })).toBeVisible();
    await expect(page.locator(".location-calendars")).not.toBeVisible();
    await page.getByRole("combobox", { name: "Izabrani dan", exact: true }).selectOption(monday());
    const neuzinDay = page.getByRole("region", { name: "Smene — Neuzin", exact: true });
    await expect(neuzinDay.locator(".schedule-day-shift")).toHaveCount(2);
    await expect(neuzinDay).toContainText("Pauza 18:00–18:20");
    await expect(page.getByRole("region", { name: "Smene — Zrenjanin", exact: true })).toContainText("Pauza 11:00–11:20");
    await page.getByRole("combobox", { name: "Izabrani dan", exact: true }).selectOption(addCalendarDays(monday(), 6));
    await expect(page.locator(".schedule-day-heading")).toContainText("Nedelja");
    await expect(page.getByText("Neradno · nema smena za ovaj dan.", { exact: true })).toHaveCount(2);
  } else {
    await expect(page.locator(".schedule-day")).not.toBeVisible();
    await expect(page.locator(".location-calendar")).toHaveCount(2);
    await expect(page.locator(".location-calendars")).toBeVisible();
    await expect(page.locator(".calendar-day-label")).toHaveCount(14);
  }
  const opener = page.getByRole("button", { name: width <= 760 ? "Dodaj smenu — Neuzin, izabrani dan" : "Dodaj smenu — Neuzin, Nedelja", exact: true });
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Nova smena", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Primeni u nacrtu", exact: true })).toBeVisible();
  const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  await dialog.getByRole("button", { name: "+ Dodaj pauzu", exact: true }).click();
  await page.getByLabel("Pauza 1 od", { exact: true }).fill("18:00");
  await page.getByLabel("Pauza 1 do", { exact: true }).fill("18:20");
  const apply = dialog.getByRole("button", { name: "Primeni u nacrtu", exact: true });
  await apply.focus(); await page.keyboard.press("Tab"); await expect(dialog.getByRole("button", { name: "Zatvori izmenu smene" })).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(apply).toBeFocused();
  await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
  await opener.click(); await apply.click();
  await expect(opener).toBeFocused();
  await expect(page.locator(".schedule-badge")).toHaveText("Nesačuvane izmene");
  await expect(page.getByRole("button", { name: "Objavi nedelju", exact: true })).toBeDisabled();
  if (width <= 760) await expect(page.getByRole("region", { name: "Smene — Neuzin", exact: true })).toContainText("17:00–20:00");
  await fits(page);
  await page.screenshot({ path: `test-results/ui8-schedule-${width}.png`, fullPage: true, style: "nextjs-portal { visibility: hidden } .skip-link:not(:focus) { visibility: hidden }" });
  expect(fixture.calls.filter(c => c.name !== "get_owner_schedule")).toEqual([]);
});

for (const width of [360, 390, 768, 1280]) test(`UI8 template action and history/manual location separation at ${width}px`, async ({ page }) => {
  let writes = 0;
  await page.route("**/rest/v1/rpc/save*", route => { writes++; return route.abort(); });
  await page.setViewportSize({ width, height: 900 }); await page.goto("/administrator/sablon");
  const opener = page.getByRole("button", { name: /^(Izmeni|Dodaj) uobičajenu smenu — Neuzin, Nedelja$/ });
  await opener.press("Enter"); const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Primeni u šablonu", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Primeni u nacrtu", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
  await opener.click(); await dialog.getByRole("button", { name: "Primeni u šablonu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sačuvaj uobičajenu nedelju", exact: true })).toBeEnabled();
  await expect(page.getByText("Promena šablona ne menja postojeće nacrte ni objavljene nedelje.", { exact: false })).toBeVisible(); await fits(page);
  await page.goto("/administracija");
  await expect(page.getByRole("combobox", { name: "Filter lokacije", exact: true }).locator("option")).toHaveText(["Obe lokacije", "Zrenjanin", "Neuzin"]);
  await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Lokacija rezervacije", exact: true }).locator("option")).toHaveText(["Neuzin"]);
  await expect(page.getByLabel("Telefon gosta (opciono)")).toHaveValue("");
  await page.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check(); await page.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
  await expect(page.locator(".owner-form")).toContainText("Ukupno trajanje: 30 min"); await fits(page);
  await page.screenshot({ path: `test-results/ui8-manual-${width}.png`, fullPage: true }); expect(writes).toBe(0);
});

test("UI8 saved draft, published comparison and rejected conflict preserve active schedule (intercepted RPC)", async ({ page }) => {
  const fixture = await scheduleFixture(page); const before = fixture.getWeek()!;
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto("/raspored"); await page.getByLabel("Izaberi nedelju").fill(monday());
  await page.getByRole("combobox", { name: "Izabrani dan", exact: true }).selectOption(monday());
  await page.getByRole("button", { name: "Izmeni smenu — Neuzin, 17:00–20:00", exact: true }).click();
  await page.getByLabel("Kraj smene", { exact: true }).fill("19:40");
  await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Objavi nedelju", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click();
  await expect(page.locator(".schedule-badge")).toHaveText("Sačuvan nacrt ima neobjavljene izmene");
  expect(fixture.getWeek()!.published).toEqual(before.published);
  await page.getByRole("button", { name: /^Objavljeno/ }).click();
  await expect(page.getByRole("region", { name: "Smene — Neuzin", exact: true })).toContainText("17:00–20:00");
  await expect(page.getByRole("button", { name: "Objavi nedelju", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: /^Nacrt v/ }).click(); fixture.setConflict();
  await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("Nijedan termin nije otkazan");
  expect(fixture.getWeek()!.published).toEqual(before.published); expect(fixture.getWeek()!.published_revision).toBe(before.published_revision);
  expect(fixture.calls.filter(c => c.name === "save_schedule_draft")).toHaveLength(1);
});

test("UI8 unprepared and empty prepared week, Sunday and unpublished view (intercepted RPC)", async ({ page }) => {
  const fixture = await scheduleFixture(page, true);
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto("/raspored");
  await expect(page.getByRole("heading", { name: "Nedelja još nije pripremljena.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pripremi nedelju", exact: true }).click();
  await expect(page.locator(".schedule-badge")).toContainText("Sačuvan nacrt");
  await page.getByRole("combobox", { name: "Izabrani dan", exact: true }).selectOption(addCalendarDays(monday(), 6));
  await expect(page.getByText("Neradno · nema smena za ovaj dan.", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Dodaj smenu — Neuzin, izabrani dan", exact: true }).click();
  await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click();
  await expect(page.getByRole("region", { name: "Smene — Neuzin", exact: true })).toContainText("17:00–20:00");
  await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click();
  await page.getByRole("button", { name: /^Objavljeno/ }).click();
  await expect(page.getByRole("heading", { name: "Raspored još nije objavljen.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Nacrt v/ }).click(); await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click();
  await expect(page.locator(".form-success")).toContainText("Raspored je objavljen");
  expect(fixture.getWeek()!.published).toEqual(fixture.getWeek()!.draft); await fits(page);
});

test("UI8 200 percent equivalent reflow keeps selected day and actions usable", async ({ page }) => {
  await scheduleFixture(page); await page.setViewportSize({ width: 640, height: 450 }); await page.goto("/raspored");
  await expect(page.getByRole("combobox", { name: "Izabrani dan", exact: true })).toBeVisible(); await fits(page);
  await page.getByRole("button", { name: "Dodaj smenu — Neuzin, izabrani dan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Primeni u nacrtu", exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await fits(page);
  await page.screenshot({ path: "test-results/ui8-reflow-200-equivalent.png", fullPage: true });
});
