import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseChallenge, safeReturnTo } from "./validation";
import { ensureSessionAccess } from "./activity";

export const CHALLENGE_COOKIE = "vule-auth-challenge";
export async function getChallenge() {
  await connection();
  return parseChallenge((await cookies()).get(CHALLENGE_COOKIE)?.value);
}
// React cache deduplicates within a render, never across user requests.
export const getCurrentUser = cache(async () => {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new Error("Provera prijave trenutno nije dostupna.");
  if (error || !data.user?.email_confirmed_at) return null;
  if (!await ensureSessionAccess()) return null;
  return data.user;
});
export async function requireUser(next = "/profil") {
  const user = await getCurrentUser();
  if (!user) redirect(`/prijava?next=${encodeURIComponent(safeReturnTo(next))}`);
  return user;
}
