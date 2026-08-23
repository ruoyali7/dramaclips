import { describe, expect, it } from "vitest";
import { normalizeSocialPost } from "@/lib/admin/social-post-ingestion";

describe("social post ingestion", () => {
  it("normalizes and deduplicates hashtags", () => {
    const post = normalizeSocialPost({ platform: "tiktok", externalId: "1", url: "https://tiktok.com/@demo/video/1", hashtags: ["#DramaClips", "dramaclips", "#Revenge plot"] });
    expect(post.hashtags).toEqual(["dramaclips", "revengeplot"]);
  });
});
