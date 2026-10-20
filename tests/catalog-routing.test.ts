import { describe, expect, it } from "vitest";
import { findExactDrama, rankDramaMatches, requestedDramaIdentifier } from "@/lib/catalog-routing";
import type { Drama } from "@/lib/types";

const drama: Drama = {
  id: "d1",
  slug: "secret-billionaire",
  publicCode: "PUBLIC42",
  promoCode: "3469908",
  title: "Secret Billionaire",
  hook: "Hook",
  description: "Description",
  coverUrl: "https://images.example/cover.jpg",
  tags: [],
  status: "published",
  routeSlug: "secret-billionaire",
  accent: "#000"
};

describe("public drama routing", () => {
  it("reads documented identifiers without consuming attribution", () => {
    expect(requestedDramaIdentifier({ d: " secret-billionaire ", s: "instagram" })).toBe("secret-billionaire");
    expect(requestedDramaIdentifier({ code: "3469908" })).toBe("3469908");
  });

  it("keeps the legacy clip identifier match", () => {
    expect(requestedDramaIdentifier({ cl: "reel-3469908-v2" })).toBe("3469908");
  });

  it("matches exact slugs and codes case-insensitively", () => {
    expect(findExactDrama([drama], "SECRET-BILLIONAIRE")?.id).toBe("d1");
    expect(findExactDrama([drama], "public42")?.id).toBe("d1");
    expect(findExactDrama([drama], "3469908")?.id).toBe("d1");
    expect(findExactDrama([drama], "unknown")).toBeUndefined();
  });

  it("ranks exact codes before titles, partial titles, and tags", () => {
    const titleMatch = { ...drama, id: "d2", slug: "code-love", publicCode: "P2", promoCode: "P2", title: "3469908 Love" };
    const tagMatch = { ...drama, id: "d3", slug: "action", publicCode: "P3", promoCode: "P3", title: "Action Story", tags: ["billionaire"] };
    expect(rankDramaMatches([titleMatch, drama], "3469908").map(item => item.id)).toEqual(["d1", "d2"]);
    expect(rankDramaMatches([tagMatch, drama], "billionaire").map(item => item.id)).toEqual(["d1", "d3"]);
  });

  it("excludes unpublished dramas and limits suggestions", () => {
    const paused = { ...drama, id: "paused", status: "paused" as const };
    expect(rankDramaMatches([paused, drama], "secret", 1).map(item => item.id)).toEqual(["d1"]);
  });
});
