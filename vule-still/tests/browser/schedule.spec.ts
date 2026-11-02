import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

let ownerContext: BrowserContext;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
test.beforeAll(async ({ browser }) => {
  if (new URL(url).hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") throw new Error("Test project required");
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  if (!/^vule-phase6-owner-.+@example\.invalid$/.test(fixture.owner.email)) throw new Error("Synthetic owner required");
  ownerContext = await browser.newContext();
  const page = await ownerContext.newPage();
  await page.goto("http://127.0.0.1:3100/prijava?next=%2Fraspored");
  await page.getByLabel("Imejl adresa").fill(fixture.owner.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(fixture.owner.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await page.waitForURL(path => path.pathname === "/raspored");
  await page.close();
});
test.afterAll(async () => { await ownerContext?.close(); });
async function openCalendar(page: Page) {
  await page.goto("http://127.0.0.1:3100/raspored");
  await expect(page.getByRole("heading", { name: "Zrenjanin", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Neuzin", exact: true })).toBeVisible();
}
for (const width of [360, 390, 1280]) test(`two weekly calendars and shift dialog at ${width}px`, async () => {
  const page = await ownerContext.newPage();
  await page.setViewportSize({ width, height: 900 });
  await openCalendar(page);
  await expect(page.locator(".location-calendar")).toHaveCount(2);
  await expect(page.locator(".calendar-day-label")).toHaveCount(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /^Zrenjanin, Ponedeljak/ }).click();
  const dialog = page.getByRole("dialog", { name: "Izmeni smenu" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "+ Dodaj pauzu", exact: true }).click();
  await expect(page.getByLabel("Pauza 1 od", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /^Zrenjanin, Ponedeljak/ })).toBeFocused();
  await expect(page.getByRole("button", { name: "Sačuvaj nacrt", exact: true })).toBeDisabled();
  await page.screenshot({ path: `test-results/schedule-${width}.png`, fullPage: true });
  await page.close();
});
test("visible authenticated activity is accepted only from the same origin", async () => {
  const page = await ownerContext.newPage();
  await openCalendar(page);
  expect(await page.evaluate(async () => (await fetch("/api/account-activity", { method: "POST" })).status)).toBe(204);
  const denied = await page.request.post("http://127.0.0.1:3100/api/account-activity", { headers: { origin: "https://unrelated.example" } });
  expect(denied.status()).toBe(403);
  await page.close();
});
test("owner edits, saves and publishes, then restores the original shift", async () => {
  const page = await ownerContext.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await openCalendar(page);
  const week = await page.getByLabel("Izaberi nedelju").inputValue();
  const publicSchedule = async () => {
    const response = await page.request.post(`${url}/rest/v1/rpc/published_schedule`, { headers: { apikey: key, authorization: `Bearer ${key}` }, data: { p_week: week } });
    expect(response.ok()).toBe(true); return response.json();
  };
  const before = await publicSchedule();
  const shift = page.getByRole("button", { name: /^Zrenjanin, Sreda/ });
  await shift.click();
  const originalEnd = await page.getByLabel("Kraj smene", { exact: true }).inputValue();
  let changed = false;
  try {
    await page.getByLabel("Kraj smene", { exact: true }).fill("14:40");
    await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click();
    await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Nacrt je sačuvan" })).toBeVisible(); changed = true;
    expect((await publicSchedule()).entries).toEqual(before.entries);
    await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Raspored je objavljen" })).toBeVisible();
    expect((await publicSchedule()).entries).not.toEqual(before.entries);
    await page.getByRole("button", { name: /^Objavljeno/ }).click();
    await expect(page.getByRole("button", { name: /Zrenjanin, Sreda.*14:40/ })).toBeDisabled();
    await page.getByRole("button", { name: /^Nacrt v/ }).click();
  } finally {
    if (changed) {
      await page.getByRole("button", { name: /^Nacrt v/ }).click();
      await page.getByRole("button", { name: /^Zrenjanin, Sreda/ }).click();
      await page.getByLabel("Kraj smene", { exact: true }).fill(originalEnd);
      await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click();
      await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Nacrt je sačuvan" })).toBeVisible();
      await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Raspored je objavljen" })).toBeVisible();
      expect((await publicSchedule()).entries).toEqual(before.entries);
    }
    await page.close();
  }
});
