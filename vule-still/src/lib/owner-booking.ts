import { normalizePhone } from "./auth/validation";
type Common = { request_key: string };
type Selection = { location: string; start: string; schedule_revision: number; name: string; phone: string | null };
type Create = Common & Selection & { operation: "create"; service: string; expected_service_name: string; expected_duration: number };
type Update = Common & Selection & { operation: "update"; reservation: string; version: number };
type Cancel = Common & { operation: "cancel"; reservation: string };
const id = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export function parseOwnerMutation(value: unknown): Create | Update | Cancel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!id(v.request_key)) return null;
  if (v.operation === "cancel") return id(v.reservation) ? { operation: "cancel", request_key: v.request_key, reservation: v.reservation } : null;
  if (!["create", "update"].includes(String(v.operation)) || !id(v.location) || typeof v.start !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(v.start) || !Number.isFinite(Date.parse(v.start)) || new Date(v.start).toISOString() !== v.start
    || !positive(v.schedule_revision) || typeof v.name !== "string" || !v.name.trim() || [...v.name.trim()].length > 120 || /[\x00-\x1f\x7f]/.test(v.name)
    || (v.phone !== undefined && v.phone !== null && typeof v.phone !== "string")) return null;
  const phone = typeof v.phone === "string" && v.phone.trim() ? normalizePhone(v.phone) : null;
  if (typeof v.phone === "string" && v.phone.trim() && !phone) return null;
  const common = { request_key: v.request_key, location: v.location, start: v.start, schedule_revision: v.schedule_revision, name: v.name.trim(), phone };
  if (v.operation === "update") return id(v.reservation) && positive(v.version) ? { ...common, operation: "update", reservation: v.reservation, version: v.version } : null;
  if (!id(v.service) || typeof v.expected_service_name !== "string" || !v.expected_service_name.trim() || !positive(v.expected_duration) || v.expected_duration % 10 !== 0) return null;
  return { ...common, operation: "create", service: v.service, expected_service_name: v.expected_service_name, expected_duration: v.expected_duration };
}
