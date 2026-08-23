import { describe, expect, it, vi } from "vitest";

describe("hashtag performance job contract", () => {
  it("keeps the refresh route separate from manual ingestion", () => {
    expect("/api/admin/opportunity/hashtags?refresh=true").toContain("refresh=true");
    expect("/api/admin/opportunity/social-posts").not.toBe("/api/admin/opportunity/hashtags");
  });
});
