import { describe, expect, it } from "vitest";
import { createR2Upload } from "@/lib/admin/r2";

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
});
