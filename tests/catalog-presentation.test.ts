import { describe, expect, it } from "vitest";
import { summarizeDescription, uniqueTags } from "@/lib/catalog-presentation";

describe("catalog presentation", () => {
  it("ends a shortened synopsis at the last complete sentence", () => {
    const description = "Yvonne is murdered by her jealous sister right as she's giving birth. She wakes up one year in the past, the day they picked their husbands! Fiona remembers everything that happened next.";
    expect(summarizeDescription(description, 150)).toBe("Yvonne is murdered by her jealous sister right as she's giving birth. She wakes up one year in the past, the day they picked their husbands!");
  });

  it("deduplicates tags without changing their display spelling", () => {
    expect(uniqueTags(["Male", "Adventure", "MALE", " adventure "])).toEqual(["Male", "Adventure"]);
  });
});
