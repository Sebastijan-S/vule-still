"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnvironment } from "@/lib/supabase/environment";
import { passwordTestMode } from "@/lib/auth/mode";
import { ensureSessionAccess } from "@/lib/auth/activity";
import { normalizeEmail, profileComplete, readText } from "@/lib/auth/validation";
import { accountReturnTo } from "@/lib/auth/navigation";

export type PasswordState = { error?: string; message?: string; email?: string };

export async function authenticatePassword(_previous: PasswordState, form: FormData): Promise<PasswordState> {
  if (!passwordTestMode()) return { error: "Ovaj način prijave nije dostupan." };
  const email = normalizeEmail(readText(form.get("email")));
  const password = form.get("password");
  const intent = readText(form.get("intent"));
  if (!email) return { error: "Unesi ispravnu imejl adresu." };
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { email, error: "Lozinka mora imati najmanje 12 znakova." };
  }
  if (intent !== "signup" && intent !== "signin") return { email, error: "Izaberi prijavu ili registraciju." };

  const supabase = await createClient();
  if (intent === "signup") {
    // Do not accidentally request a confirmation email while this test mode
    // promises a no-email flow. This setting is allowed only on the test project.
    const { url, publishableKey } = getSupabaseEnvironment();
    let withoutEmail = false;
    try {
      const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey }, cache: "no-store" });
      withoutEmail = response.ok && (await response.json()).mailer_autoconfirm === true;
    } catch { /* Fail closed when provider settings cannot be checked. */ }
    if (!withoutEmail) {
      return { email, error: "Test projekat još zahteva potvrdu mejla. Registracija bez slanja nije dostupna." };
    }
  }
  const result = intent === "signup"
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) {
    if (result.error.status === 429) return { email, error: "Previše pokušaja. Pokušaj kasnije." };
    return { email, error: intent === "signin" ? "Imejl ili lozinka nisu ispravni." : "Registracija nije uspela. Pokušaj drugu adresu ili se prijavi." };
  }
  if (!result.data.session || !result.data.user) {
    return { email, error: "Sesija nije uspostavljena. Proveri podešavanja test projekta." };
  }
  if (!await ensureSessionAccess()) return { email, error: "Pristup nalogu je istekao. Prijavi se ponovo." };
  const next = await accountReturnTo(form.get("next"), result.data.user.id);
  // Owner administration has its own membership gate and needs no customer
  // booking profile. Navigation to this route never grants owner permissions.
  let destination = new URL(next, "https://vule.invalid").pathname === "/raspored" ? next : `/profil?next=${encodeURIComponent(next)}`;
  const { data: profile, error } = await supabase.from("profiles").select("first_name,last_name,phone").eq("id", result.data.user.id).maybeSingle();
  if (!error && profileComplete(profile)) destination = next;
  revalidatePath("/", "layout");
  redirect(destination);
}
