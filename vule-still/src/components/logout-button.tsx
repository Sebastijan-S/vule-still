"use client";
import { useActionState } from "react";
import { logout } from "@/app/(public)/prijava/actions";
export function LogoutButton({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(logout, { error: "" });
  return <form action={action} className="logout-form"><input type="hidden" name="next" value={next ?? ""} /><button className="text-button" disabled={pending}>{pending ? "Odjavljivanje…" : "Odjavi se"}</button>{state.error && <p role="alert" className="field-error">{state.error}</p>}</form>;
}
