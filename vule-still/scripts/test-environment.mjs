// Start/build only the disposable environment; never silently use .env.local.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const mode = process.argv[2] ?? "dev";
if (!["dev", "build", "start"].includes(mode)) throw new Error("Use dev, build or start");
process.loadEnvFile(fileURLToPath(new URL("../.env.test.local", import.meta.url)));
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local").hostname !== "xfbjgxtgvlyndonhlupm.supabase.co" || process.env.VULE_AUTH_MODE !== "password-test" || process.env.VULE_PHASE3_ACCESS !== "1") {
  throw new Error("Expected Vule-still-test and explicit temporary Auth/access flags");
}
process.env.VULE_BUILD_DIR = mode === "dev" ? ".next-test" : ".next-phase6-build";
console.log(`Vule-still-test: ${mode}; temporary password Auth, no email`);
const args = [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), mode];
if (mode !== "build") args.push("--hostname", "127.0.0.1", "--port", "3100");
const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env, windowsHide: true });
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code ?? 1; });
