import { beforeEach, describe, expect, it, vi } from "vitest";

const { listItems, markScheduled, createPackage, enqueue, getPackage, slots } = vi.hoisted(() => ({
  listItems: vi.fn(), markScheduled: vi.fn(), createPackage: vi.fn(), enqueue: vi.fn(), getPackage: vi.fn(), slots: vi.fn(),
}));
vi.mock("@/lib/admin/publish-cart-repository", () => ({ listPublishCartItems: listItems, markPublishCartItemScheduled: markScheduled }));
vi.mock("@/lib/admin/publish-repository", () => ({ createPublishPackage: createPackage, enqueueYixiaoerPackage: enqueue, getPublishPackage: getPackage }));
vi.mock("@/lib/admin/yixiaoer-account-cache", () => ({ getCachedYixiaoerAccounts: vi.fn(async () => ({ accounts: [
  { id: "tt", platform: "TikTok", status: 1 }, { id: "ig", platform: "Instagram", status: 1 },
  { id: "yt", platform: "Youtube", status: 1 }, { id: "fb", platform: "Facebook", status: 1 },
] })) }));
vi.mock("@/lib/admin/publish-cart-date", () => ({ pacificCartDates: () => ["2026-09-08", "2026-09-09"] }));
vi.mock("@/lib/publish-slots", () => ({ futurePacificPublishSlots: slots }));
vi.mock("@/lib/catalog", () => ({ getDramaBySlug: vi.fn(async () => ({ title: "Drama", promoCode: "CODE", publicCode: "PUBLIC", description: "Story.", tags: [], contentPromotionUrl: "https://reelslink.test/cps" })) }));

import { POST } from "@/app/api/admin/publish-cart/confirm/route";

const item = { id: "11111111-1111-4111-8111-111111111111", cartDate: "2026-09-08", position: 1, assetId: "asset-1", assetSource: "vizard", dramaId: "drama-1", dramaSlug: "drama", dramaTitle: "Drama", episodeNumber: 2, title: "Hook", videoUrl: "https://video.test/hook.mp4", durationSeconds: 40, status: "cart", createdAt: "" };
const request = () => new Request("http://localhost/api/admin/publish-cart/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartDate: "2026-09-08", confirm: true }) }) as never;

describe("publish cart confirmation", () => {
  beforeEach(() => { vi.clearAllMocks(); slots.mockReturnValue(["2026-09-08T14:00:00.000Z"]); listItems.mockImplementation(async (_dates, statuses) => statuses?.includes("scheduled") ? [] : [item]); createPackage.mockResolvedValue({ id: "package-1", status: "ready" }); enqueue.mockResolvedValue({ id: "package-1", status: "scheduled" }); markScheduled.mockResolvedValue({}); });

  it("creates and queues the cart in fixed order with all default platforms", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(createPackage).toHaveBeenCalledWith(expect.objectContaining({ cartItemId: item.id, scheduledAt: "2026-09-08T14:00:00.000Z", platforms: ["tiktok", "instagram", "youtube", "facebook"], hookClipId: undefined }));
    expect(enqueue).toHaveBeenCalledWith("package-1", { action: "publish", accounts: { tiktok: "tt", instagram: "ig", youtube: "yt", facebook: "fb" }, scheduledAt: "2026-09-08T14:00:00.000Z" });
    expect(markScheduled).toHaveBeenCalledWith(item.id, "package-1", "2026-09-08T14:00:00.000Z");
  });

  it("does not enqueue an already scheduled idempotent cart package again", async () => {
    createPackage.mockResolvedValue({ id: "package-1", status: "scheduled" });
    expect((await POST(request())).status).toBe(201);
    expect(enqueue).not.toHaveBeenCalled();
    expect(markScheduled).toHaveBeenCalled();
  });

  it("rejects when the day has insufficient future slots before creating packages", async () => {
    slots.mockImplementationOnce(() => { throw new Error("Only 0 future publish slots remain for 2026-09-08"); });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(createPackage).not.toHaveBeenCalled();
  });

  it("keeps a failed item for retry while scheduling the remaining items", async () => {
    const second = { ...item, id: "22222222-2222-4222-8222-222222222222", assetId: "asset-2", title: "Hook 2", position: 2 };
    listItems.mockImplementation(async (_dates, statuses) => statuses?.includes("scheduled") ? [] : [item, second]);
    slots.mockReturnValue(["2026-09-08T14:00:00.000Z", "2026-09-08T14:10:00.000Z"]);
    createPackage.mockRejectedValueOnce(new Error("first failed")).mockResolvedValueOnce({ id: "package-2", status: "ready" });
    enqueue.mockResolvedValueOnce({ id: "package-2", status: "scheduled" });
    const response = await POST(request()); const body = await response.json();
    expect(response.status).toBe(207);
    expect(body.failures).toEqual([{ cartItemId: item.id, title: item.title, message: "first failed" }]);
    expect(markScheduled).toHaveBeenCalledTimes(1);
    expect(markScheduled).toHaveBeenCalledWith(second.id, "package-2", "2026-09-08T14:10:00.000Z");
  });
});
