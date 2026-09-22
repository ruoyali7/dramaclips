import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAssets, addItem } = vi.hoisted(() => ({ listAssets: vi.fn(), addItem: vi.fn() }));
vi.mock("@/lib/admin/asset-library", () => ({ listLibraryAssets: listAssets }));
vi.mock("@/lib/admin/publish-cart-repository", () => ({
  addPublishCartItem: addItem,
  listPublishCartItems: vi.fn(),
  removePublishCartItem: vi.fn(),
  reorderPublishCartItems: vi.fn(),
}));
vi.mock("@/lib/publish-cart-date", () => ({ pacificCartDates: () => ["2026-09-22", "2026-09-23"] }));

import { POST } from "@/app/api/admin/publish-cart/route";

const original = {
  id: "original:drama:2", source: "episode", kind: "original", dramaId: "drama-1",
  dramaSlug: "drama", dramaTitle: "Drama", coverUrl: "", episodeNumber: 2,
  title: "Episode 2", videoUrl: "https://video.test/episode-2.mp4", durationSeconds: 0,
  publishing: { status: "never" }, createdAt: "",
};

describe("publish cart assets", () => {
  beforeEach(() => { vi.clearAllMocks(); listAssets.mockResolvedValue([original]); addItem.mockResolvedValue({ id: "cart-1" }); });

  it("adds an original episode from the existing asset library", async () => {
    const request = new Request("http://localhost/api/admin/publish-cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartDate: "2026-09-22", assetId: original.id }) });
    const response = await POST(request as never);
    expect(response.status).toBe(201);
    expect(addItem).toHaveBeenCalledWith("2026-09-22", original);
  });

  it("does not accept a video URL or unknown asset id", async () => {
    const request = new Request("http://localhost/api/admin/publish-cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cartDate: "2026-09-22", assetId: original.videoUrl }) });
    expect((await POST(request as never)).status).toBe(404);
    expect(addItem).not.toHaveBeenCalled();
  });
});
