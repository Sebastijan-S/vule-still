import "server-only";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "./validation";
import { isOwnerDestination } from "./owner-paths";

// A syntactically safe return URL may still target an owner-only screen.
// Resolve it only after authentication, using the current account's RLS read.
export async function accountReturnTo(value: unknown, userId: string): Promise<string> {
  const next = safeReturnTo(value);
  if (!isOwnerDestination(next)) return next;
  const db = await createClient();
  const { data, error } = await db.from("admin_memberships").select("user_id")
    .eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Provera pristupa rasporedu trenutno nije dostupna.");
  return data ? next : "/moji-termini";
}
