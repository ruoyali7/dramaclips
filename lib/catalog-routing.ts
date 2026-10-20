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

export function rankDramaMatches<T extends Drama>(dramas: T[], value: string, limit = 5) {
  const query = value.trim().toLowerCase();
  if (!query) return [];
  return dramas
    .filter(drama => drama.status === "published")
    .map((drama, index) => {
      const title = drama.title.toLowerCase();
      const publicCode = drama.publicCode.toLowerCase();
      const promoCode = drama.promoCode?.toLowerCase();
      let score = Number.POSITIVE_INFINITY;
      if (promoCode === query) score = 0;
      else if (publicCode === query) score = 1;
      else if (title === query) score = 2;
      else if (title.startsWith(query)) score = 3;
      else if (title.includes(query)) score = 4;
      else if (drama.tags.some(tag => tag.toLowerCase().includes(query))) score = 5;
      return { drama, index, score };
    })
    .filter(result => Number.isFinite(result.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map(result => result.drama);
}
