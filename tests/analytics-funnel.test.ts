import { describe, expect, it } from "vitest";
import { publicFunnelRates } from "@/lib/analytics-funnel";

describe("public conversion funnel rates", () => {
  it("uses the documented stage denominators", () => {
    expect(publicFunnelRates({ landingVisitors: 100, watchVisitors: 50, previewStartVisitors: 40, previewCompleteVisitors: 20, outboundVisitors: 10, confirmedRedirectVisitors: 8 })).toEqual({
      landingToWatch: 50,
      watchStart: 80,
      previewCompletion: 50,
      outboundCtr: 20,
      confirmedRedirectRate: 80
    });
  });

  it("returns zero instead of invalid percentages for empty stages", () => {
    expect(publicFunnelRates({ landingVisitors: 0, watchVisitors: 0, previewStartVisitors: 0, previewCompleteVisitors: 0, outboundVisitors: 0, confirmedRedirectVisitors: 0 })).toEqual({
      landingToWatch: 0,
      watchStart: 0,
      previewCompletion: 0,
      outboundCtr: 0,
      confirmedRedirectRate: 0
    });
  });
});
