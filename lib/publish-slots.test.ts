import { describe, expect, it } from "vitest";
import { availablePacificPublishSlots, pacificLocalToIso } from "./publish-slots";

describe("Pacific publish slots", () => {
  it("converts PDT and PST slots to UTC", () => {
    expect(pacificLocalToIso("2026-09-08", "07:00")).toBe("2026-09-08T14:00:00.000Z");
    expect(pacificLocalToIso("2026-12-08", "07:00")).toBe("2026-12-08T15:00:00.000Z");
  });

  it("skips past slots and rejects a cart larger than the remaining day", () => {
    const now = new Date("2026-09-08T19:05:00.000Z");
    expect(availablePacificPublishSlots("2026-09-08", 2, now)).toEqual(["2026-09-08T19:10:00.000Z", "2026-09-08T19:20:00.000Z"]);
    expect(() => availablePacificPublishSlots("2026-09-08", 8, now)).toThrow("Only 7 future publish slots remain");
  });
});
