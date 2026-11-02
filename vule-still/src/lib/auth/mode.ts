import "server-only";

export function passwordTestMode(): boolean {
  if (process.env.VULE_AUTH_MODE !== "password-test") return false;
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local").hostname;
  if (hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") {
    throw new Error("Password test mode is restricted to Vule-still-test.");
  }
  return true;
}
