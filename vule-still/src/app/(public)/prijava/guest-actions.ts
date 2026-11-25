"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureSessionAccess } from "@/lib/auth/activity";
import { accountReturnTo } from "@/lib/auth/navigation";
import { normalizeContact, profileComplete, readText } from "@/lib/auth/validation";

export type GuestState = { contact?: string; error?: string };
export async function enterAsGuest(_previous: GuestState, form: FormData): Promise<GuestState> {
  const contact = readText(form.get("contact"));
  const normalized = normalizeContact(contact);
  if (!normalized) return { contact, error: "Unesi ispravan broj telefona ili mejl adresu." };
  let destination: string;
  try {
    const db = await createClient();
    const current = await db.auth.getUser();
    let user = current.data.user;
    // Reuse the session after failed saves/double submits. Never look up a user by contact.
    if (!user || (!user.is_anonymous && !user.email_confirmed_at) || !await ensureSessionAccess()) {
      const { data, error } = await db.auth.signInAnonymously();
      if (error || !data.user || !data.session) return { contact, error: error?.status === 429 ? "Previše pokušaja. Sačekaj malo i pokušaj ponovo." : "Ulazak trenutno nije dostupan. Pokušaj ponovo malo kasnije." };
      user = data.user;
    }
    if (!await ensureSessionAccess()) return { contact, error: "Ulazak nije uspeo. Pokušaj ponovo." };
    const { data: profile, error } = await db.from("profiles").update(normalized).eq("id", user.id)
      .select("first_name,last_name,phone,contact_email").single();
    if (error || !profile) return { contact, error: "Kontakt nije sačuvan. Pokušaj ponovo." };
    const next = await accountReturnTo(form.get("next"), user.id);
    destination = profileComplete(profile) ? next : `/profil?next=${encodeURIComponent(next)}`;
  } catch { return { contact, error: "Veza je prekinuta. Pokušaj ponovo." }; }
  revalidatePath("/", "layout");
  redirect(destination);
}
