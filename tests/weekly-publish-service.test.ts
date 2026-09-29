import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAssets: vi.fn(), listPackages: vi.fn(), listActive: vi.fn(), addItem: vi.fn(), scheduleDate: vi.fn(),
  latestPlan: vi.fn(), createPlan: vi.fn(), updatePlan: vi.fn(), trigger: vi.fn(),
}));
vi.mock("@/lib/admin/asset-library", () => ({ listLibraryAssets: mocks.listAssets }));
vi.mock("@/lib/admin/publish-repository", () => ({ listPublishPackages: mocks.listPackages }));
vi.mock("@/lib/admin/publish-cart-repository", () => ({ addPublishCartItem: mocks.addItem, listActivePublishCartItemsFrom: mocks.listActive }));
vi.mock("@/lib/admin/publish-cart-scheduler", () => ({ schedulePublishCartDate: mocks.scheduleDate }));
vi.mock("@/lib/admin/weekly-publish-repository", () => ({
  getLatestWeeklyPublishPlan: mocks.latestPlan, createWeeklyPublishPlan: mocks.createPlan, updateWeeklyPublishPlan: mocks.updatePlan,
}));
vi.mock("@/lib/admin/railway-worker-trigger", () => ({ triggerRailwayWorker: mocks.trigger }));
vi.mock("@/lib/publish-cart-date", () => ({ pacificCartDates: () => ["2026-09-29", "2026-09-30"] }));

import { scheduleNextPublishWeek } from "@/lib/admin/weekly-publish-service";

function originals(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const triplets = index < 6;
    return {
      id: `asset-${index}`, source: "episode", kind: "original", dramaId: triplets ? "triplets" : `drama-${Math.floor((index - 6) / 10)}`,
      dramaSlug: triplets ? "the-triplets-final-regret" : `newer-${Math.floor((index - 6) / 10)}`,
      dramaTitle: triplets ? "The Triplets' Final Regret" : "Newer Drama",
      dramaPublishedAt: triplets ? "2026-09-27T19:00:00Z" : `2026-09-29T${String(Math.floor((index - 6) / 10) + 10).padStart(2, "0")}:00:00Z`,
      coverUrl: "", episodeNumber: triplets ? index + 3 : ((index - 6) % 10) + 1,
      title: `Episode ${index + 1}`, videoUrl: `https://video.test/${index}.mp4`, durationSeconds: 0,
      publishing: { status: "never" }, createdAt: "",
    };
  });
}

describe("weekly publish service", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.latestPlan.mockResolvedValue(null); mocks.listPackages.mockResolvedValue([]); mocks.listActive.mockResolvedValue([{ cartDate: "2026-09-30", assetId: "manual" }]);
    mocks.trigger.mockResolvedValue({ status: "restarted" }); mocks.addItem.mockResolvedValue({});
    mocks.scheduleDate.mockImplementation(async (date) => ({ cartDate: date, packages: Array.from({ length: 10 }, (_, index) => ({ id: `${date}-${index}` })), failures: [] }));
    mocks.createPlan.mockImplementation(async (input) => ({ id: "plan-1", createdAt: "", ...input }));
    mocks.updatePlan.mockImplementation(async (_id, input) => ({ id: "plan-1", createdAt: "", startDate: "2026-10-01", endDate: "2026-10-07", requiredVideos: 70, availableVideos: 70, missingVideos: 0, scheduledVideos: 0, ...input }));
  });

  it("pauses the whole week and triggers Telegram when inventory is short", async () => {
    mocks.listAssets.mockResolvedValue(originals(64));
    const result = await scheduleNextPublishWeek("https://dramaclips.example", "schedule");
    expect(result.plan.status).toBe("paused");
    expect(result.plan.missingVideos).toBe(6);
    expect(result.plan.startDate).toBe("2026-10-01");
    expect(mocks.addItem).not.toHaveBeenCalled();
    expect(mocks.trigger).toHaveBeenCalledWith("publish");
  });

  it("leaves tomorrow untouched and schedules the following seven full days", async () => {
    mocks.listAssets.mockResolvedValue(originals(70));
    const result = await scheduleNextPublishWeek("https://dramaclips.example", "schedule");
    expect(result.plan.status).toBe("scheduled");
    expect(mocks.addItem).toHaveBeenCalledTimes(70);
    expect(mocks.scheduleDate).toHaveBeenCalledTimes(7);
    expect(mocks.scheduleDate.mock.calls.map((call) => call[0])).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]);
  });
});
