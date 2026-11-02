"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone, readText, safeReturnTo, validName, type ProfileState } from "@/lib/auth/validation";
import { recordUserActivity } from "@/lib/auth/activity";

export async function saveProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const values = { first_name: readText(form.get("first_name")), last_name: readText(form.get("last_name")), phone: readText(form.get("phone")) };
  const errors: NonNullable<ProfileState["errors"]> = {};
  if (!validName(values.first_name)) errors.first_name = "Unesi ime (do 80 znakova).";
  if (!validName(values.last_name)) errors.last_name = "Unesi prezime (do 80 znakova).";
  const phone = normalizePhone(values.phone);
  if (!phone) errors.phone = "Unesi ispravan srpski broj ili međunarodni broj sa pozivnim kodom.";
  if (Object.keys(errors).length) return { errors, values };
  if (!await recordUserActivity()) return { error: "Pristup je istekao. Prijavi se ponovo.", values };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").update({ first_name: values.first_name, last_name: values.last_name, phone }).eq("id", user.id).select("id").single();
    if (error || !data) return { error: "Podaci nisu sačuvani. Pokušaj ponovo.", values };
  } catch { return { error: "Veza je prekinuta. Pokušaj ponovo da sačuvaš podatke.", values }; }
  revalidatePath("/", "layout");
  const next = safeReturnTo(form.get("next"));
  redirect(next === "/profil" ? "/profil?sacuvano=1" : next);
}
