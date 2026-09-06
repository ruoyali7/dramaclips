import { describe, expect, it } from "vitest";
import { publishStatus } from "@/lib/admin/asset-library";

describe("asset library publish status", () => {
  it("keeps an asset published when its package is older than history window", () => {
    expect(publishStatus([], [{ hookClipId: "hook-1", videoUrl: "old-url" }], "hook-1", "new-url")).toEqual({
      status: "published",
      latestPackageId: undefined,
    });
  });

  it("uses the published identity before a newer failed retry", () => {
    expect(publishStatus([
      { id: "failed", hookClipId: "hook-1", videoUrl: "video-url", status: "failed" } as never,
    ], [{ hookClipId: "hook-1", videoUrl: "video-url" }], "hook-1", "video-url")).toEqual({
      status: "published",
      latestPackageId: undefined,
    });
  });
});
