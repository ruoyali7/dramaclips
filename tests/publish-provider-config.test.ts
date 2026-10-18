import { afterEach, describe, expect, it } from "vitest";
import {
  officialPublishingAccount,
  publishingProvider,
  resolvePublishingAccountId,
} from "@/lib/admin/publish-provider-config";

describe("publish provider configuration", () => {
  afterEach(() => {
    delete process.env.INSTAGRAM_PUBLISH_PROVIDER;
    delete process.env.FACEBOOK_PUBLISH_PROVIDER;
    delete process.env.INSTAGRAM_USER_ID;
    delete process.env.FACEBOOK_PAGE_ID;
  });

  it("keeps every platform on Yixiaoer by default", () => {
    expect(publishingProvider("instagram", {})).toBe("yixiaoer");
    expect(publishingProvider("facebook", {})).toBe("yixiaoer");
    expect(publishingProvider("tiktok", {})).toBe("yixiaoer");
  });

  it("exposes configured official Meta accounts", () => {
    const environment = {
      INSTAGRAM_PUBLISH_PROVIDER: "meta",
      INSTAGRAM_USER_ID: "ig-user",
      FACEBOOK_PUBLISH_PROVIDER: "meta",
      FACEBOOK_PAGE_ID: "fb-page",
    };
    expect(officialPublishingAccount("instagram", environment)).toEqual(expect.objectContaining({ id: "ig-user", platform: "Instagram", status: 1 }));
    expect(resolvePublishingAccountId("facebook", "untrusted-client-value", environment)).toBe("fb-page");
  });

  it("rejects missing official account configuration", () => {
    expect(() => resolvePublishingAccountId("instagram", undefined, { INSTAGRAM_PUBLISH_PROVIDER: "meta" })).toThrow("Configure INSTAGRAM_USER_ID");
  });

  it("rejects unsupported provider values", () => {
    expect(() => publishingProvider("facebook", { FACEBOOK_PUBLISH_PROVIDER: "direct" })).toThrow("FACEBOOK_PUBLISH_PROVIDER must be yixiaoer or meta");
  });
});
