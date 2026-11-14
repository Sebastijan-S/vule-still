// Navigation helpers only. Server/RPC membership checks remain authoritative.
export function isOwnerDestination(value: string): boolean {
  return ["/administracija", "/raspored", "/administrator/sablon"].includes(new URL(value, "https://vule.invalid").pathname);
}
