"use client";
import { useActionState } from "react";
import { saveProfile } from "./actions";
import type { ProfileState } from "@/lib/auth/validation";
import { Icon } from "@/components/icon";
export function ProfileForm({ profile, email, emailVerified, next }: { profile: { first_name: string | null; last_name: string | null; phone: string | null }; email: string; emailVerified: boolean; next: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const values = state.values ?? profile;
  return <form action={action} className="profile-form" aria-busy={pending}><input type="hidden" name="next" value={next} /><div className="verified-email"><Icon name={emailVerified ? "check" : "mail"} /><div><span>{emailVerified ? "Verifikovan imejl" : "Test imejl — potvrda nije proverena"}</span><strong>{email}</strong></div></div>
    <div className="name-fields">{([["first_name", "Ime", "given-name"], ["last_name", "Prezime", "family-name"]] as const).map(([name, label, autoComplete]) => <div className="field" key={name}><label htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={values[name] ?? ""} autoComplete={autoComplete} maxLength={80} required aria-invalid={!!state.errors?.[name]} aria-describedby={`${name}-error`} /><span className="field-error" id={`${name}-error`}>{state.errors?.[name]}</span></div>)}</div>
    <div className="field"><label htmlFor="phone">Broj telefona</label><input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ""} autoComplete="tel" maxLength={40} placeholder="064 123 4567" required aria-invalid={!!state.errors?.phone} aria-describedby="phone-help phone-error" /><span className="field-help" id="phone-help">Srpski broj možeš uneti sa 0 ili +381. Za druge zemlje dodaj međunarodni pozivni kod.</span><span className="field-error" id="phone-error">{state.errors?.phone}</span></div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.errors && <p className="sr-only" role="alert">Proveri označena polja.</p>}
    <button className="button button-full" disabled={pending}>{pending ? "Čuvanje…" : "Sačuvaj podatke"}<Icon name="arrow" /></button><p className="field-help">Telefon koristimo za kontakt u vezi sa terminom. Ne šaljemo SMS kodove.</p></form>;
}
