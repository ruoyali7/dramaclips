import type { Drama } from "./types";

export type CatalogSort = "featured" | "newest" | "title";

export function catalogGenres(dramas: Drama[]) {
  return Array.from(new Set(dramas.flatMap(drama => drama.tags.map(tag => tag.trim())).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
}

export function browseCatalog(dramas: Drama[], query: string, genre: string, sort: CatalogSort) {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedGenre = genre.trim().toLowerCase();
  const filtered = dramas.filter(drama => {
    const matchesQuery = !normalizedQuery || [drama.title, drama.publicCode, drama.promoCode || "", ...drama.tags]
      .some(value => value.toLowerCase().includes(normalizedQuery));
    const matchesGenre = !normalizedGenre || drama.tags.some(tag => tag.toLowerCase() === normalizedGenre);
    return drama.status === "published" && matchesQuery && matchesGenre;
  });

  if (sort === "title") return filtered.toSorted((left, right) => left.title.localeCompare(right.title));
  if (sort === "newest") return filtered.toSorted((left, right) =>
    Date.parse(right.publishedAt || "") - Date.parse(left.publishedAt || "") || left.title.localeCompare(right.title));
  return filtered;
}
