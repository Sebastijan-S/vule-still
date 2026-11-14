import { Suspense } from "react";
import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/auth/validation";
async function Registration({ searchParams }: PageProps<"/registracija">) {
  const query = await searchParams;
  return redirect(`/prijava?next=${encodeURIComponent(safeReturnTo(query.next))}`);
}
export default function RegistrationPage(props: PageProps<"/registracija">) {
  return <main id="main"><Suspense fallback={<p className="page-loading">Pripremamo registraciju…</p>}><Registration {...props} /></Suspense></main>;
}
