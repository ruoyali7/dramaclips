import { describe, expect, it } from "vitest";
import { snapIsoToHalfHour, snapLocalDateTimeToHalfHour } from "@/lib/publish-time";

describe("publish time", () => {
  it("limits the local picker to :00 or :30", () => {
    expect(snapLocalDateTimeToHalfHour("2026-08-12T20:09")).toBe("2026-08-12T20:00");
    expect(snapLocalDateTimeToHalfHour("2026-08-12T20:39")).toBe("2026-08-12T20:30");
  });

  it("normalizes API timestamps as a defensive fallback", () => {
    expect(snapIsoToHalfHour("2026-08-13T03:39:42.000Z")).toBe("2026-08-13T03:30:00.000Z");
  });
});
