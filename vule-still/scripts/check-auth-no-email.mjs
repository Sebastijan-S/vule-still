import assert from "node:assert/strict";

// Phase 2: live checks that neither request email nor create an Auth user.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "xfbjgxtgvlyndonhlupm.supabase.co", "Use only Vule-still-test");
assert.ok(key?.startsWith("sb_publishable_"), "A publishable key is required");

const headers = { apikey: key, "Content-Type": "application/json" };
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers });
assert.equal(settingsResponse.status, 200);
const settings = await settingsResponse.json();
assert.equal(settings.external?.email, true, "Email Auth must be enabled");
assert.equal(typeof settings.mailer_autoconfirm, "boolean", "Email confirmation setting must be visible");

const userResponse = await fetch(`${url}/auth/v1/user`, { headers });
assert.equal(userResponse.status, 401, "Anonymous caller must not receive an Auth user");

const invalidTokenResponse = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
  headers: { ...headers, Authorization: "Bearer invalid-test-token" },
});
assert.equal(invalidTokenResponse.status, 401, "Invalid bearer token must not read profiles");

console.log(JSON.stringify({
  result: "PASS",
  project: new URL(url).hostname,
  emailProvider: "enabled",
  emailConfirmation: settings.mailer_autoconfirm ? "disabled for temporary password testing" : "required",
  anonymousAuthUser: "denied",
  invalidBearerProfileRead: "denied",
  emailRequests: 0,
  userCreations: 0,
}, null, 2));
