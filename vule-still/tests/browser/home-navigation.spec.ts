import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(() => {
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
});

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function firstServiceInView(page: Page) {
  await expect(page).toHaveURL(/\/#usluge$/);
  await expect(page.locator("#usluge")).toBeFocused();
  const first = page.locator(".service-row").first();
  await expect.poll(async () => (await first.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await first.boundingBox())!.y).toBeLessThan(50);
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
}

for (const width of [360, 390, 768, 1280]) test(`home order, available location and service entry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("TVOJ STIL.TVOJ POTPIS.");
  await expect(page.getByRole("img", { name: "Frizer pažljivo oblikuje mušku frizuru" })).toBeVisible();
  await expect(page.locator(".brand-strip, .hero-side-note, .service-promo")).toHaveCount(0);
  await expect(page.locator("main > section").nth(1)).toHaveClass(/services-section/);
  await expect(page.locator(".service-row")).toHaveCount(4);
  for (const row of await page.locator(".service-row").all()) {
    await expect(row).toHaveAccessibleName(/.+ \d+ min$/);
  }
  const cards = page.locator(".location-card");
  await expect(cards.first().getByRole("heading")).toHaveText("Neuzin.");
  await expect(cards.first().getByRole("link")).toHaveAttribute("href", "/rezervacija?lokacija=neuzin");
  await expect(cards.last().getByRole("heading")).toHaveText("Zrenjanin.");
  await expect(cards.last().getByRole("link")).toHaveCount(0);
  expect((await cards.last().boundingBox())!.height).toBeLessThan((await cards.first().boundingBox())!.height);
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  for (const name of ["Moji termini", width === 1280 ? "Rezerviši termin" : "Rezerviši"]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toBeVisible();
    const bounds = await link.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.y + bounds!.height).toBeLessThan(200);
  }
  await fits(page);
  await page.screenshot({ path: `test-results/ui5-home-${width}.png`, fullPage: true, style: "nextjs-portal {visibility:hidden}" });
  await page.locator(".services-section").screenshot({ path: `test-results/ui5-services-${width}.png`, style: "nextjs-portal {visibility:hidden}" });
  await page.getByRole("link", { name: "Brada 10 min", exact: true }).click();
  await expect(page).toHaveURL(/\/rezervacija\?usluga=brada$/);
  await expect(page.getByRole("heading", { name: "Izaberi datum i vreme", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Izabrane usluge" })).toHaveText("Brada · 10 min");
  await fits(page);
});

for (const width of [360, 390, 768]) test(`mobile menu keyboard, Escape, focus exit and service anchor at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const toggle = page.locator(".navigation-toggle");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  const services = nav.getByRole("link", { name: "Usluge", exact: true });
  await expect(services).toBeHidden();
  // Reach the menu through the real tab order, rather than programmatic focus.
  for (let i = 0; i < 8 && !(await toggle.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(services).toBeFocused();
  await expect(nav.getByRole("link", { name: "Prijavi se", exact: true })).toBeVisible();
  await fits(page);
  await page.screenshot({ path: `test-results/ui5-menu-${width}.png`, fullPage: true, style: "nextjs-portal {visibility:hidden}" });
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(services).toBeHidden();
  await page.keyboard.press("Space");
  await expect(services).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(services).toBeFocused();
  await page.keyboard.press("Tab"); // Locations
  await page.keyboard.press("Tab"); // Sign in
  await page.keyboard.press("Tab"); // Leave the disclosure normally
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.keyboard.press("Enter"); // Services
  await firstServiceInView(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Izaberi datum i vreme", exact: true })).toBeVisible();
});

test("mobile secondary links cross routes, dismiss outside, close by button and reset after desktop resize", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/prijava");
  const toggle = page.locator(".navigation-toggle");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  await toggle.click();
  await nav.getByRole("link", { name: "Usluge", exact: true }).click();
  await firstServiceInView(page);
  await page.goto("/profil"); // Guest profile redirects to sign-in
  await expect(page.getByLabel("Broj telefona ili mejl", { exact: true })).toBeVisible();
  await toggle.click();
  await nav.getByRole("link", { name: "Lokacije", exact: true }).click();
  await expect(page.locator("#lokacije")).toBeFocused();
  await expect(page).toHaveURL(/\/#lokacije$/);
  await page.goto("/");
  await toggle.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(await page.locator("#public-secondary-navigation").evaluate(el => el.contains(document.activeElement))).toBe(false);
  await toggle.click();
  await page.getByRole("button", { name: "Zatvori meni", exact: true }).click();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(toggle).toBeHidden();
  await expect(nav.getByRole("link", { name: "Usluge", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav.getByRole("link", { name: "Usluge", exact: true })).toBeHidden();
});

test("desktop navigation stays visible and keyboard anchors focus their targets", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  await expect(page.locator(".navigation-toggle")).toBeHidden();
  for (const name of ["Usluge", "Lokacije", "Moji termini", "Prijavi se", "Rezerviši termin"]) await expect(nav.getByRole("link", { name, exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Usluge", exact: true }).press("Enter");
  await firstServiceInView(page);
});

for (const width of [390, 1280]) test(`signed-in account navigation and appointments at ${width}px`, async ({ page }) => {
  const { customer } = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  expect(customer.email).toMatch(/^vule-phase6-customer-.+@example\.invalid$/);
  await page.goto("/administrator");
  await page.getByLabel("Imejl adresa").fill(customer.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Glavna navigacija" });
  if (width === 390) await page.locator(".navigation-toggle").click();
  await expect(nav.getByRole("link", { name: "Moj profil", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Odjavi se", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Prijavi se", exact: true })).toHaveCount(0);
  await fits(page);
  await nav.getByRole("link", { name: "Moj profil", exact: true }).click();
  await expect(page).toHaveURL(/\/profil/);
  if (width === 390) await expect(page.locator(".navigation-toggle")).toHaveAttribute("aria-expanded", "false");
  await nav.getByRole("link", { name: "Moji termini", exact: true }).click();
  await expect(page).toHaveURL(/\/moji-termini$/);
  await expect(page.getByRole("heading", { name: "Naredni dolazak", exact: true })).toBeVisible();
  if (width === 390) await page.locator(".navigation-toggle").click();
  await nav.getByRole("button", { name: "Odjavi se", exact: true }).click();
  await page.goto("/");
  if (width === 390) await page.locator(".navigation-toggle").click();
  await expect(nav.getByRole("link", { name: "Prijavi se", exact: true })).toBeVisible();
});

test("home navigation reflows at 200 percent desktop equivalent", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3100/");
    await fits(page);
    await page.locator(".navigation-toggle").click();
    await fits(page);
    await page.getByRole("link", { name: "Usluge", exact: true }).click();
    await firstServiceInView(page);
    await fits(page);
  } finally { await context.close(); }
});
