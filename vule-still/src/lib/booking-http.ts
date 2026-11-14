import "server-only";
import { bookingFailure } from "./booking";

export const bookingHeaders = { "Cache-Control": "no-store" };
export function sameOrigin(request: Request) {
  const origin = new URL(request.url);
  const host = request.headers.get("host");
  if (host) origin.host = host;
  return request.headers.get("origin") === origin.origin;
}
export async function readBookingBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new Error("INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new Error("INVALID_INPUT"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function bookingError(message: string) {
  const { status, error } = bookingFailure(message);
  return Response.json({ error, retry_same_key: status === 503 }, { status, headers: bookingHeaders });
}
