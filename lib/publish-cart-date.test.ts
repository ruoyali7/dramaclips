import { describe, expect, it } from "vitest";
import { pacificCartDates } from "./publish-cart-date";

describe("pacificCartDates", () => {
  it("uses the Pacific calendar day near UTC midnight", () => {
    expect(pacificCartDates(new Date("2026-09-08T02:00:00Z"))).toEqual(["2026-09-07", "2026-09-08"]);
  });

  it("advances over month and year boundaries", () => {
    expect(pacificCartDates(new Date("2027-01-01T07:30:00Z"))).toEqual(["2026-12-31", "2027-01-01"]);
  });
});
