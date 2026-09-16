import { afterEach, describe, expect, it } from "vitest";
import { isAllowedPosterCoverUrl, posterCoverProxyUrl } from "@/lib/admin/poster-cover";

describe("poster cover proxy", () => {
  const previous = process.env.R2_PUBLIC_BASE_URL;
  afterEach(() => { process.env.R2_PUBLIC_BASE_URL = previous; });

  it("allows the RS cover host and the configured R2 origin", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://pub-example.r2.dev";
    expect(isAllowedPosterCoverUrl("https://v-img.crazymaplestudios.com/covers/a.jpg")).toBe(true);
    expect(isAllowedPosterCoverUrl("https://pub-example.r2.dev/dramas/a/cover.png")).toBe(true);
  });

  it("rejects insecure and unapproved remote cover hosts", () => {
    process.env.R2_PUBLIC_BASE_URL = "https://pub-example.r2.dev";
    expect(isAllowedPosterCoverUrl("http://v-img.crazymaplestudios.com/covers/a.jpg")).toBe(false);
    expect(isAllowedPosterCoverUrl("https://example.com/cover.jpg")).toBe(false);
    expect(isAllowedPosterCoverUrl("https://pub-example.r2.dev.evil.test/cover.jpg")).toBe(false);
  });

  it("encodes the original cover URL in a same-origin admin route", () => {
    const original = "https://v-img.crazymaplestudios.com/covers/a b.jpg";
    const proxied = posterCoverProxyUrl(original);
    expect(proxied.startsWith("/api/admin/poster-cover?url=")).toBe(true);
    expect(new URLSearchParams(proxied.split("?")[1]).get("url")).toBe(original);
  });
});
