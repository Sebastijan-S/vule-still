"use client";
import { useActionState, useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import { authenticatePassword } from "./password-actions";

export function PasswordForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(authenticatePassword, {});
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  return <form action={action} className="auth-form" aria-busy={pending}>
    <input type="hidden" name="next" value={next} />
    <div className="form-symbol"><Icon name="user" /></div>
    <h2>Dobro došao.</h2>
    <p className="form-intro">Privremena prijava za test projekat. Za javno puštanje biće obavezna potvrda imejla.</p>
    <div className="field"><label htmlFor="email">Imejl adresa</label><input id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} defaultValue={state.email} required /></div>
    <div className="field"><label htmlFor="password">Lozinka</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required aria-describedby="password-help" /><span id="password-help" className="field-help">Najmanje 12 znakova.</span></div>
    <div id="auth-feedback" aria-live="polite">{state.error && <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>{state.error}</p>}</div>
    <button className="button button-full" name="intent" value="signin" disabled={pending}>{pending ? "Sačekaj trenutak…" : "Prijavi se"}<Icon name="arrow" /></button>
    <button className="text-button" name="intent" value="signup" disabled={pending}>Napravi test nalog</button>
  </form>;
}
