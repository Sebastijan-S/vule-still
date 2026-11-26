import { publicLocations, publicServices } from "@/lib/public-catalogue-server";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (kind !== "services" && kind !== "locations") return Response.json({ error: "Katalog nije pronađen." }, { status: 404, headers });
  const data = kind === "services" ? await publicServices() : await publicLocations();
  if (data === null) return Response.json({ error: "Katalog trenutno nije dostupan." }, { status: 503, headers });
  return Response.json({ data }, { headers });
}
