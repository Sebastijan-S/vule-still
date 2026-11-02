import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

// Manually compare the test database's activity timestamp before/after Auth
// refresh. No direct privileged database credential enters this script.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname, "xfbjgxtgvlyndonhlupm.supabase.co");
const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then(r => r.json());
assert.equal(settings.mailer_autoconfirm, true);
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const email = `vule-refresh-${randomBytes(8).toString("hex")}@example.invalid`;
const password = randomBytes(24).toString("base64url") + "Aa1!";
const rl = createInterface({ input: stdin, output: stdout });
try {
  const signup = await client.auth.signUp({ email, password });
  assert.equal(signup.error, null, signup.error?.message);
  assert.ok(signup.data.session);
  const access = await client.rpc("ensure_session_access");
  assert.equal(access.error, null, access.error?.message);
  assert.equal(access.data, true);
  console.log(`BEFORE_REFRESH synthetic_email=${email}`);
  const before = (await rl.question("Paste last_activity_at from test SQL Editor: ")).trim();
  assert.ok(before);
  const refreshed = await client.auth.refreshSession();
  assert.equal(refreshed.error, null, refreshed.error?.message);
  const again = await client.rpc("ensure_session_access");
  assert.equal(again.error, null, again.error?.message);
  assert.equal(again.data, true);
  console.log("AFTER_REFRESH");
  const after = (await rl.question("Paste last_activity_at again from test SQL Editor: ")).trim();
  assert.equal(after, before, "Refresh/repeated access must not count as real activity");
  console.log(JSON.stringify({ result: "PASS", project: new URL(url).hostname, authRefreshSucceeded: true,
    repeatedAccessSucceeded: true, accountActivityTimestampUnchanged: true, syntheticUsersCreated: 1,
    credentialsPrinted: false }));
} finally { rl.close(); }
