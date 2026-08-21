import { describe, expect, it } from "vitest";
import { snapIsoToTenMinutes } from "@/lib/publish-time";

describe("publish time", () => {
  it("normalizes API timestamps as a defensive fallback", () => {
    expect(snapIsoToTenMinutes("2026-08-13T03:39:42.000Z")).toBe("2026-08-13T03:30:00.000Z");
    expect(snapIsoToTenMinutes("2026-08-13T03:48:42.000Z")).toBe("2026-08-13T03:40:00.000Z");
  });
});
