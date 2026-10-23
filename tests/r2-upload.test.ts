import { afterEach, describe, expect, it, vi } from "vitest";
import { copyRemoteVideoToR2, createR2Upload } from "@/lib/admin/r2";

describe("R2 upload validation", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  it("rejects video files submitted as covers", () => {
    expect(() => createR2Upload({ fileName: "cover.mp4", contentType: "video/mp4", size: 1024, slug: "test-drama", kind: "cover" })).toThrow("JPG, PNG, or WebP");
  });

  it("enforces the cover size limit", () => {
    expect(() => createR2Upload({ fileName: "cover.jpg", contentType: "image/jpeg", size: 21 * 1024 ** 2, slug: "test-drama", kind: "cover" })).toThrow("20 MB");
  });

  it("rejects image files submitted as episodes", () => {
    expect(() => createR2Upload({ fileName: "episode.jpg", contentType: "image/jpeg", size: 1024, slug: "test-drama", kind: "episode" })).toThrow("MP4, MOV, AVI, or 3GP");
  });

  it("rejects unapproved remote sources before attempting an R2 upload", async () => {
    await expect(copyRemoteVideoToR2({ url: "https://example.com/episode.mp4", slug: "test-drama", episodeNumber: 1 })).rejects.toThrow("URL is not allowed");
  });

  it("rejects insecure Crazy Maple source URLs", async () => {
    await expect(copyRemoteVideoToR2({ url: "http://v-mps.crazymaplestudios.com/episode.mp4", slug: "test-drama", episodeNumber: 1 })).rejects.toThrow("URL is not allowed");
  });

  it("rejects unapproved Aliyun source hosts", async () => {
    await expect(copyRemoteVideoToR2({ url: "https://example.com/episode.mp4?x-oss-signature=test", slug: "test-drama", episodeNumber: 2 })).rejects.toThrow("URL is not allowed");
  });

  it("reuses the same R2 object for renewed signatures of one remote source", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET_NAME", "bucket");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.com");
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200, headers: { "content-length": "123" } }));
    const first = await copyRemoteVideoToR2({ url: "https://v-out.oss-accelerate.aliyuncs.com/free/episode.mp4?signature=one", slug: "test-drama", episodeNumber: 2 });
    const second = await copyRemoteVideoToR2({ url: "https://v-out.oss-accelerate.aliyuncs.com/free/episode.mp4?signature=two", slug: "test-drama", episodeNumber: 2 });
    expect(first).toEqual({ publicUrl: second.publicUrl, size: 123, reused: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method === "HEAD")).toBe(true);
  });

  it("uploads a remote source once when its stable R2 object is absent", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("R2_BUCKET_NAME", "bucket");
    vi.stubEnv("R2_PUBLIC_BASE_URL", "https://media.example.com");
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "video/mp4", "content-length": "3" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(copyRemoteVideoToR2({ url: "https://v-mps.crazymaplestudios.com/free/episode.mp4", slug: "test-drama", episodeNumber: 1 })).resolves.toEqual(expect.objectContaining({ size: 3, reused: false }));
    expect(vi.mocked(fetch).mock.calls.map(([, init]) => init?.method || "GET")).toEqual(["HEAD", "GET", "PUT"]);
  });
});
