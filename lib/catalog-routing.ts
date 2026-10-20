import type { Drama } from "./types";

export function requestedDramaIdentifier(query: Record<string, string | string[] | undefined>) {
  if (typeof query.d === "string") return query.d.trim();
  if (typeof query.code === "string") return query.code.trim();
  if (typeof query.cl === "string" && query.cl.includes("3469908")) return "3469908";
  return "";
}

export function findExactDrama(dramas: Drama[], value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return dramas.find(drama =>
    drama.slug.toLowerCase() === normalized ||
    drama.publicCode.toLowerCase() === normalized ||
    drama.promoCode?.toLowerCase() === normalized
  );
}
