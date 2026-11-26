import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

test.beforeEach(() => {
  if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local").hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") throw new Error("Only Vule-still-test may run these Auth checks");
});

test("customer sign-in and old profile return never redirect into owner administration", async ({ page }) => {
  const { customer } = JSON.parse(await readFile(".env.phase6-state.local", "utf8"));
  if (!/^vule-phase6-customer-.+@example\.invalid$/.test(customer.email)) throw new Error("Synthetic customer required");
  await page.goto("/administrator?next=%2Fraspored%3Fweek%3D2026-11-02");
  await page.getByLabel("Imejl adresa").fill(customer.email);
  await page.getByLabel("Lozinka", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Prijavi se", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Administracija je dostupna samo vlasniku.", exact: true })).toBeVisible();
  await page.goto("/profil?next=%2Fraspored");
  await expect(page.locator('.profile-form input[name="next"]')).toHaveValue("/moji-termini");
  await page.goto("/prijava?next=%2Fraspored");
  await page.waitForURL(path => path.pathname === "/moji-termini");
  await page.goto("/raspored");
  await expect(page.getByRole("heading", { name: "Raspored je dostupan samo vlasniku.", exact: true })).toBeVisible();
  await expect(page.locator(".location-calendar")).toHaveCount(0);
  await page.getByRole("link", { name: "Moji termini", exact: true }).last().click();
  await page.waitForURL(path => path.pathname === "/moji-termini");
});

test("new guest from schedule request completes the customer journey without owner access", async ({ page }) => {
  // One visibly synthetic account remains in the disposable project per run.
  // Guest entry requests neither email delivery nor confirmation codes.
  const email = `vule-navigation-${randomUUID()}@example.invalid`;
  await page.goto("/prijava?next=%2Fraspored");
  await page.getByLabel("Broj telefona ili mejl", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Nastavi", exact: true }).click();
  await page.waitForURL(path => path.pathname === "/profil");
  expect(new URL(page.url()).searchParams.get("next")).toBe("/moji-termini");
  await page.getByLabel("Ime", { exact: true }).fill("Test");
  await page.getByLabel("Prezime", { exact: true }).fill("Navigacija");
  await page.getByLabel("Broj telefona", { exact: true }).fill("+381641234567");
  await page.getByRole("button", { name: "Sačuvaj i nastavi", exact: true }).click();
  await page.waitForURL(path => path.pathname === "/moji-termini");
  await expect(page.getByRole("heading", { name: "Naredni dolazak", exact: true })).toBeVisible();
  await page.goto("/raspored");
  await expect(page.getByRole("heading", { name: "Raspored je dostupan samo vlasniku.", exact: true })).toBeVisible();
  await expect(page.locator(".location-calendar")).toHaveCount(0);
});
