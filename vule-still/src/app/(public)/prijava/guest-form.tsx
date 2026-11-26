"use client";
import { useActionState, useEffect, useRef } from "react";
import { enterAsGuest, type GuestState } from "./guest-actions";
import { Icon } from "@/components/icon";
import { GuestSessionNote } from "@/components/guest-session-note";

export function GuestForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<GuestState, FormData>(enterAsGuest, {});
  const contactInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (state.error) contactInput.current?.focus(); }, [state]);
  return <form action={action} aria-busy={pending}>
    <input type="hidden" name="next" value={next} />
    <p className="form-intro">Na koji kontakt salon može da te dobije?</p>
    <div className="field"><label htmlFor="contact">Broj telefona ili mejl</label><input ref={contactInput} id="contact" name="contact" type="text" autoComplete="on" maxLength={254} defaultValue={state.contact ?? ""} placeholder="064 123 4567 ili ime@primer.rs" required aria-invalid={!!state.error} aria-describedby="contact-help contact-error" /><span className="field-help" id="contact-help">Dovoljan je jedan kontakt, da salon može da te dobije u vezi sa terminom.</span><span id="contact-error" className="field-error" role={state.error ? "alert" : undefined}>{state.error}</span></div>
    <button className="button button-full" disabled={pending}>{pending ? "Sačekaj trenutak…" : "Nastavi"}<Icon name="arrow" /></button>
    <p className="field-help">Bez lozinke i kodova za potvrdu.</p>
    <GuestSessionNote />
  </form>;
}
