import { describe, expect, it } from "vitest";
import { renderedHookCoverTimestamp } from "../lib/hook-cover";

describe("hook cover timestamp", () => {
  it("maps the selected source frame into the rendered hook timeline", () => {
    expect(renderedHookCoverTimestamp({
      sourceRanges: [{ start: 33.125, end: 54.25 }],
      renderedRanges: [{ start: 0, end: 21.125 }],
      coverSourceTimestamp: 53.25,
      durationSeconds: 21.225,
    })).toBeCloseTo(20.125);
  });

  it("falls back safely when saved metadata is unavailable", () => {
    expect(renderedHookCoverTimestamp({ durationSeconds: 20 })).toBe(0);
  });
});
