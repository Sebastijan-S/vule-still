// Test-process-only transport faults. Never imported by application code.
// Start a separate built test server with NODE_OPTIONS=--import=<this file>.
import { readFile } from "node:fs/promises";

const originalFetch = globalThis.fetch;
const control = process.env.VULE_TEST_FETCH_FAULT_FILE;
if (control) globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (url.hostname === "xfbjgxtgvlyndonhlupm.supabase.co" && process.env.VULE_AUTH_MODE === "password-test") {
    const key = method === "GET" && ["/rest/v1/services", "/rest/v1/locations", "/rest/v1/profiles"].includes(url.pathname)
      ? url.pathname.split("/").at(-1)
      : method === "POST" && url.pathname === "/rest/v1/rpc/get_owner_reservations" ? "owner-reservations" : null;
    if (key) {
      let faults = {};
      try { faults = JSON.parse(await readFile(control, "utf8")); } catch {}
      if (faults.fail?.includes(key)) return Response.json({ message: "Synthetic test transport failure" }, { status: 503 });
    }
  }
  return originalFetch(input, init);
};
