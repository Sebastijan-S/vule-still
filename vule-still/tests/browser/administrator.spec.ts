import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
type Shift = { date: string; location_id: string; start_minute: number; end_minute: number; breaks: { start_minute: number; end_minute: number }[] };
type Week = { draft: Shift[]; draft_revision: number; published: Shift[]; published_revision: number; travel_gap_minutes: number; published_gap_minutes: number };
type Entry = Omit<Shift, "date"> & { weekday: number };
type Template = { entries: Entry[]; revision: number; travel_gap_minutes: number };
type Row = { id: string; attendee_name: string; status: string; starts_at: string; version: number };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const add = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = (date: string) => add(date, -(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7);
async function fixtures() {
  expect(new URL(url).hostname).toBe("xfbjgxtgvlyndonhlupm.supabase.co");
  const f = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  expect(f.owner.email).toMatch(/^vule-phase6-owner-.+@example\.invalid$/);
  expect(f.customer.email).toMatch(/^vule-phase6-customer-.+@example\.invalid$/);
  return f;
}
async function login(page: Page, account: { email: string; password: string }, path = "/administrator") {
  await page.goto(path); await page.getByLabel("Imejl adresa").fill(account.email); await page.getByLabel("Lozinka", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
}
async function client(account: { email: string; password: string }) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  expect((await db.auth.signInWithPassword(account)).error).toBeNull(); expect((await db.rpc("ensure_session_access")).data).toBe(true); return db;
}
async function rpc<T>(db: SupabaseClient, name: string, args = {}): Promise<T> {
  const result = await db.rpc(name, args); expect(result.error, name).toBeNull(); return result.data as T;
}
async function noPublicNavigation(page: Page) {
  await expect(page.locator(".site-header,.site-footer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^(Usluge|Lokacije|Moji termini|Rezerviši termin)$/ })).toHaveCount(0);
}

test("separate entry, owner redirects, customer denial and isolated navigation on phone/desktop", async ({ page }) => {
  const f = await fixtures();
  await page.goto("/"); await expect(page.locator('a[href="/administrator"]')).toHaveCount(0);
  await page.goto("/raspored"); await page.waitForURL(u => u.pathname === "/administrator");
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await noPublicNavigation(page);
    await expect(page.getByRole("heading", { name: "Prijava vlasnika", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Napravi test nalog" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/admin-login-${width}.png`, fullPage: true });
  }
  await login(page, f.customer); await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
  await page.goto("/administrator/sablon"); await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administratorska navigacija" })).toHaveCount(0);
  const ordinary = await client(f.customer);
  try {
    expect((await ordinary.rpc("get_owner_schedule_template")).error?.code).toBe("42501");
    expect((await ordinary.rpc("save_owner_schedule_template", { p_expected_revision: 0, p_entries: [], p_gap: 60 })).error?.code).toBe("42501");
    expect((await page.request.get(`/api/owner/reservations?from=${today()}&to=${today()}`)).status()).toBe(403);
    expect((await page.request.post("/api/owner/reservations", { headers: { origin: "http://127.0.0.1:3100" }, data: { operation: "cancel", request_key: randomUUID(), reservation: randomUUID() } })).status()).toBe(403);
  } finally { await ordinary.auth.signOut({ scope: "local" }); }
  await page.getByRole("button", { name: "Odjavi se", exact: true }).click(); await page.waitForURL(u => u.pathname === "/administrator");
  await login(page, f.owner, "/administrator?next=%2Fraspored"); await page.waitForURL(u => u.pathname === "/raspored");
  await page.goto("/administrator"); await page.waitForURL(u => u.pathname === "/administracija");
  for (const path of ["/administracija", "/raspored", "/administrator/sablon"]) {
    await page.goto(path); await expect(page.getByRole("navigation", { name: "Administratorska navigacija" })).toBeVisible();
    if (path === "/administracija") await expect(page.getByRole("button", { name: "Dodaj ručni termin", exact: true })).toBeVisible();
    if (path === "/raspored") await expect(page.getByRole("heading", { name: "Zrenjanin", exact: true })).toBeVisible();
    if (path === "/administrator/sablon") await expect(page.getByRole("heading", { name: "Uobičajena nedelja.", exact: true })).toBeVisible();
    for (const width of [360, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 }); await noPublicNavigation(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/admin-${path.split("/").pop()}-${width}.png`, fullPage: true });
    }
  }
  await page.getByRole("button", { name: "Odjavi se", exact: true }).click(); await page.waitForURL(u => u.pathname === "/administrator"); await page.reload();
  await expect(page.getByRole("heading", { name: "Prijava vlasnika", exact: true })).toBeVisible();
});

test("owner moves a linked reservation to another day; occupied-slot failure retains original and notices persist", async ({ page }) => {
  test.setTimeout(120000); page.setDefaultTimeout(15000);
  const f = await fixtures(), owner = await client(f.owner), customer = await client(f.customer);
  const tag = `Admin10 ${randomUUID().slice(0, 8)}`, from = add(today(), 1), to = add(from, 1);
  const locations = (await owner.from("locations").select("id,slug")).data ?? [], services = (await owner.from("services").select("id,name,duration_minutes")).data ?? [];
  const location = locations.find(l => l.slug === "zrenjanin")!, service = services.find(s => s.duration_minutes === 20)!;
  const availability = async (date: string) => (await (await page.request.get(`/api/availability?date=${date}&location=${location.id}&service=${service.id}`)).json()) as { slots: { start: string }[]; schedule_revision: number };
  let id = "";
  try {
    await login(page, f.owner); await page.waitForURL(u => u.pathname === "/administracija");
    const first = await availability(from); expect(first.slots.length).toBeGreaterThan(1);
    const made = await rpc<Row>(customer, "confirm_reservation", { p_request_key: randomUUID(), p_location: location.id, p_service: service.id, p_start: first.slots[0].start, p_expected_revision: first.schedule_revision, p_attendee: tag }); id = made.id;
    await page.getByLabel("Datum pregleda", { exact: true }).fill(from); const card = page.locator(`[data-reservation="${id}"]`); await expect(card).toContainText(tag);
    await card.getByRole("button", { name: "Izmeni termin", exact: true }).click(); await page.getByLabel("Datum rezervacije", { exact: true }).fill(to);
    await expect(page.locator(".owner-form .slot-options button").first()).toBeVisible();
    const candidate = await availability(to); expect(candidate.slots.length).toBeGreaterThan(2);
    await page.locator(".owner-form .slot-options button").first().click();
    const blocker = await rpc<Row>(owner, "owner_create_reservation", { p_request_key: randomUUID(), p_location: location.id, p_service: service.id, p_start: candidate.slots[0].start, p_expected_revision: candidate.schedule_revision, p_name: `${tag} blocker`, p_expected_name: service.name, p_expected_duration: service.duration_minutes });
    await page.getByRole("button", { name: "Sačuvaj izmenu", exact: true }).click(); await expect(page.locator('.form-error[role="alert"]')).toContainText("zauzet");
    const before = await rpc<{ reservations: Row[] }>(owner, "get_owner_reservations", { p_from: from, p_to: to });
    const unchanged = before.reservations.find(r => r.id === id)!; expect(unchanged.version).toBe(1); expect(Date.parse(unchanged.starts_at)).toBe(Date.parse(first.slots[0].start));
    const noticeBefore = (await customer.from("booking_notifications").select("id,kind").eq("reservation_id", id)).data!; expect(noticeBefore).toHaveLength(1);
    await rpc(owner, "owner_cancel_reservation", { p_request_key: randomUUID(), p_reservation: blocker.id });
    await page.getByRole("button", { name: "Osveži slobodne termine", exact: true }).click(); await expect(page.locator(".owner-form .slot-options button").nth(1)).toBeVisible();
    await page.locator(".owner-form .slot-options button").nth(1).click(); await page.getByRole("button", { name: "Sačuvaj izmenu", exact: true }).click(); await expect(page.locator(".form-success")).toHaveText("Izmena je sačuvana.");
    await expect(page.getByLabel("Datum pregleda", { exact: true })).toHaveValue(to);
    const after = await rpc<{ reservations: Row[] }>(owner, "get_owner_reservations", { p_from: from, p_to: to }); expect(after.reservations.find(r => r.id === id)?.version).toBe(2);
    const noticeAfter = (await customer.from("booking_notifications").select("id,kind").eq("reservation_id", id)).data!; expect(noticeAfter.filter(n => n.kind === "changed")).toHaveLength(1);
    await page.getByRole("combobox", { name: "Prikaz", exact: true }).selectOption("week"); await expect(card).toBeVisible();
    await page.getByRole("combobox", { name: "Filter statusa", exact: true }).selectOption("cancelled"); await expect(card).toHaveCount(0); await page.getByRole("combobox", { name: "Filter statusa", exact: true }).selectOption("confirmed");
    page.once("dialog", d => d.dismiss()); await card.getByRole("button", { name: "Otkaži termin", exact: true }).click(); await expect(card).toContainText("Potvrđena");
    page.once("dialog", d => d.accept()); await card.getByRole("button", { name: "Otkaži termin", exact: true }).click(); await expect(card).toContainText("Otkazana");
    const notices = (await customer.from("booking_notifications").select("id,kind").eq("reservation_id", id)).data!; expect(notices).toHaveLength(3);
    await page.getByRole("button", { name: "Odjavi se", exact: true }).click(); await page.waitForURL(u => u.pathname === "/administrator");
    await login(page, f.customer, "/prijava"); await page.waitForURL(u => ["/moji-termini", "/profil"].includes(u.pathname)); await page.goto("/moji-termini"); await page.reload();
    await expect(page.locator(`[data-reservation="${id}"]`)).toContainText("Otkazana");
    const app = await (await page.request.get("/api/reservations")).json(); expect(app.notifications.filter((n: { reservation_id: string }) => n.reservation_id === id)).toHaveLength(3);
  } finally {
    const rows = await rpc<{ reservations: Row[] }>(owner, "get_owner_reservations", { p_from: from, p_to: to });
    for (const row of rows.reservations.filter(r => r.attendee_name.startsWith(tag) && r.status === "confirmed")) await rpc(owner, "owner_cancel_reservation", { p_request_key: randomUUID(), p_reservation: row.id });
    await owner.auth.signOut({ scope: "local" }); await customer.auth.signOut({ scope: "local" });
  }
});

test("template edit persists without replacing weeks; concrete Sunday opens/closes and original schedule is restored", async ({ page }) => {
  test.setTimeout(120000); page.setDefaultTimeout(15000);
  const f = await fixtures(), db = await client(f.owner), week = monday(today());
  const original = await rpc<Week>(db, "get_owner_schedule", { p_week: week }), template = await rpc<Template>(db, "get_owner_schedule_template");
  let savedTemplate: Template | null = null, touchedWeek: Week | null = null;
  try {
    await login(page, f.owner); await page.waitForURL(u => u.pathname === "/administracija");
    await page.getByRole("link", { name: "Uobičajena nedelja", exact: true }).click();
    await page.getByRole("button", { name: "Dodaj uobičajenu smenu — Zrenjanin, Nedelja", exact: true }).click();
    await page.getByLabel("Početak smene", { exact: true }).fill("10:00"); await page.getByLabel("Kraj smene", { exact: true }).fill("12:00");
    await page.getByRole("button", { name: "+ Dodaj pauzu", exact: true }).click(); await page.getByLabel("Pauza 1 od", { exact: true }).fill("11:00"); await page.getByLabel("Pauza 1 do", { exact: true }).fill("11:20");
    await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click(); await page.getByRole("button", { name: "Sačuvaj uobičajenu nedelju", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Postojeći nacrti i objavljene nedelje nisu promenjeni");
    savedTemplate = await rpc<Template>(db, "get_owner_schedule_template"); expect(savedTemplate.entries.find(e => e.weekday === 7)?.breaks).toHaveLength(1);
    expect(await rpc<Week>(db, "get_owner_schedule", { p_week: week })).toEqual(original);
    await page.reload(); await expect(page.getByRole("button", { name: "Izmeni uobičajenu smenu — Zrenjanin, Nedelja", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Radno vreme", exact: true }).click();
    await page.getByRole("button", { name: "Dodaj smenu — Zrenjanin, Nedelja", exact: true }).click(); await page.getByLabel("Kraj smene", { exact: true }).fill("12:00");
    await page.getByRole("button", { name: "+ Dodaj pauzu", exact: true }).click(); await page.getByLabel("Pauza 1 od", { exact: true }).fill("11:00"); await page.getByLabel("Pauza 1 do", { exact: true }).fill("11:20");
    await page.getByRole("button", { name: "Primeni u nacrtu", exact: true }).click(); await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Nacrt je sačuvan" })).toBeVisible();
    touchedWeek = await rpc<Week>(db, "get_owner_schedule", { p_week: week }); expect(touchedWeek.published).toEqual(original.published);
    await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Raspored je objavljen" })).toBeVisible();
    touchedWeek = await rpc<Week>(db, "get_owner_schedule", { p_week: week });
    const sunday = add(week, 6), location = template.entries[0].location_id, service = (await db.from("services").select("id").eq("duration_minutes", 20).limit(1)).data![0].id;
    const available = await (await page.request.get(`/api/availability?date=${sunday}&location=${location}&service=${service}`)).json(); expect(available.slots.length).toBe(5); expect(available.slots.some((s: { local_start: string }) => s.local_start === "11:00")).toBe(false);
    await page.getByRole("button", { name: /^Zrenjanin, Nedelja 10:00/ }).click(); await page.getByRole("button", { name: "Ukloni smenu", exact: true }).click();
    await page.getByRole("button", { name: "Sačuvaj nacrt", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Nacrt je sačuvan" })).toBeVisible();
    touchedWeek = await rpc<Week>(db, "get_owner_schedule", { p_week: week });
    await page.getByRole("button", { name: "Objavi nedelju", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Raspored je objavljen" })).toBeVisible();
    touchedWeek = await rpc<Week>(db, "get_owner_schedule", { p_week: week });
    expect((await (await page.request.get(`/api/availability?date=${sunday}&location=${location}&service=${service}`)).json()).reason).toBe("closed");
  } finally {
    if (touchedWeek) {
      const current = await rpc<Week>(db, "get_owner_schedule", { p_week: week }); expect(current.draft_revision).toBe(touchedWeek.draft_revision); expect(current.published_revision).toBe(touchedWeek.published_revision);
      // Restore each independent snapshot using only known test changes.
      let revision = await rpc<number>(db, "save_schedule_draft", { p_week: week, p_expected_revision: current.draft_revision, p_entries: original.published, p_gap: original.published_gap_minutes });
      await rpc(db, "publish_schedule_week", { p_week: week, p_expected_revision: revision });
      revision = await rpc<number>(db, "save_schedule_draft", { p_week: week, p_expected_revision: revision, p_entries: original.draft, p_gap: original.travel_gap_minutes });
      const after = await rpc<Week>(db, "get_owner_schedule", { p_week: week }); expect(after.draft).toEqual(original.draft); expect(after.published).toEqual(original.published); expect(after.draft_revision).toBe(revision);
    }
    if (savedTemplate) {
      const current = await rpc<Template>(db, "get_owner_schedule_template"); expect(current).toEqual(savedTemplate);
      const restored = await rpc<Template>(db, "save_owner_schedule_template", { p_expected_revision: current.revision, p_entries: template.entries, p_gap: template.travel_gap_minutes }); expect(restored.entries).toEqual(template.entries);
    }
    await db.auth.signOut({ scope: "local" });
  }
});
