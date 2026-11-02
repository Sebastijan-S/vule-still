import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const RESEND_SECONDS = 60;
export const CHALLENGE_SECONDS = 600;
export type Challenge = { email: string; sentAt: number };
export type AuthState = { step: "email" | "code"; email: string; sentAt?: number; error?: string; message?: string };
export type ProfileState = {
  error?: string;
  errors?: Partial<Record<"first_name" | "last_name" | "phone", string>>;
  values?: { first_name: string; last_name: string; phone: string };
};
export function readText(value: FormDataEntryValue | null): string { return typeof value === "string" ? value.trim() : ""; }
export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}
// Navigation allowlist; never an authorization decision.
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000 || /[\\\x00-\x20]/.test(value)) return "/moji-termini";
  try {
    const url = new URL(value, "https://vule.invalid");
    if (!value.startsWith("/") || value.startsWith("//") || url.origin !== "https://vule.invalid") return "/moji-termini";
    if (!["/", "/moji-termini", "/profil", "/rezervacija", "/raspored"].includes(url.pathname)) return "/moji-termini";
    return url.pathname + url.search + url.hash;
  } catch { return "/moji-termini"; }
}
export function parseChallenge(raw: string | undefined, now = Date.now()): Challenge | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const value = JSON.parse(raw) as Challenge;
    if (!value || typeof value.email !== "string" || !normalizeEmail(value.email) || !Number.isFinite(value.sentAt) || value.sentAt > now || now - value.sentAt >= CHALLENGE_SECONDS * 1000) return null;
    return { email: normalizeEmail(value.email)!, sentAt: value.sentAt };
  } catch { return null; }
}
export function normalizeCode(value: string): string | null {
  const code = value.replace(/\s/g, "");
  // Supabase supports configurable OTP length; Auth verifies the actual code.
  return /^\d{6,10}$/.test(code) ? code : null;
}
export function normalizePhone(value: string): string | null {
  if (value.length > 40 || !/^[+\d\s().-]+$/.test(value)) return null;
  const compact = value.trim().replace(/^00/, "+");
  if (!compact.startsWith("+") && !compact.startsWith("0")) return null;
  const phone = parsePhoneNumberFromString(compact, "RS");
  return phone?.isValid() ? phone.number : null;
}
export function validName(value: string): boolean { return value.trim().length > 0 && value.length <= 80 && !/[\x00-\x1f\x7f]/.test(value); }
export function profileComplete(profile: { first_name: string | null; last_name: string | null; phone: string | null } | null): boolean { return !!(profile?.first_name && profile.last_name && profile.phone); }
export function authErrorMessage(error: { code?: string; status?: number }, verifying = false): string {
  if (error.code === "over_email_send_rate_limit") return "Dostignut je limit slanja imejlova za ceo sajt. Pokušaj kasnije; novo slanje odmah neće uspeti.";
  if (error.status === 429 || error.code === "over_request_rate_limit") return "Previše pokušaja. Sačekaj malo, pa pokušaj ponovo.";
  if (["email_address_invalid", "validation_failed"].includes(error.code ?? "")) return "Proveri da li je imejl adresa ispravno uneta.";
  if (error.code === "email_address_not_authorized") return "Slanje kodova još nije dostupno za ovu adresu. Pokušaj kasnije.";
  if (verifying && ["otp_expired", "otp_disabled", "invalid_credentials"].includes(error.code ?? "")) return "Kod nije ispravan ili je istekao. Proveri poslednji imejl ili zatraži novi kod.";
  return verifying ? "Provera koda trenutno nije uspela. Pokušaj ponovo." : "Trenutno ne možemo da pošaljemo kod. Pokušaj ponovo malo kasnije.";
}
