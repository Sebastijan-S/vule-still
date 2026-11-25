"use client";
import { useActionState } from "react";
import { enterAsGuest, type GuestState } from "./guest-actions";
import { Icon } from "@/components/icon";

export function GuestForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<GuestState, FormData>(enterAsGuest, {});
  return <form action={action} aria-busy={pending}>
    <input type="hidden" name="next" value={next} />
    <h2>Dobro došao.</h2>
    <p className="form-intro">Unesi broj telefona ili mejl. Bez lozinke i kodova za potvrdu.</p>
    <div className="field"><label htmlFor="contact">Broj telefona ili mejl</label><input id="contact" name="contact" type="text" autoComplete="on" maxLength={254} defaultValue={state.contact ?? ""} placeholder="064 123 4567 ili ime@primer.rs" required aria-describedby="contact-help" /><span className="field-help" id="contact-help">Dovoljan je jedan kontakt, da salon može da te dobije u vezi sa terminom.</span></div>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-full" disabled={pending}>{pending ? "Sačekaj trenutak…" : "Nastavi"}<Icon name="arrow" /></button>
    <p className="field-help">Tvoje termine čuvamo u ovom pregledaču. Posle odjave ili na drugom uređaju, za prethodne termine kontaktiraj salon.</p>
  </form>;
}
