import { describe, expect, it } from "vitest";
import { rankRecommendations } from "@/lib/recommendations";
import type { Drama } from "@/lib/types";

function drama(id: string, title: string, tags: string[], status: Drama["status"] = "published"): Drama {
  return { id, title, tags, status, slug: id, publicCode: id, hook: "", description: "", coverUrl: "https://images.example/cover.jpg", routeSlug: id, accent: "#000" };
}

describe("drama recommendations", () => {
  it("prefers shared genres, excludes current and unpublished dramas, and has a stable fallback", () => {
    const current = drama("current", "Current", ["Romance", "Revenge"]);
    const candidates = [
      current,
      drama("none-b", "Beta", []),
      drama("shared", "Shared", ["romance"]),
      drama("paused", "Paused", ["romance"], "paused"),
      drama("none-a", "Alpha", [])
    ];
    expect(rankRecommendations(current, candidates, new Map(), 4).map(item => item.id)).toEqual(["shared", "none-a", "none-b"]);
  });

  it("prefers a playable fallback when tag relevance is equal", () => {
    const current = drama("current", "Current", []);
    const candidates = [drama("empty", "Alpha", []), drama("playable", "Zulu", [])];
    expect(rankRecommendations(current, candidates, new Map([["playable", 2]])).map(item => item.id)).toEqual(["playable", "empty"]);
  });
});
