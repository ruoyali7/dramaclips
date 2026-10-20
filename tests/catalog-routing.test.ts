import { describe, expect, it } from "vitest";
import { findExactDrama, requestedDramaIdentifier } from "@/lib/catalog-routing";
import type { Drama } from "@/lib/types";

const drama: Drama = {
  id: "d1",
  slug: "secret-billionaire",
  publicCode: "PUBLIC42",
  promoCode: "3469908",
  title: "Secret Billionaire",
  hook: "Hook",
  description: "Description",
  coverUrl: "https://images.example/cover.jpg",
  tags: [],
  status: "published",
  routeSlug: "secret-billionaire",
  accent: "#000"
};

describe("public drama routing", () => {
  it("reads documented identifiers without consuming attribution", () => {
    expect(requestedDramaIdentifier({ d: " secret-billionaire ", s: "instagram" })).toBe("secret-billionaire");
    expect(requestedDramaIdentifier({ code: "3469908" })).toBe("3469908");
  });

  it("keeps the legacy clip identifier match", () => {
    expect(requestedDramaIdentifier({ cl: "reel-3469908-v2" })).toBe("3469908");
  });

  it("matches exact slugs and codes case-insensitively", () => {
    expect(findExactDrama([drama], "SECRET-BILLIONAIRE")?.id).toBe("d1");
    expect(findExactDrama([drama], "public42")?.id).toBe("d1");
    expect(findExactDrama([drama], "3469908")?.id).toBe("d1");
    expect(findExactDrama([drama], "unknown")).toBeUndefined();
  });
});
