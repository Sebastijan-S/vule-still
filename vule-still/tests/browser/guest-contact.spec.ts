import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://127.0.0.1:3000" });

test("catalogue has revised durations and only Neuzin can be booked", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".service-row").filter({ hasText: "Šišanje i brada" })).toContainText("30 min");
  await expect(page.locator(".service-row").filter({ hasText: /^\d+Brada/ })).toContainText("10 min");
  await page.locator(".premium-list summary").click();
  await expect(page.locator(".service-row").filter({ hasText: "Sređivanje brade sa toplim peškirom" })).toContainText("20 min");
  await expect(page.locator(".service-row").filter({ hasText: "Sređivanje obrva britvom" })).toContainText("10 min");
  const zr = page.locator(".location-card").filter({ hasText: "Zrenjanin" });
  await expect(zr).toContainText("Zrenjanin rezervacije uskoro");
  await expect(zr.getByRole("link")).toHaveCount(0);
  await page.goto("/rezervacija?lokacija=zrenjanin");
  await expect(page.getByRole("button", { name: /Neuzin/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Zrenjanin/ })).toHaveCount(0);
});

test("guest entry has one contact field, no password/code, and validates invalid contact", async ({ page }) => {
  await page.goto("/prijava");
  await expect(page.getByLabel("Broj telefona ili mejl", { exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"],input[name="code"]')).toHaveCount(0);
  await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Nastavi", exact: true }).click();
  await expect(page.locator(".form-error")).toHaveText("Unesi ispravan broj telefona ili mejl adresu.");
  await expect(page).toHaveURL(/\/prijava$/);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/guest-entry-${width}.png`, fullPage: true });
  }
});

for (const [kind, contact] of [["phone", "064 123 4567"], ["email", "guest-ui@example.invalid"]]) {
  test(`guest ${kind} can enter and save profile without confirmations`, async ({ page, request }) => {
    const settings = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } });
    const config = await settings.json();
    test.skip(!config.external?.anonymous_users, "Enable Anonymous Sign-Ins in the test project's Auth settings first.");
    await page.goto("/prijava?next=%2Fmoji-termini");
    await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill(contact);
    await page.getByRole("button", { name: "Nastavi", exact: true }).click();
    await expect(page).toHaveURL(/\/profil\?/);
    await page.getByLabel("Ime", { exact: true }).fill("Test");
    await page.getByLabel("Prezime", { exact: true }).fill("Gost");
    await page.getByRole("button", { name: "Sačuvaj podatke" }).click();
    await expect(page).toHaveURL(/\/moji-termini$/);
    await page.reload();
    await expect(page.getByRole("link", { name: "Moj profil" })).toBeVisible();
    const response = await page.request.get("/api/reservations");
    expect(response.status()).toBe(200);
    expect((await response.json()).reservations).toEqual([]);
    await page.goto("/administrator");
    await expect(page.getByText("Ovaj nalog nema vlasničko ovlašćenje.", { exact: false })).toBeVisible();
  });
}
