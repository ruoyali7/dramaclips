import { describe, expect, it } from "vitest";
import { snapIsoToHalfHour } from "@/lib/publish-time";

describe("publish time", () => {
  it("normalizes API timestamps as a defensive fallback", () => {
    expect(snapIsoToHalfHour("2026-08-13T03:39:42.000Z")).toBe("2026-08-13T03:30:00.000Z");
  });
});
