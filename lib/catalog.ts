import "server-only";
import { dramas as allSeedDramas, destinations as seedDestinations, episodes as allSeedEpisodes } from "./demo-data";
import { getPublishedDramaDrafts } from "./admin/repository";
import { decryptSensitive } from "./admin/encryption";
import type { Destination, Drama, Episode } from "./types";

const seedDramas = allSeedDramas.filter((item) => item.id === "d1");
const seedEpisodes = allSeedEpisodes.filter((item) => item.dramaId === "d1");

function isSameDrama(a: { slug: string; publicCode: string; title: string }, b: { slug: string; publicCode: string; title: string }) {
  return a.slug === b.slug || a.publicCode === b.publicCode || a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

function toDrama(row: Awaited<ReturnType<typeof getPublishedDramaDrafts>>[number]): Drama {
  return { id: row.id, slug: row.slug, publicCode: row.publicCode, title: row.title, hook: row.description.slice(0, 150), description: row.description, coverUrl: row.coverUrl, tags: row.tags, status: "published", routeSlug: row.slug, promoCode: row.promoCode, contentPromotionUrl: decryptSensitive(row.cpsUrlEncrypted), appPromotionUrl: row.appCpsUrlEncrypted ? decryptSensitive(row.appCpsUrlEncrypted) : undefined, accent: "#d96b43" };
}

export async function getCatalog() {
  const rows = await getPublishedDramaDrafts();
  const dynamicDramas = rows.map(toDrama);
  const dynamicEpisodes: Episode[] = rows.flatMap((row) => row.episodes.map((item) => ({ id: `${row.id}-e${item.episodeNumber}`, dramaId: row.id, episodeNumber: item.episodeNumber, title: `Chapter ${item.episodeNumber}`, videoUrl: item.videoUrl, isPreview: true })));
  const fallbackSeeds = seedDramas.filter((seed) => !dynamicDramas.some((drama) => isSameDrama(drama, seed)));
  const fallbackIds = new Set(fallbackSeeds.map((seed) => seed.id));
  return { dramas: [...dynamicDramas, ...fallbackSeeds], episodes: [...dynamicEpisodes, ...seedEpisodes.filter((episode) => fallbackIds.has(episode.dramaId))] };
}

export async function getDramaBySlug(slug: string) {
  const catalog = await getCatalog();
  return catalog.dramas.find((item) => item.slug === slug);
}

export async function getDramaEpisodes(dramaId: string) {
  const catalog = await getCatalog();
  return catalog.episodes.filter((item) => item.dramaId === dramaId).sort((a, b) => a.episodeNumber - b.episodeNumber);
}

export async function findCatalogDrama(value: string) {
  const q = value.trim().toLowerCase();
  const { dramas } = await getCatalog();
  return dramas.find((drama) => drama.publicCode.toLowerCase() === q || drama.promoCode?.toLowerCase() === q || drama.slug === q) || dramas.find((drama) => drama.title.toLowerCase().includes(q) || drama.tags.some((tag) => tag.toLowerCase().includes(q)));
}

export async function getRedirectConfig(routeSlug: string): Promise<{ drama: Drama; destinations: Destination[] } | null> {
  const rows = await getPublishedDramaDrafts();
  const legacySeed = seedDramas.find((seed) => seed.routeSlug === routeSlug);
  const row = rows.find((item) => item.slug === routeSlug || Boolean(legacySeed && isSameDrama(item, legacySeed)));
  if (row) {
    const drama = toDrama(row);
    return { drama, destinations: [{ id: `dest-${row.id}`, routeSlug, name: `ReelShort — ${row.title}`, appPlatform: "universal", url: decryptSensitive(row.cpsUrlEncrypted), allowedHost: "reelslink.com", enabled: true, priority: 10, weight: 100 }] };
  }
  if (legacySeed?.status === "published") return { drama: legacySeed, destinations: seedDestinations.filter((item) => item.routeSlug === routeSlug) };
  return null;
}
