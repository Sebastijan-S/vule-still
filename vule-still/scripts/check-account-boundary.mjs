import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

// Manual two-stage integration test. SQL Editor changes only this synthetic
// user's account_activity timestamp between prompts. Never run on production.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "xfbjgxtgvlyndonhlupm.supabase.co");
const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then(r => r.json());
assert.equal(settings.mailer_autoconfirm, true);
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const email = `vule-boundary-${randomBytes(8).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("base64url") + "Aa1!";
const phone = client();
const desktop = client();
const fresh = client();
const rl = createInterface({ input: stdin, output: stdout });
try {
  const signup = await phone.auth.signUp({ email, password });
  assert.equal(signup.error, null, signup.error?.message);
  assert.ok(signup.data.session);
  const userId = signup.data.user.id;
  const desktopLogin = await desktop.auth.signInWithPassword({ email, password });
  assert.equal(desktopLogin.error, null, desktopLogin.error?.message);
  for (const c of [phone, desktop]) {
    const registered = await c.rpc("ensure_session_access");
    assert.equal(registered.error, null, registered.error?.message);
    assert.equal(registered.data, true);
  }
  console.log(`STAGE_29_READY synthetic_email=${email}`);
  await rl.question("Set last_activity_at to 29 days ago in test SQL Editor, then press Enter here: ");

  const phoneTouch = await phone.rpc("record_user_activity");
  assert.equal(phoneTouch.error, null, phoneTouch.error?.message);
  assert.equal(phoneTouch.data, true);
  const desktopRead = await desktop.from("profiles").select("id").eq("id", userId).single();
  assert.equal(desktopRead.error, null, desktopRead.error?.message);
  const refreshed = await phone.auth.refreshSession();
  assert.equal(refreshed.error, null, refreshed.error?.message);
  console.log("STAGE_30_READY phone_activity_kept_desktop=true; token_refresh_completed=true");
  await rl.question("Set last_activity_at to exactly 30 days ago in test SQL Editor, then press Enter here: ");

  const staleRead = await desktop.from("profiles").select("id").eq("id", userId);
  assert.equal(staleRead.error, null, staleRead.error?.message);
  assert.equal(staleRead.data.length, 0, "Old direct Data API token must be denied");
  const staleTouch = await phone.rpc("record_user_activity");
  assert.equal(staleTouch.error, null, staleTouch.error?.message);
  assert.equal(staleTouch.data, false, "Expired session cannot revive itself");
  const freshLogin = await fresh.auth.signInWithPassword({ email, password });
  assert.equal(freshLogin.error, null, freshLogin.error?.message);
  assert.ok(freshLogin.data.session);
  const freshAccess = await fresh.rpc("ensure_session_access");
  assert.equal(freshAccess.error, null, freshAccess.error?.message);
  assert.equal(freshAccess.data, true);
  const freshRead = await fresh.from("profiles").select("id").eq("id", userId).single();
  assert.equal(freshRead.error, null, freshRead.error?.message);
  const oldAfterLogin = await desktop.from("profiles").select("id").eq("id", userId);
  assert.equal(oldAfterLogin.error, null, oldAfterLogin.error?.message);
  assert.equal(oldAfterLogin.data.length, 0, "New login must not revive old desktop session");
  const oldFreshToken = freshLogin.data.session.access_token;
  const logout = await fresh.auth.signOut({ scope: "local" });
  assert.equal(logout.error, null, logout.error?.message);
  const revoked = createClient(url, key, { global: { headers: { Authorization: `Bearer ${oldFreshToken}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const afterLogout = await revoked.from("profiles").select("id").eq("id", userId);
  assert.equal(afterLogout.error, null, afterLogout.error?.message);
  assert.equal(afterLogout.data.length, 0, "Revoked Auth session must fail direct RLS even with unexpired JWT");
  console.log(JSON.stringify({ result: "PASS", project: new URL(url).hostname, syntheticUsersCreated: 1,
    phoneKeepsDesktopActive: true, exactThirtyDayOldSessionDenied: true, staleDirectTokenDenied: true,
    staleTouchDenied: true, freshLoginWorks: true, oldDesktopStaysDenied: true,
    localLogoutRevokesDirectDataAccess: true, credentialsPrinted: false }));
} finally { rl.close(); }
