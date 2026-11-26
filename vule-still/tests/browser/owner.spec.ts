import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
function tomorrow() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10);
}
test("owner manual booking/edit/cancel and conflicting schedule publication; ordinary customer denied", async ({ page, browser }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (new URL(url).hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") throw new Error("Only Vule-still-test");
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  if (!/^vule-phase6-owner-.+@example\.invalid$/.test(fixture.owner.email)) throw new Error("Synthetic owner required");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await db.auth.signInWithPassword(fixture.owner)).error).toBeNull(); expect((await db.rpc("ensure_session_access")).data).toBe(true);
  const date = tomorrow(), tag = `Owner E2E ${randomUUID().slice(0, 8)}`;
  const day = new Date(`${date}T12:00:00Z`), monday = new Date(day); monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7); const week = monday.toISOString().slice(0, 10);
  const original = (await db.rpc("get_owner_schedule", { p_week: week })).data;
  expect(original).toBeTruthy(); let draftTouched = false;
  const ownerRows = async () => (await db.rpc("get_owner_reservations", { p_from: date, p_to: date })).data.reservations;
  await page.goto("/prijava?next=%2Fadministracija"); await page.getByLabel("Imejl adresa").fill(fixture.owner.email); await page.getByLabel("Lozinka", { exact: true }).fill(fixture.owner.password); await page.getByRole("button", { name: "Prijavi se", exact: true }).click(); await page.waitForURL(u => u.pathname === "/administracija");
  await page.getByLabel("Datum pregleda", { exact: true }).fill(date); await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeEnabled();
  try {
    await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
    await page.getByLabel("Ime osobe koja dolazi", { exact: true }).fill(tag);
    await expect(page.locator(".owner-form .slot-options input[type=radio]").first()).toBeVisible();
    await page.locator(".owner-form .slot-options input[type=radio]").first().click();
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/owner-${width}.png`, fullPage: true });
    }
    await page.getByRole("button", { name: "Potvrdi ručni termin", exact: true }).click(); await expect(page.locator(".form-success")).toContainText("Ručni termin je potvrđen");
    let made = (await ownerRows()).find((r: { attendee_name: string; status: string }) => r.attendee_name === tag && r.status === "confirmed"); expect(made.user_id).toBeNull(); expect(made.phone).toBeNull();
    const card = page.locator(`[data-reservation="${made.id}"]`); await card.getByText("Detalji i kontakt", { exact: true }).click(); await expect(card).toContainText("Ručni gost — nema naloga ni obaveštenja u aplikaciji.");
    await card.getByRole("button", { name: "Izmeni termin", exact: true }).click(); await page.getByLabel("Telefon gosta (opciono)").fill("0641234567");
    await expect(page.locator(".owner-form .slot-options input[type=radio]").nth(1)).toBeVisible(); await page.locator(".owner-form .slot-options input[type=radio]").nth(1).click(); await page.getByRole("button", { name: "Sačuvaj izmenu", exact: true }).click(); await expect(page.locator(".form-success")).toHaveText("Izmena je sačuvana.");
    made = (await ownerRows()).find((r: { id: string }) => r.id === made.id); expect(made.version).toBe(2); expect(made.duration_minutes).toBe(20); expect(made.phone).toBe("+381641234567");
    page.once("dialog", d => d.accept()); await card.getByRole("button", { name: "Otkaži termin", exact: true }).click(); await expect(card).toContainText("Otkazana");
    console.log("Owner E2E: create, edit and regular cancellation passed");
    const locationFilter = page.getByRole("combobox", { name: "Filter lokacije", exact: true });
    await locationFilter.selectOption({ label: "Neuzin" }); await expect(card).toHaveCount(0); await locationFilter.selectOption({ label: "Obe lokacije" });
    console.log("Owner E2E: location filters passed");
    await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click(); await page.getByLabel("Ime osobe koja dolazi", { exact: true }).fill(`${tag} schedule`); await expect(page.locator(".owner-form .slot-options input[type=radio]").first()).toBeVisible(); await page.locator(".owner-form .slot-options input[type=radio]").first().click(); await page.getByRole("button", { name: "Potvrdi ručni termin", exact: true }).click(); await expect(page.locator(".form-success")).toContainText("Ručni termin je potvrđen");
    const protectedRow = (await ownerRows()).find((r: { attendee_name: string; status: string }) => r.attendee_name === `${tag} schedule` && r.status === "confirmed"); expect(protectedRow).toBeTruthy();
    await page.goto("/raspored"); await page.getByLabel("Izaberi nedelju").fill(week);
    const label = ["Nedelja", "Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"][day.getUTCDay()];
    await page.getByRole("button", { name: new RegExp(`^Zrenjanin, ${label}`) }).click();
    const originalStart = await page.getByLabel("Početak smene", { exact: true }).inputValue();
    const newStart = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(Date.parse(protectedRow.ends_at)));
    expect(newStart).not.toBe(originalStart); await page.getByLabel("Početak smene", { exact: true }).fill(newStart); await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click(); await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Nacrt je sačuvan" })).toBeVisible(); draftTouched = true;
    await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click(); await expect(page.locator(".form-error")).toContainText("Nijedan termin nije otkazan");
    expect((await ownerRows()).find((r: { id: string }) => r.id === protectedRow.id).status).toBe("confirmed");
    const after = (await db.rpc("get_owner_schedule", { p_week: week })).data; expect(after.published).toEqual(original.published); expect(after.published_revision).toBe(original.published_revision);
    const ordinary = await browser.newContext();
    try {
      const customer = await ordinary.newPage(); await customer.goto("/prijava?next=%2Fadministracija"); await customer.getByLabel("Imejl adresa").fill(fixture.customer.email); await customer.getByLabel("Lozinka", { exact: true }).fill(fixture.customer.password); await customer.getByRole("button", { name: "Prijavi se", exact: true }).click(); await customer.waitForURL(u => ["/moji-termini", "/profil"].includes(u.pathname));
      await customer.goto("/administracija"); await expect(customer.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
      expect((await customer.request.get(`/api/owner/reservations?from=${date}&to=${date}`)).status()).toBe(403);
    } finally { await ordinary.close(); }
  } finally {
    for (const r of (await ownerRows()).filter((r: { attendee_name: string; status: string }) => r.attendee_name.startsWith(tag) && r.status === "confirmed")) expect((await db.rpc("owner_cancel_reservation", { p_request_key: randomUUID(), p_reservation: r.id })).error).toBeNull();
    if (draftTouched) {
      const current = (await db.rpc("get_owner_schedule", { p_week: week })).data;
      // Detect any unrelated concurrent edit instead of overwriting it.
      expect(current.draft_revision).toBe(original.draft_revision + 1); expect(current.published_revision).toBe(original.published_revision);
      const restored = await db.rpc("save_schedule_draft", { p_week: week, p_expected_revision: current.draft_revision, p_entries: original.draft, p_gap: original.travel_gap_minutes }); expect(restored.error).toBeNull();
      const after = (await db.rpc("get_owner_schedule", { p_week: week })).data; expect(after.draft).toEqual(original.draft); expect(after.published).toEqual(original.published);
    }
    await db.auth.signOut({ scope: "local" });
  }
});
