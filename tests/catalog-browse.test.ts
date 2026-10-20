import { describe, expect, it } from "vitest";
import { browseCatalog, catalogGenres } from "@/lib/catalog-browse";
import type { Drama } from "@/lib/types";

function drama(id: string, title: string, tags: string[], publishedAt?: string): Drama {
  return { id, title, tags, publishedAt, status: "published", slug: id, publicCode: id, hook: "", description: "", coverUrl: "/cover.jpg", routeSlug: id, accent: "#000" };
}

const dramas = [
  drama("1", "Wolf Moon", ["Werewolf", "Revenge"], "2026-01-01T00:00:00Z"),
  drama("2", "Contract Love", ["Romance"], "2026-03-01T00:00:00Z"),
  drama("3", "Alpha Heart", ["Werewolf"], "2026-02-01T00:00:00Z")
];

describe("catalog browsing", () => {
  it("builds a unique alphabetical genre list", () => {
    expect(catalogGenres(dramas)).toEqual(["Revenge", "Romance", "Werewolf"]);
  });

  it("filters by search and genre", () => {
    expect(browseCatalog(dramas, "heart", "werewolf", "featured").map(item => item.id)).toEqual(["3"]);
    expect(browseCatalog(dramas, "2", "", "featured").map(item => item.id)).toEqual(["2"]);
  });

  it("sorts by newest or title without mutating the source order", () => {
    expect(browseCatalog(dramas, "", "", "newest").map(item => item.id)).toEqual(["2", "3", "1"]);
    expect(browseCatalog(dramas, "", "", "title").map(item => item.id)).toEqual(["3", "2", "1"]);
    expect(dramas.map(item => item.id)).toEqual(["1", "2", "3"]);
  });
});
