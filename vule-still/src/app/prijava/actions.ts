"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CHALLENGE_COOKIE, getChallenge } from "@/lib/auth/session";
import { ensureSessionAccess } from "@/lib/auth/activity";
import { authErrorMessage, CHALLENGE_SECONDS, normalizeCode, normalizeEmail, profileComplete, readText, RESEND_SECONDS, safeReturnTo, type AuthState } from "@/lib/auth/validation";

export async function authenticate(previous: AuthState, form: FormData): Promise<AuthState> {
  const intent = readText(form.get("intent"));
  const next = safeReturnTo(form.get("next"));
  const challenge = await getChallenge();
  const initial: AuthState = { step: "email", email: readText(form.get("email")) || previous.email };
  const pending: AuthState = challenge ? { step: "code", ...challenge } : { ...initial, error: "Kod je istekao ili više nije dostupan. Zatraži novi kod." };
  if (intent === "change") {
    (await cookies()).delete(CHALLENGE_COOKIE);
    return { step: "email", email: challenge?.email ?? previous.email };
  }
  if (intent === "send" || intent === "resend") {
    const email = intent === "resend" ? normalizeEmail(challenge?.email ?? previous.email) : normalizeEmail(initial.email);
    if (!email) return { ...initial, error: "Unesi ispravnu imejl adresu." };
    // Cookie throttling is UX only. Supabase independently enforces its limits.
    if (challenge?.email === email && Date.now() - challenge.sentAt < RESEND_SECONDS * 1000) return { ...pending, error: "Sačekaj 60 sekundi između dva slanja koda." };
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) return { ...(intent === "resend" ? pending : initial), error: authErrorMessage(error) };
    } catch { return { ...(intent === "resend" ? pending : initial), error: authErrorMessage({}) }; }
    const sentAt = Date.now();
    (await cookies()).set(CHALLENGE_COOKIE, JSON.stringify({ email, sentAt }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: CHALLENGE_SECONDS,
    });
    return { step: "code", email, sentAt, message: intent === "resend" ? "Novi kod je poslat. Proveri i neželjenu poštu." : undefined };
  }
  if (intent !== "verify" || !challenge) return pending;
  const token = normalizeCode(readText(form.get("code")));
  if (!token) return { ...pending, error: "Unesi ceo brojčani kod iz imejla." };
  let userId: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: challenge.email, token, type: "email" });
    if (error) return { ...pending, error: authErrorMessage(error, true) };
    if (!data.session || !data.user?.email_confirmed_at) return { ...pending, error: "Prijava nije potvrđena. Zatraži novi kod." };
    userId = data.user.id;
  } catch { return { ...pending, error: authErrorMessage({}, true) }; }
  if (!await ensureSessionAccess()) return { ...pending, error: "Pristup nalogu nije uspostavljen. Zatraži novi kod." };
  // A verified session already exists. If the profile read fails, send the
  // customer to the protected profile page rather than showing a code error.
  let destination = `/profil?next=${encodeURIComponent(next)}`;
  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase.from("profiles").select("first_name,last_name,phone").eq("id", userId).maybeSingle();
    if (!error && profileComplete(profile)) destination = next;
  } catch { /* The protected profile page will surface a data error. */ }
  (await cookies()).delete(CHALLENGE_COOKIE);
  revalidatePath("/", "layout");
  redirect(destination);
}
export async function logout(): Promise<{ error: string } | never> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Odjava nije uspela. Proveri vezu i pokušaj ponovo." };
  } catch { return { error: "Odjava nije uspela. Proveri vezu i pokušaj ponovo." }; }
  (await cookies()).delete(CHALLENGE_COOKIE);
  revalidatePath("/", "layout");
  redirect("/prijava?odjava=1");
}
