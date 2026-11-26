import { test, expect } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDays } from "../../src/lib/availability";
import type { Appointment } from "../../src/lib/appointment-display";

test.use({ actionTimeout: 15000 });
for (const contact of [false, true]) test(`UI8 live manual ${contact ? "phone" : "name only"}, move to another date and cancel entire multi-service visit`, async ({ page }) => {
  test.setTimeout(120000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  expect(new URL(url).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8")).owner;
  expect(fixture.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  const owner = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await owner.auth.signInWithPassword(fixture)).error).toBeNull(); expect((await owner.rpc("ensure_session_access")).data).toBe(true);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = addCalendarDays(today, 1), next = addCalendarDays(today, 2), tag = `UI8 ${randomUUID()}`;
  const journal = `.env.ui8-${contact ? "phone" : "name"}-check.local`;
  const rows = async () => { const result = await owner.rpc("get_owner_reservations", { p_from: date, p_to: next }); expect(result.error).toBeNull(); return result.data.reservations as Appointment[]; };
  await writeFile(journal, JSON.stringify({ tag, date, next, stage: "started" }));
  // Only existing published shifts are used. No schedule/template writes.
  try {
    await page.setViewportSize({ width: 390, height: 900 }); await page.goto("/administrator");
    await page.getByLabel("Imejl adresa").fill(fixture.email); await page.getByLabel("Lozinka", { exact: true }).fill(fixture.password); await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
    await page.getByRole("button", { name: "Dodaj ručni termin", exact: true }).click();
    await page.getByLabel("Ime osobe koja dolazi", { exact: true }).fill(tag);
    if (contact) await page.getByLabel("Telefon gosta (opciono)").fill("0641234567");
    await expect(page.getByRole("combobox", { name: "Lokacija rezervacije", exact: true }).locator("option")).toHaveText(["Neuzin"]);
    await page.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check(); await page.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
    await page.getByLabel("Datum rezervacije", { exact: true }).fill(date);
    await expect(page.getByRole("radio").first(), "Existing published Neuzin shift and free 30 minutes required; do not prepare schedule automatically").toBeVisible();
    await page.getByRole("radio").first().check(); await expect(page.locator(".owner-form")).toContainText("ukupno 30 min");
    await page.getByRole("button", { name: "Potvrdi ručni termin", exact: true }).click(); await expect(page.locator(".form-success")).toContainText("Ručni termin je potvrđen");
    const booked = (await rows()).find(row => row.attendee_name === tag)!;
    expect(booked).toBeTruthy(); expect(booked.duration_minutes).toBe(30); expect(booked.items).toHaveLength(2); expect(booked.user_id).toBeNull(); expect(booked.phone).toBe(contact ? "+381641234567" : null);
    await writeFile(journal, JSON.stringify({ tag, date, next, reservation: booked.id, stage: "created" }));
    const card = page.locator(`[data-reservation="${booked.id}"]`);
    await expect(card.getByRole("list", { name: "Usluge ovog dolaska" }).getByRole("listitem")).toHaveCount(2); await expect(card).toContainText("Ukupno trajanje: 30 min");
    await card.getByRole("button", { name: "Izmeni termin", exact: true }).click();
    await expect(page.locator(".owner-form")).toContainText("Pre pomeranja:"); await expect(page.locator(".owner-form .visit-services")).toContainText("Klasično šišanje · 20 min"); await expect(page.locator(".owner-form .visit-services")).toContainText("Brada · 10 min");
    await expect(page.locator(".owner-form").getByRole("checkbox")).toHaveCount(0);
    await page.getByLabel("Datum rezervacije", { exact: true }).fill(next);
    await page.getByRole("radio").first().check();
    await expect(page.locator(".owner-form")).toContainText("ukupno 30 min");
    await page.screenshot({ path: `test-results/ui8-moving-${contact ? "phone" : "name"}.png`, fullPage: true });
    await page.getByRole("button", { name: "Sačuvaj izmenu", exact: true }).click(); await expect(page.locator(".form-success")).toHaveText("Izmena je sačuvana.");
    const moved = (await rows()).find(row => row.id === booked.id)!;
    expect(moved.starts_at.slice(0, 10)).toBe(next); expect(Date.parse(moved.ends_at) - Date.parse(moved.starts_at)).toBe(30 * 60000); expect(moved.items).toEqual(booked.items); expect(moved.duration_minutes).toBe(booked.duration_minutes); expect(moved.version).toBe(booked.version + 1);
    // Stale browser version cannot overwrite the move or its saved composition.
    const stale = await page.request.post("/api/owner/reservations", { headers: { origin: "http://127.0.0.1:3100" }, data: { operation: "update", request_key: randomUUID(), reservation: moved.id, version: booked.version, location: moved.location_id, start: new Date(moved.starts_at).toISOString(), schedule_revision: 1, name: tag, phone: null } });
    expect(stale.ok()).toBe(false); expect((await rows()).find(row => row.id === booked.id)).toEqual(moved);
    page.once("dialog", dialog => dialog.accept()); await card.getByRole("button", { name: "Otkaži termin", exact: true }).click(); await expect(card).toContainText("Otkazana");
    expect((await rows()).find(row => row.id === booked.id)!.items).toEqual(booked.items);
    await writeFile(journal, JSON.stringify({ tag, date, next, reservation: booked.id, stage: "complete_cancelled_history_retained" }));
  } finally {
    for (const row of (await rows()).filter(row => row.attendee_name === tag && row.status === "confirmed")) expect((await owner.rpc("owner_cancel_reservation", { p_request_key: randomUUID(), p_reservation: row.id })).error).toBeNull();
    await owner.auth.signOut({ scope: "local" });
  }
});

test("UI8 live historical Zrenjanin and Neuzin filters preserve all saved services", async ({ page }) => {
  expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8")).owner;
  expect(fixture.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  await page.goto("/administrator"); await page.getByLabel("Imejl adresa").fill(fixture.email); await page.getByLabel("Lozinka", { exact: true }).fill(fixture.password); await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  for (const [date, location, other] of [["2026-11-04", "Zrenjanin", "Neuzin"], ["2026-11-16", "Neuzin", "Zrenjanin"]]) {
    await page.getByLabel("Datum pregleda", { exact: true }).fill(date);
    await page.getByRole("combobox", { name: "Filter lokacije", exact: true }).selectOption({ label: location });
    await expect(page.locator(".appointment-card").first()).toBeVisible();
    for (const card of await page.locator(".appointment-card").all()) await expect(card).toContainText(location);
    await page.getByRole("combobox", { name: "Filter lokacije", exact: true }).selectOption({ label: other }); await expect(page.locator(".appointment-card")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Filter lokacije", exact: true }).selectOption({ label: "Obe lokacije" }); await expect(page.locator(".appointment-card").first()).toBeVisible();
  }
});
