import { describe, expect, it } from "vitest";
import { recommendHashtags } from "@/lib/admin/hashtag-recommendation";

describe("hashtag recommendation", () => {
  it("ranks relevance and live signals while deduplicating tags", () => {
    const result = recommendHashtags("tiktok", [
      { tag: "#revenge", relevance: 90, trend: 40, competition: 30 },
      { tag: "revenge", relevance: 90, trend: 40, competition: 30 },
      { tag: "#unrelated", relevance: 20, trend: 90, competition: 80 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].tag).toBe("revenge");
  });

  it("states when the result uses fallback catalog data", () => {
    const [result] = recommendHashtags("instagram", [{ tag: "romance", relevance: 85 }]);
    expect(result.source).toBe("catalog-fallback");
    expect(result.reason).toMatch(/no live instagram trend data/i);
  });
});
