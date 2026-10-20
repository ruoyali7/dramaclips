import type { Drama } from "./types";

export function rankRecommendations(current: Drama, candidates: Drama[], episodeCounts: ReadonlyMap<string, number>, limit = 3) {
  const currentTags = new Set(current.tags.map(tag => tag.trim().toLowerCase()));
  return candidates
    .filter(drama => drama.id !== current.id && drama.status === "published")
    .map(drama => ({
      drama,
      sharedTags: drama.tags.reduce((count, tag) => count + (currentTags.has(tag.trim().toLowerCase()) ? 1 : 0), 0),
      previewCount: episodeCounts.get(drama.id) || 0
    }))
    .sort((a, b) => b.sharedTags - a.sharedTags || Number(b.previewCount > 0) - Number(a.previewCount > 0) || a.drama.title.localeCompare(b.drama.title))
    .slice(0, limit)
    .map(result => result.drama);
}
