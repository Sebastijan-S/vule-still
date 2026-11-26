import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment } from "./supabase/environment";
import type { Database } from "@/types/database";

function catalogueClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function publicServices() {
  try {
    const result = await catalogueClient().from("services").select("slug,name,category,duration_minutes,sort_order")
      .eq("is_active", true).order("sort_order").abortSignal(AbortSignal.timeout(15000));
    return result.error ? null : result.data;
  } catch { return null; }
}

export async function publicLocations() {
  try {
    const result = await catalogueClient().from("locations").select("slug,name,address,phone,sort_order,booking_enabled")
      .eq("is_active", true).order("sort_order").abortSignal(AbortSignal.timeout(15000));
    return result.error ? null : result.data;
  } catch { return null; }
}
