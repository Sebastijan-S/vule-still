import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { addCalendarDays } from "../../src/lib/availability";
import type { Appointment, Notice } from "../../src/lib/appointment-display";

test.use({ actionTimeout: 15000 });
for (const kind of ["phone", "email"]) test(`UI7 live ${kind}: multi-service first visit, pending retry, read changes, cancellation and guest logout`, async ({ page }) => {
  test.setTimeout(120000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  expect(new URL(url).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const tag = `UI7 ${randomUUID()}`, contact = kind === "phone" ? "064 123 4567" : `ui7-${randomUUID()}@example.invalid`;
  const fixture = JSON.parse(await readFile(".env.phase6-state.local", "utf8")).owner;
  expect(fixture.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  const owner = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await owner.auth.signInWithPassword(fixture)).error).toBeNull();
  expect((await owner.rpc("ensure_session_access")).data).toBe(true);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = addCalendarDays(today, 1);
  // Use only the user's published schedule. This test never prepares, saves,
  // publishes, restores or deletes a schedule/week/template.
  const journal = `.env.ui7-${kind}-check.local`;
  await writeFile(journal, JSON.stringify({ tag, date, stage: "started" }));
  try {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/rezervacija");
    await page.getByRole("checkbox", { name: "Klasično šišanje 20 min", exact: true }).check();
    await page.getByRole("checkbox", { name: "Brada 10 min", exact: true }).check();
    await page.getByRole("button", { name: "Izaberi vreme", exact: true }).click();
    await page.getByLabel("Datum", { exact: true }).fill(date);
    await expect(page.getByRole("radio").first(), "A published Neuzin shift with a free 30-minute interval is required").toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Pregled rezervacije", exact: true }).click();
    await page.getByRole("link", { name: "Prijavi se i nastavi", exact: true }).click();
    await expect(page.getByRole("link", { name: "Nazad na rezervaciju", exact: true })).toHaveAttribute("href", "/rezervacija?nastavi=1");
    await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill(contact);
    await page.getByRole("button", { name: "Nastavi", exact: true }).click();
    await expect(page).toHaveURL(/\/profil\?/);
    await expect(page.locator(".profile-required")).toContainText("ime i prezime");
    await page.reload();
    await page.getByLabel("Ime", { exact: true }).fill("UI7"); await page.getByLabel("Prezime", { exact: true }).fill("Test dolazak");
    await page.getByRole("button", { name: "Sačuvaj i nastavi", exact: true }).click();
    await expect(page).toHaveURL(/\/rezervacija\?nastavi=1$/);
    await expect(page.getByRole("list", { name: "Izabrane usluge" }).getByRole("listitem")).toHaveCount(2);
    await page.getByLabel("Druga osoba", { exact: true }).check();
    await page.getByLabel("Ime osobe koja dolazi", { exact: true }).fill(tag);
    await page.reload(); await expect(page.getByLabel("Ime osobe koja dolazi", { exact: true })).toHaveValue(tag);
    let sent: unknown, intercepted = false;
    await page.route("**/api/reservations", async route => {
      if (route.request().method() !== "POST") return route.continue();
      if (!intercepted) { intercepted = true; sent = route.request().postDataJSON(); const response = await route.fetch(); expect(response.status()).toBe(200); return route.abort("failed"); }
      expect(route.request().postDataJSON()).toEqual(sent); return route.continue();
    });
    await page.getByRole("button", { name: "Potvrdi rezervaciju", exact: true }).click();
    await expect(page.locator(".form-error[role=alert]")).toContainText("Ishod potvrde još nije poznat");
    await page.reload(); await page.getByRole("button", { name: "Proveri isti zahtev", exact: true }).click();
    await expect(page.getByText("REZERVACIJA JE POTVRĐENA", { exact: true })).toBeVisible();
    const mine = await (await page.request.get("/api/reservations")).json();
    const made = mine.reservations.filter((r: Appointment) => r.attendee_name === tag);
    expect(made).toHaveLength(1); const booked: Appointment = made[0];
    expect(booked.items).toHaveLength(2); expect(booked.duration_minutes).toBe(30);
    const notifications: Notice[] = mine.notifications.filter((n: Notice) => n.reservation_id === booked.id);
    expect(notifications).toHaveLength(1);
    await writeFile(journal, JSON.stringify({ tag, date, reservation: booked.id, stage: "confirmed" }));
    await page.goto("/moji-termini");
    const card = page.locator(`[data-reservation="${booked.id}"]`);
    await expect(page.locator(".next-visit .appointment-card")).toHaveAttribute("data-reservation", booked.id);
    await expect(card.locator(".visit-services")).toContainText("Klasično šišanje · 20 min");
    await expect(card.locator(".visit-services")).toContainText("Brada · 10 min");
    await card.locator("summary").click(); await expect(card.locator(".appointment-facts")).toContainText(kind === "phone" ? "+381641234567" : contact);
    await page.screenshot({ path: `test-results/ui7-live-${kind}.png`, fullPage: true });
    const notification = page.locator(`[data-notification="${notifications[0].id}"]`);
    await notification.getByRole("button", { name: "Označi kao pročitano" }).click();
    await expect(page.getByRole("heading", { name: /Nepročitane promene/ })).toBeFocused();
    await expect(notification).not.toBeVisible();
    await page.locator(".read-notifications > summary").click(); await expect(notification).toContainText("Pročitano");
    await page.reload(); await expect(page.locator(".unread-count")).toHaveText("0 nepročitanih");
    await page.locator(".read-notifications > summary").click(); await expect(notification).toBeVisible();
    page.once("dialog", dialog => dialog.accept()); await card.getByRole("button", { name: "Otkaži rezervaciju" }).click();
    await expect(page.locator(".form-success")).toContainText("Rezervacija je otkazana");
    await expect(page.getByRole("heading", { name: "Naredni dolazak", exact: true })).toBeFocused();
    await expect(card).not.toBeVisible(); await page.locator(".appointment-history > summary").click();
    await expect(card).toContainText("Otkazana"); await expect(card.locator(".visit-services")).toContainText("Ukupno trajanje: 30 min");
    await page.reload(); await page.locator(".appointment-history > summary").click(); await expect(card).toContainText("Otkazana");
    // Owner readback verifies the same saved composition without editing it.
    const rows = await owner.rpc("get_owner_reservations", { p_from: date, p_to: date }); expect(rows.error).toBeNull();
    const saved = rows.data.reservations.find((r: Appointment) => r.id === booked.id);
    expect(saved.status).toBe("cancelled"); expect(saved.items).toEqual(booked.items);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "Odjavi se", exact: true }).click();
    await expect(page).toHaveURL(/\/prijava\?odjava=1$/);
    await expect(page.locator(".guest-session-note:visible")).toContainText("Posle odjave");
    await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill(contact);
    await page.getByRole("button", { name: "Nastavi", exact: true }).click();
    await expect(page).toHaveURL(/\/profil\?/);
    await page.goto("/moji-termini");
    const fresh = await (await page.request.get("/api/reservations")).json(); expect(fresh.reservations).toEqual([]);
    await expect(page.getByText("Nemaš budućih potvrđenih rezervacija.")).toBeVisible();
    await writeFile(journal, JSON.stringify({ tag, date, reservation: booked.id, stage: "complete_cancelled_history_retained" }));
  } finally {
    // Cancel only this run's synthetic visits, retaining all history and schedule.
    const rows = await owner.rpc("get_owner_reservations", { p_from: date, p_to: date }); expect(rows.error).toBeNull();
    for (const row of rows.data.reservations.filter((r: Appointment) => r.attendee_name === tag && r.status === "confirmed")) {
      expect((await owner.rpc("owner_cancel_reservation", { p_request_key: randomUUID(), p_reservation: row.id })).error).toBeNull();
    }
    await owner.auth.signOut({ scope: "local" });
  }
});
