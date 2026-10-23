import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ copy: vi.fn(), listDramas: vi.fn() }));
vi.mock("@/lib/admin/r2", () => ({ copyRemoteVideoToR2: mocks.copy }));
vi.mock("@/lib/admin/repository", () => ({ getPublishedDramaDrafts: mocks.listDramas }));

import { POST } from "@/app/api/admin/uploads/remote/route";

const request = () => new Request("http://localhost/api/admin/uploads/remote", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: "https://v-out.oss-accelerate.aliyuncs.com/free/episode.mp4?signature=one", slug: "saved-drama", episodeNumber: 1 }),
}) as never;

describe("remote R2 upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.com");
    mocks.copy.mockResolvedValue({ publicUrl: "https://media.example.com/dramas/saved-drama/new.mp4", size: 100, reused: false });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reuses an existing saved episode before starting another remote transfer", async () => {
    mocks.listDramas.mockResolvedValue([{ slug: "saved-drama", episodes: [{ episodeNumber: 1, videoUrl: "https://media.example.com/dramas/saved-drama/existing.mp4" }] }]);
    const response = await POST(request());
    await expect(response.json()).resolves.toEqual({ publicUrl: "https://media.example.com/dramas/saved-drama/existing.mp4", size: 0, reused: true });
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it("transfers when no saved R2 episode exists", async () => {
    mocks.listDramas.mockResolvedValue([]);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.copy).toHaveBeenCalledTimes(1);
  });
});
