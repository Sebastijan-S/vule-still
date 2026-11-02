"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { authenticate } from "./actions";
import { RESEND_SECONDS, type AuthState } from "@/lib/auth/validation";
import { Icon } from "@/components/icon";

function ResendButton({ sentAt, pending }: { sentAt: number; pending: boolean }) {
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sentAt]);
  return <button className="text-button" name="intent" value="resend" formNoValidate disabled={pending || seconds > 0}>{seconds > 0 ? `Pošalji ponovo za ${seconds} s` : "Pošalji novi kod"}</button>;
}
export function AuthForm({ initialState, next }: { initialState: AuthState; next: string }) {
  const [state, action, pending] = useActionState(authenticate, initialState);
  const codeRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.step === "code") codeRef.current?.focus(); }, [state.step]);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  const codeStep = state.step === "code";
  return <form action={action} className="auth-form" aria-busy={pending}>
    <input type="hidden" name="next" value={next} />
    <div className="form-symbol"><Icon name={codeStep ? "mail" : "user"} /></div>
    <h2>{codeStep ? "Proveri svoj imejl." : "Dobro došao."}</h2>
    <p className="form-intro">{codeStep ? <>Poslali smo kod na <strong className="email-address">{state.email}</strong></> : "Unesi imejl adresu. Poslaćemo ti jednokratni kod za prijavu."}</p>
    {codeStep ? <div className="field"><label htmlFor="code">Kod iz imejla</label><input ref={codeRef} id="code" name="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9\s]{6,16}" maxLength={16} required aria-invalid={!!state.error} aria-describedby="code-help auth-feedback" /><span id="code-help" className="field-help">Unesi ceo kod iz poslednjeg imejla.</span></div> : <div className="field"><label htmlFor="email">Imejl adresa</label><input key={state.email} id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="tvoje.ime@primer.com" maxLength={254} defaultValue={state.email} required aria-invalid={!!state.error} aria-describedby="auth-feedback" /></div>}
    <div id="auth-feedback" aria-live="polite">{state.error && <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>{state.error}</p>}{state.message && <p className="form-success">{state.message}</p>}</div>
    <button className="button button-full" name="intent" value={codeStep ? "verify" : "send"} disabled={pending}>{pending ? "Sačekaj trenutak…" : codeStep ? "Potvrdi i prijavi se" : "Pošalji kod"}<Icon name="arrow" /></button>
    {codeStep ? <div className="form-alternatives"><p>Nije stigao? Proveri neželjenu poštu.</p><ResendButton sentAt={state.sentAt ?? 0} pending={pending} /><button className="text-button muted" name="intent" value="change" formNoValidate disabled={pending}>Promeni imejl adresu</button></div> : <div className="form-footnote"><Icon name="lock" /><p>Nemaš nalog? Kreiraće se kada potvrdiš kod.<br />Lozinka ti nije potrebna.</p></div>}
  </form>;
}
