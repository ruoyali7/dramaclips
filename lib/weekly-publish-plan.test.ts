import { describe, expect, it } from "vitest";
import { addPacificDays, buildWeeklyPlan, nextWeeklyStartDate } from "./weekly-publish-plan";
import type { LibraryAsset } from "./admin/asset-library";

function assets(counts: number[]) {
  return counts.flatMap((count, drama) => Array.from({ length: count }, (_, index) => ({
    id: `asset-${drama}-${index + 1}`, source: "episode" as const, kind: "original" as const,
    dramaId: `drama-${drama}`, dramaSlug: `drama-${drama}`, dramaTitle: `Drama ${drama}`,
    coverUrl: "", episodeNumber: index + 1, title: `Episode ${index + 1}`,
    videoUrl: `https://video.test/${drama}/${index + 1}.mp4`, durationSeconds: 0,
    publishing: { status: "never" as const }, createdAt: "",
  } satisfies LibraryAsset)));
}

describe("weekly publish planning", () => {
  it("starts after the latest occupied future date", () => {
    expect(nextWeeklyStartDate("2026-10-01", ["2026-10-01", "2026-10-03", "2026-09-30"])).toBe("2026-10-04");
    expect(nextWeeklyStartDate("2026-10-01", [])).toBe("2026-10-01");
  });

  it("creates seven fixed ten-video days without duplicates", () => {
    const plan = buildWeeklyPlan(assets([8, 10, 10, 7, 7, 10, 8, 10]), "2026-10-01");
    expect(plan).toHaveLength(7);
    expect(plan.map((day) => day.date)).toEqual(Array.from({ length: 7 }, (_, index) => addPacificDays("2026-10-01", index)));
    expect(plan.every((day) => day.assets.length === 10)).toBe(true);
    expect(new Set(plan.flatMap((day) => day.assets.map((asset) => asset.id))).size).toBe(70);
    expect(plan[0].assets[0].dramaSlug).toBe(plan[0].assets[1].dramaSlug);
    expect(plan[0].assets[0].dramaSlug).toBe(plan[0].assets[5].dramaSlug);
  });

  it("does not make a partial week", () => {
    expect(buildWeeklyPlan(assets([69]), "2026-10-01")).toEqual([]);
  });
});
