import "server-only";
import { createClient } from "@/lib/supabase/server";

export function phase3AccessEnabled(): boolean {
  if (process.env.VULE_PHASE3_ACCESS !== "1") return false;
  const hostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://invalid.local").hostname;
  if (hostname !== "xfbjgxtgvlyndonhlupm.supabase.co") {
    throw new Error("Phase 3 access mode is restricted to Vule-still-test.");
  }
  return true;
}

export async function ensureSessionAccess(): Promise<boolean> {
  if (!phase3AccessEnabled()) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_session_access");
  if (error) throw new Error("Provera pristupa trenutno nije dostupna.");
  return data === true;
}

export async function recordUserActivity(): Promise<boolean> {
  if (!phase3AccessEnabled()) return true;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_user_activity");
  if (error) throw new Error("Beleženje aktivnosti trenutno nije dostupno.");
  return data === true;
}
