import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Creates two visibly synthetic users in Vule-still-test. Run manually, not in CI.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "xfbjgxtgvlyndonhlupm.supabase.co");
assert.ok(key?.startsWith("sb_publishable_"));
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
assert.equal(settingsResponse.status, 200);
assert.equal((await settingsResponse.json()).mailer_autoconfirm, true, "Temporary no-email test mode required");

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const secret = () => randomBytes(24).toString("base64url") + "Aa1!";
const suffix = randomBytes(8).toString("hex");
const emailA = `vule-phase3-a-${suffix}@example.invalid`;
const emailB = `vule-phase3-b-${suffix}@example.invalid`;
const passwordA = secret();
const passwordB = secret();
const phone = client();
const desktop = client();
const other = client();
const signupA = await phone.auth.signUp({ email: emailA, password: passwordA, options: { data: { role: "admin" } } });
assert.equal(signupA.error, null, signupA.error?.message);
assert.ok(signupA.data.session, "Password signup must establish a real session");
const signupB = await other.auth.signUp({ email: emailB, password: passwordB });
assert.equal(signupB.error, null, signupB.error?.message);
assert.ok(signupB.data.session);
const userA = signupA.data.user.id;
const userB = signupB.data.user.id;

const loginDesktop = await desktop.auth.signInWithPassword({ email: emailA, password: passwordA });
assert.equal(loginDesktop.error, null, loginDesktop.error?.message);
assert.ok(loginDesktop.data.session);
const payload = token => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const phoneSessionId = payload(signupA.data.session.access_token).session_id;
const desktopSessionId = payload(loginDesktop.data.session.access_token).session_id;
assert.match(phoneSessionId, /^[0-9a-f-]{36}$/);
assert.match(desktopSessionId, /^[0-9a-f-]{36}$/);
assert.notEqual(phoneSessionId, desktopSessionId, "Two logins must have distinct session IDs");
for (const sessionClient of [phone, desktop, other]) {
  const access = await sessionClient.rpc("ensure_session_access");
  assert.equal(access.error, null, access.error?.message);
  assert.equal(access.data, true, "Fresh signed session must register for private access");
}

const own = await phone.from("profiles").select("id,first_name").eq("id", userA).single();
assert.equal(own.error, null, own.error?.message);
assert.equal(own.data.id, userA, "Auth trigger must create the private profile");
const update = await phone.from("profiles").update({ first_name: "Test" }).eq("id", userA).select("id,first_name").single();
assert.equal(update.error, null, update.error?.message);
assert.equal(update.data.first_name, "Test");
const otherProfile = await phone.from("profiles").select("id").eq("id", userB);
assert.equal(otherProfile.error, null, otherProfile.error?.message);
assert.equal(otherProfile.data.length, 0, "RLS must hide another user's profile");
const memberships = await phone.from("admin_memberships").select("user_id");
assert.equal(memberships.error, null, memberships.error?.message);
assert.equal(memberships.data.length, 0, "Forged user metadata must not grant admin membership");
const staff = await phone.from("staff").select("id");
assert.equal(staff.error, null, staff.error?.message);
assert.equal(staff.data.length, 0, "Ordinary user must not read admin-only staff");
const roleWrite = await phone.from("admin_memberships").insert({ singleton: true, user_id: userA });
assert.ok(roleWrite.error, "Ordinary user must not assign admin role");

const refreshed = await phone.auth.refreshSession();
assert.equal(refreshed.error, null, refreshed.error?.message);
assert.equal(payload(refreshed.data.session.access_token).session_id, phoneSessionId, "Refresh keeps the session identity");
const localLogout = await phone.auth.signOut({ scope: "local" });
assert.equal(localLogout.error, null, localLogout.error?.message);
assert.equal((await phone.auth.getSession()).data.session, null);
const desktopAfterLogout = await desktop.from("profiles").select("id").eq("id", userA).single();
assert.equal(desktopAfterLogout.error, null, "Other device must remain signed in");

console.log(JSON.stringify({
  result: "PASS",
  project: new URL(url).hostname,
  syntheticUsersCreated: 2,
  emailSent: false,
  independentSessionIds: true,
  profileTrigger: "passed",
  ownProfileUpdate: "passed",
  crossUserProfileRead: "denied",
  forgedAdminMetadataAndRoleWrite: "denied",
  tokenRefreshSessionId: "stable",
  phase3SessionRegistration: "passed",
  localLogout: "other device remained active",
  note: "Synthetic Auth users remain in the temporary project; no credentials or tokens were printed.",
}, null, 2));
