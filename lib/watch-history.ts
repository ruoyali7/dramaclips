export const WATCH_HISTORY_KEY = "dramaclips:watch-history:v1";
export const LEGACY_WATCH_KEY = "dramaclips:last";

export type WatchHistoryEntry = {
  slug: string;
  episode?: number;
  positionSeconds?: number;
  at: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function validEntry(value: unknown): value is WatchHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<WatchHistoryEntry>;
  return typeof entry.slug === "string" && Boolean(entry.slug.trim()) &&
    typeof entry.at === "number" && Number.isFinite(entry.at) &&
    (entry.episode === undefined || Number.isInteger(entry.episode) && entry.episode > 0) &&
    (entry.positionSeconds === undefined || typeof entry.positionSeconds === "number" && Number.isFinite(entry.positionSeconds) && entry.positionSeconds >= 0);
}

export function parseWatchHistory(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []).filter(validEntry).sort((a, b) => b.at - a.at).slice(0, 10);
  } catch {
    return [];
  }
}

export function readWatchHistory(storage: StorageLike): WatchHistoryEntry[] {
  try {
    const currentRaw = storage.getItem(WATCH_HISTORY_KEY);
    const current = parseWatchHistory(currentRaw);
    if (currentRaw !== null || current.length) return current;
    const legacyRaw = storage.getItem(LEGACY_WATCH_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as unknown;
    if (!validEntry(legacy)) return [];
    const migrated = [legacy];
    storage.setItem(WATCH_HISTORY_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

export function saveWatchProgress(storage: StorageLike, entry: WatchHistoryEntry) {
  if (!validEntry(entry)) return;
  try {
    const history = readWatchHistory(storage).filter(item => item.slug !== entry.slug);
    storage.setItem(WATCH_HISTORY_KEY, JSON.stringify([entry, ...history].sort((a, b) => b.at - a.at).slice(0, 10)));
  } catch {
    // Private browsing and quota restrictions must not interrupt playback.
  }
}
