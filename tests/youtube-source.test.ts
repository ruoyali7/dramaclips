import { describe, expect, it } from "vitest";
import { mapYouTubeVideos } from "@/lib/admin/youtube-source";

describe("YouTube source adapter", () => {
  it("maps public video metadata and hashtags into the common post model", () => {
    const [post] = mapYouTubeVideos({ items: [{ id: "abc", snippet: { title: "#ShortDrama revenge", description: "#revenge", channelTitle: "Creator", publishedAt: "2026-08-22T00:00:00Z" }, statistics: { viewCount: "120000", likeCount: "9000" } }] });
    expect(post).toMatchObject({ platform: "youtube", externalId: "abc", views: 120000, likes: 9000, creator: "Creator" });
    expect(post.hashtags).toEqual(["#ShortDrama", "#revenge"]);
  });
});
