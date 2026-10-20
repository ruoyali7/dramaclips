import { describe, expect, it } from "vitest";
import { LEGACY_WATCH_KEY, WATCH_HISTORY_KEY, parseWatchHistory, readWatchHistory, saveWatchProgress } from "@/lib/watch-history";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    value: (key: string) => values.get(key)
  };
}

describe("watch history", () => {
  it("returns an empty history for malformed storage", () => {
    expect(parseWatchHistory("not-json")).toEqual([]);
    expect(parseWatchHistory(JSON.stringify([{ slug: "", at: 1 }, { slug: "valid", at: 2 }]))).toEqual([{ slug: "valid", at: 2 }]);
  });

  it("migrates valid legacy progress", () => {
    const storage = memoryStorage({ [LEGACY_WATCH_KEY]: JSON.stringify({ slug: "drama", episode: 2, positionSeconds: 12, at: 10 }) });
    expect(readWatchHistory(storage)).toEqual([{ slug: "drama", episode: 2, positionSeconds: 12, at: 10 }]);
    expect(storage.value(WATCH_HISTORY_KEY)).toBeTruthy();
  });

  it("updates one drama without overwriting another", () => {
    const storage = memoryStorage();
    saveWatchProgress(storage, { slug: "one", episode: 1, at: 1 });
    saveWatchProgress(storage, { slug: "two", episode: 2, at: 2 });
    saveWatchProgress(storage, { slug: "one", episode: 3, at: 3 });
    expect(readWatchHistory(storage).map(item => [item.slug, item.episode])).toEqual([["one", 3], ["two", 2]]);
  });

  it("keeps only the ten most recent dramas", () => {
    const storage = memoryStorage();
    for (let index = 0; index < 12; index += 1) saveWatchProgress(storage, { slug: `drama-${index}`, at: index });
    const history = readWatchHistory(storage);
    expect(history).toHaveLength(10);
    expect(history[0].slug).toBe("drama-11");
    expect(history.at(-1)?.slug).toBe("drama-2");
  });

  it("does not throw when storage is unavailable", () => {
    const unavailable = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readWatchHistory(unavailable)).toEqual([]);
    expect(() => saveWatchProgress(unavailable, { slug: "drama", at: 1 })).not.toThrow();
  });
});
