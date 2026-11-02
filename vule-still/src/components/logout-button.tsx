"use client";
import { useActionState } from "react";
import { logout } from "@/app/prijava/actions";
export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, { error: "" });
  return <form action={action} className="logout-form"><button className="text-button" disabled={pending}>{pending ? "Odjavljivanje…" : "Odjavi se"}</button>{state.error && <p role="alert" className="field-error">{state.error}</p>}</form>;
}
