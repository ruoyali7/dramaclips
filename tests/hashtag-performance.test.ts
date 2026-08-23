import { describe, expect, it } from "vitest";
import { aggregateHashtagPerformance } from "@/lib/admin/hashtag-performance";

describe("hashtag performance", () => {
  it("aggregates posts by platform and normalized hashtag", () => {
    const result = aggregateHashtagPerformance([
      { platform: "tiktok", hashtags: ["#DramaClips", "#revenge"], views: 120000, likes: 12000, relevance: 100 },
      { platform: "tiktok", hashtags: ["dramaclips"], views: 80000, likes: 8000, relevance: 100 },
      { platform: "instagram", hashtags: ["#dramaclips"], views: 50000, likes: 5000, relevance: 100 },
    ]);
    const tiktok = result.find((item) => item.platform === "tiktok" && item.hashtag === "dramaclips");
    expect(tiktok).toMatchObject({ usageCount: 2, medianViews: 100000, viralRate: 50 });
    expect(result.find((item) => item.platform === "instagram")?.usageCount).toBe(1);
  });
});
