import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

// Read-only smoke test. It never signs up users, sends email or inserts data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url, "NEXT_PUBLIC_SUPABASE_URL is missing");
assert.ok(key?.startsWith("sb_publishable_"), "A publishable key is required");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const [locations, services, profiles, memberships, staff, internalHelper] = await Promise.all([
  supabase.from("locations").select("slug,name").order("sort_order"),
  supabase.from("services").select("slug,name,category,duration_minutes").order("sort_order"),
  supabase.from("profiles").select("id").limit(1),
  supabase.from("admin_memberships").select("user_id").limit(1),
  supabase.from("staff").select("id").limit(1),
  supabase.schema("app_private").rpc("is_admin"),
]);

assert.equal(locations.error, null, locations.error?.message);
assert.equal(services.error, null, services.error?.message);
assert.ok(Array.isArray(locations.data));
assert.ok(Array.isArray(services.data));
assert.ok(services.data.every((service) => service.duration_minutes > 0 && service.duration_minutes % 10 === 0));
for (const [name, result] of [["profiles", profiles], ["admin_memberships", memberships], ["staff", staff]]) {
  assert.equal(result.error?.code, "42501", `${name} must reject anonymous reads`);
  assert.equal(result.data, null);
}
assert.ok(["PGRST106", "42501"].includes(internalHelper.error?.code), "app_private must not be exposed in the Data API");

console.log(JSON.stringify({
  result: "PASS",
  project: new URL(url).hostname,
  activeLocations: locations.data.length,
  activeServices: services.data.length,
  privateTables: "anonymous access denied",
  internalSchema: "not exposed",
  writesPerformed: 0,
}, null, 2));
