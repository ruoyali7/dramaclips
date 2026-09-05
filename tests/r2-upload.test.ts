import { describe, expect, it } from "vitest";
import { copyRemoteVideoToR2, createR2Upload } from "@/lib/admin/r2";

describe("R2 upload validation", () => {
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
});
