import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OwnerDenied } from "@/components/owner-shell";
import { TemplateEditor, type Template } from "./template-editor";

export const metadata = { title: "Uobičajena nedelja | Vule Still" };
async function Content() {
  const user = await requireUser("/administrator/sablon");
  const db = await createClient();
  const membership = await db.from("admin_memberships").select("user_id").eq("user_id", user.id).maybeSingle();
  if (membership.error) throw new Error("Provera pristupa trenutno nije dostupna.");
  if (!membership.data) return <OwnerDenied />;
  const [locations, template] = await Promise.all([
    db.from("locations").select("id,name").eq("is_active", true).order("sort_order"),
    db.rpc("get_owner_schedule_template"),
  ]);
  if (locations.error || template.error || !template.data) throw new Error("Uobičajena nedelja trenutno nije dostupna.");
  return <TemplateEditor locations={locations.data ?? []} initial={template.data as unknown as Template} />;
}
export default function TemplatePage() {
  return <main id="main" className="container account-main"><Suspense fallback={<p role="status">Učitavamo uobičajenu nedelju…</p>}><Content /></Suspense></main>;
}
